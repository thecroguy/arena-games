// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ArenaEscrow
 * @notice Trustless escrow for Arena Games.
 *
 * Flow:
 *  1. Player calls deposit(roomId, entryFee) — locks USDT into this contract.
 *  2. Server calls release(roomId, winner)   — sends 85% to winner, 15% to house.
 *  3. Server calls refund(roomId)            — sends 100% back to all players.
 *  4. Anyone can call emergencyRefund(roomId) after REFUND_TIMEOUT if server never settles.
 *
 * Security properties:
 *  - Only `server` or `owner` can call release/refund.
 *  - Winner address must have deposited into the room (can't release to arbitrary address).
 *  - Each room can only be settled once (settled flag).
 *  - Emergency refund prevents funds being stuck forever.
 *  - Rake is hardcoded at 1500 bps (15%) — cannot be changed.
 */
interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

contract ArenaEscrow {
    // ── State ──────────────────────────────────────────────────────────────
    address public owner;
    address public server;   // backend signing wallet — can only release/refund
    address public house;    // receives 15% rake
    IERC20  public immutable usdt;

    uint16  public constant RAKE_BPS        = 1500;      // 15%
    uint256 public constant REFUND_TIMEOUT  = 24 hours;  // safety net

    struct Room {
        uint256   entryFee;
        uint256   createdAt;
        address[] players;
        mapping(address => bool) deposited;
        bool settled;
    }

    mapping(bytes32 => Room) private _rooms;

    // ── Events ─────────────────────────────────────────────────────────────
    event Deposited(bytes32 indexed roomId, address indexed player, uint256 amount);
    event Released (bytes32 indexed roomId, address indexed winner, uint256 payout, uint256 rake);
    event Refunded (bytes32 indexed roomId, uint256 playerCount);

    // ── Errors ─────────────────────────────────────────────────────────────
    error NotAuthorized();
    error AlreadySettled();
    error AlreadyDeposited();
    error WrongEntryFee();
    error NotAPlayer();
    error TooFewPlayers();
    error TooEarlyForEmergency();
    error TransferFailed();

    // ── Modifiers ──────────────────────────────────────────────────────────
    modifier onlyAuth() {
        if (msg.sender != server && msg.sender != owner) revert NotAuthorized();
        _;
    }
    modifier onlyOwner() {
        if (msg.sender != owner) revert NotAuthorized();
        _;
    }

    // ── Constructor ────────────────────────────────────────────────────────
    constructor(address _usdt, address _server, address _house) {
        owner  = msg.sender;
        usdt   = IERC20(_usdt);
        server = _server;
        house  = _house;
    }

    // ── Player action ──────────────────────────────────────────────────────

    /**
     * @notice Lock entry fee into the escrow for a given room.
     * @param roomId   keccak256 of the room code string.
     * @param entryFee Amount in USDT token units (with decimals).
     */
    function deposit(bytes32 roomId, uint256 entryFee) external {
        Room storage room = _rooms[roomId];
        if (room.settled)                    revert AlreadySettled();
        if (room.deposited[msg.sender])      revert AlreadyDeposited();

        if (room.players.length == 0) {
            room.entryFee  = entryFee;
            room.createdAt = block.timestamp;
        } else {
            if (room.entryFee != entryFee)   revert WrongEntryFee();
        }

        room.players.push(msg.sender);
        room.deposited[msg.sender] = true;

        if (!usdt.transferFrom(msg.sender, address(this), entryFee)) revert TransferFailed();
        emit Deposited(roomId, msg.sender, entryFee);
    }

    // ── Server actions ─────────────────────────────────────────────────────

    /**
     * @notice Pay winner 85%, house 15%. Winner must be a deposited player.
     */
    function release(bytes32 roomId, address winner) external onlyAuth {
        Room storage room = _rooms[roomId];
        if (room.settled)                    revert AlreadySettled();
        if (room.players.length < 2)         revert TooFewPlayers();
        if (!room.deposited[winner])         revert NotAPlayer();

        room.settled = true;

        uint256 pot    = room.entryFee * room.players.length;
        uint256 rake   = (pot * RAKE_BPS) / 10_000;
        uint256 payout = pot - rake;

        if (!usdt.transfer(winner, payout)) revert TransferFailed();
        if (!usdt.transfer(house,  rake))   revert TransferFailed();

        emit Released(roomId, winner, payout, rake);
    }

    /**
     * @notice Refund all players 100% — used on game abandon or server error.
     */
    function refund(bytes32 roomId) external onlyAuth {
        Room storage room = _rooms[roomId];
        if (room.settled) revert AlreadySettled();
        room.settled = true;
        _refundAll(room);
        emit Refunded(roomId, room.players.length);
    }

    /**
     * @notice Emergency refund anyone can call after REFUND_TIMEOUT.
     *         Prevents funds getting permanently stuck if server goes down.
     */
    function emergencyRefund(bytes32 roomId) external {
        Room storage room = _rooms[roomId];
        if (room.settled)                                            revert AlreadySettled();
        if (block.timestamp < room.createdAt + REFUND_TIMEOUT)      revert TooEarlyForEmergency();
        room.settled = true;
        _refundAll(room);
        emit Refunded(roomId, room.players.length);
    }

    // ── Admin ──────────────────────────────────────────────────────────────
    function setServer(address _server)   external onlyOwner { server = _server; }
    function setHouse(address _house)     external onlyOwner { house  = _house;  }
    function transferOwnership(address a) external onlyOwner { owner  = a;       }

    // ── View helpers ───────────────────────────────────────────────────────
    function roomInfo(bytes32 roomId) external view returns (
        uint256 entryFee, uint256 playerCount, bool settled, address[] memory players
    ) {
        Room storage r = _rooms[roomId];
        return (r.entryFee, r.players.length, r.settled, r.players);
    }

    function hasDeposited(bytes32 roomId, address player) external view returns (bool) {
        return _rooms[roomId].deposited[player];
    }

    // ── Internal ───────────────────────────────────────────────────────────
    function _refundAll(Room storage room) internal {
        for (uint256 i = 0; i < room.players.length; i++) {
            // Best-effort refund — if a transfer fails, skip so others still get paid
            usdt.transfer(room.players[i], room.entryFee);
        }
    }
}
