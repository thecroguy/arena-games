// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ArenaEscrow
 * @notice Trustless escrow for Arena Games.
 *
 * Primary flow (server needs ZERO gas / ZERO MATIC):
 *  1. Player calls deposit(roomId, entryFee)   — locks USDT into this contract.
 *  2. Game ends — server signs (roomId, winner) off-chain and sends sig to client.
 *  3. Winner calls claim(roomId, winner, sig)  — 85% sent to winner, 15% to house.
 *     Winner pays their own ~$0.01 gas to receive their payout. Fair trade.
 *
 * Refund flow (game abandoned):
 *  4. Server signs (roomId, "REFUND") and broadcasts to all players.
 *  5. Each player calls claimRefund(roomId, sig) — gets 100% back, pays own gas.
 *
 * Emergency fallback (if server goes offline):
 *  6. Anyone calls emergencyRefund(roomId) after 24h — 100% returned to players.
 *
 * Backup (if server ever has gas — optional):
 *  - release(roomId, winner) — server pushes payment directly
 *  - refund(roomId)          — server pushes batch refund
 */
interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

contract ArenaEscrow {
    // ── State ──────────────────────────────────────────────────────────────
    address public owner;
    address public server;   // signing wallet — never needs MATIC
    address public house;    // receives 15% rake
    IERC20  public immutable usdt;

    uint16  public constant RAKE_BPS       = 1500;     // 15%
    uint256 public constant REFUND_TIMEOUT = 24 hours;

    struct Room {
        uint256   entryFee;
        uint256   createdAt;
        address[] players;
        mapping(address => bool) deposited;
        bool settled;      // true after release() or all claim()
        bool refundMode;   // true after first claimRefund — blocks claim()
    }

    mapping(bytes32 => Room) private _rooms;

    // ── Events ─────────────────────────────────────────────────────────────
    event Deposited(bytes32 indexed roomId, address indexed player, uint256 amount);
    event Released (bytes32 indexed roomId, address indexed winner, uint256 payout, uint256 rake);
    event Refunded (bytes32 indexed roomId, address indexed player, uint256 amount);

    // ── Errors ─────────────────────────────────────────────────────────────
    error NotAuthorized();
    error AlreadySettled();
    error AlreadyDeposited();
    error WrongEntryFee();
    error NotAPlayer();
    error TooFewPlayers();
    error TooEarlyForEmergency();
    error BadSignature();
    error TransferFailed();

    modifier onlyAuth() {
        if (msg.sender != server && msg.sender != owner) revert NotAuthorized();
        _;
    }
    modifier onlyOwner() {
        if (msg.sender != owner) revert NotAuthorized();
        _;
    }

    constructor(address _usdt, address _server, address _house) {
        owner  = msg.sender;
        usdt   = IERC20(_usdt);
        server = _server;
        house  = _house;
    }

    // ── Player: lock funds ─────────────────────────────────────────────────
    function deposit(bytes32 roomId, uint256 entryFee) external {
        Room storage room = _rooms[roomId];
        if (room.settled)               revert AlreadySettled();
        if (room.deposited[msg.sender]) revert AlreadyDeposited();

        if (room.players.length == 0) {
            room.entryFee  = entryFee;
            room.createdAt = block.timestamp;
        } else {
            if (room.entryFee != entryFee) revert WrongEntryFee();
        }

        room.players.push(msg.sender);
        room.deposited[msg.sender] = true;

        if (!usdt.transferFrom(msg.sender, address(this), entryFee)) revert TransferFailed();
        emit Deposited(roomId, msg.sender, entryFee);
    }

    // ── Winner: claim payout (server-signed, winner pays own gas) ──────────
    /**
     * @notice Claim your winnings. Server signs keccak256(roomId, winner) off-chain.
     *         Anyone can submit the call but funds always go to `winner`.
     */
    function claim(bytes32 roomId, address winner, bytes calldata sig) external {
        Room storage room = _rooms[roomId];
        if (room.settled || room.refundMode) revert AlreadySettled();
        if (room.players.length < 2)         revert TooFewPlayers();
        if (!room.deposited[winner])         revert NotAPlayer();

        // Verify server signed this exact (roomId, winner) pair
        bytes32 msgHash = keccak256(abi.encodePacked(roomId, winner));
        if (_recover(msgHash, sig) != server) revert BadSignature();

        room.settled = true;

        uint256 pot    = room.entryFee * room.players.length;
        uint256 rake   = (pot * RAKE_BPS) / 10_000;
        uint256 payout = pot - rake;

        if (!usdt.transfer(winner, payout)) revert TransferFailed();
        if (!usdt.transfer(house,  rake))   revert TransferFailed();

        emit Released(roomId, winner, payout, rake);
    }

    // ── Player: claim refund on abandon (server-signed, each player pays own gas) ──
    /**
     * @notice Claim your entry fee back. Server signs keccak256(roomId, "REFUND").
     *         Each deposited player claims their own share individually.
     */
    function claimRefund(bytes32 roomId, bytes calldata sig) external {
        Room storage room = _rooms[roomId];
        if (room.settled)                   revert AlreadySettled();
        if (!room.deposited[msg.sender])    revert NotAPlayer(); // not deposited or already claimed

        bytes32 msgHash = keccak256(abi.encodePacked(roomId, "REFUND"));
        if (_recover(msgHash, sig) != server) revert BadSignature();

        room.refundMode = true;
        room.deposited[msg.sender] = false; // prevent double-claim

        if (!usdt.transfer(msg.sender, room.entryFee)) revert TransferFailed();
        emit Refunded(roomId, msg.sender, room.entryFee);
    }

    // ── Emergency: anyone calls after 24h if server went offline ───────────
    function emergencyRefund(bytes32 roomId) external {
        Room storage room = _rooms[roomId];
        if (room.settled || room.refundMode)                    revert AlreadySettled();
        if (block.timestamp < room.createdAt + REFUND_TIMEOUT)  revert TooEarlyForEmergency();
        room.settled = true;
        _refundAll(room);
    }

    // ── Backup: server-initiated (only needed if server ever has gas) ───────
    function release(bytes32 roomId, address winner) external onlyAuth {
        Room storage room = _rooms[roomId];
        if (room.settled || room.refundMode) revert AlreadySettled();
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

    function refund(bytes32 roomId) external onlyAuth {
        Room storage room = _rooms[roomId];
        if (room.settled || room.refundMode) revert AlreadySettled();
        room.settled = true;
        _refundAll(room);
    }

    // ── Admin ──────────────────────────────────────────────────────────────
    function setServer(address _server)   external onlyOwner { server = _server; }
    function setHouse(address _house)     external onlyOwner { house  = _house;  }
    function transferOwnership(address a) external onlyOwner { owner  = a;       }

    // ── View ───────────────────────────────────────────────────────────────
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
            usdt.transfer(room.players[i], room.entryFee);
        }
    }

    function _recover(bytes32 msgHash, bytes calldata sig) internal pure returns (address) {
        bytes32 ethHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", msgHash));
        require(sig.length == 65, "Bad sig length");
        bytes32 r; bytes32 s; uint8 v;
        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 32))
            v := byte(0, calldataload(add(sig.offset, 64)))
        }
        return ecrecover(ethHash, v, r, s);
    }
}
