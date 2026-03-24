import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

interface Article { title: string; answer: string }
interface Category { name: string; icon: string; color: string; articles: Article[] }

const CATEGORIES: Category[] = [
  {
    name: 'Getting Started', icon: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5', color: '#60a5fa',
    articles: [
      {
        title: 'What do I need to get started',
        answer: 'You need three things before you can play your first game on Arena Games.\n\nFirst, a web3 wallet. MetaMask is the most widely used and works in all desktop browsers as an extension. On mobile, you can use MetaMask Mobile, Trust Wallet, or any wallet that supports WalletConnect. If you do not have MetaMask yet, download it from metamask.io and create a new wallet. Save your 12-word seed phrase in a safe place offline — this is the only way to recover your wallet if you lose access.\n\nSecond, USDT on Polygon Mainnet. Arena Games uses USDT (Tether) as its currency for entry fees and payouts. You need this on the Polygon network specifically, not on Ethereum. The minimum entry fee is $0.50, so even $5 worth of USDT is enough to start exploring the platform.\n\nThird, a small amount of MATIC for gas. Every transaction on Polygon requires a tiny fee paid in MATIC, Polygon\'s native token. A single transaction costs roughly $0.001 to $0.005. Buying 1 MATIC (worth around $1) will cover hundreds of games.\n\nThat is everything. No account, no email address, no KYC verification, and no passwords. Your wallet is your identity on Arena Games.'
      },
      {
        title: 'How to connect your wallet',
        answer: 'Connecting your wallet is a one-time step that takes about 30 seconds.\n\nStep 1: Open Arena Games in your browser and click the Connect Wallet button in the top right corner of the navigation bar.\n\nStep 2: A modal will appear showing supported wallet options. Select MetaMask if you have the browser extension installed, or WalletConnect if you are on mobile or using a different wallet.\n\nStep 3: Your wallet will open a connection request popup. It will show the site name (joinarena.space) and ask for permission to see your wallet address and request transaction approvals. Click Connect or Approve.\n\nStep 4: If your wallet is on the wrong network (for example, Ethereum Mainnet), Arena Games will immediately show a Switch Network prompt. Click it and your wallet will ask you to switch to Polygon Mainnet (Chain ID 137). Approve this switch.\n\nOnce connected, your wallet address appears in the navbar and you can start playing. The connection is remembered in your browser, so you will not need to reconnect every visit unless you disconnect manually or clear your browser data.\n\nImportant: Arena Games will never ask you for your seed phrase or private key. If any website asks for these, it is a scam.'
      },
      {
        title: 'How to play your first game',
        answer: 'Once your wallet is connected and you have USDT on Polygon, here is how to play your first game.\n\nStep 1: On the home page, you will see a game card in the center of the screen. Use the game tabs at the top of the card to switch between game formats: Coin Flip, Liar\'s Dice, Pattern Memory, Math Arena, Reaction Grid, Highest Unique, and Lowest Unique. If you are new, start with Coin Flip since it is the simplest.\n\nStep 2: Below the game name, you will see an entry fee selector. This is the amount of USDT you will wager. Both players pay the same entry fee. The winner receives both entry fees minus the platform fee. Start with the minimum to get comfortable.\n\nStep 3: Click Play Now. This adds you to the matchmaking queue. Arena will find another player who chose the same game and entry fee. Typically this takes a few seconds. Alternatively, click Create Room to generate a private room link that you can share with a specific friend.\n\nStep 4: When a match is found, your wallet will ask you to approve a USDT transfer. This is the escrow step: your entry fee moves from your wallet to the smart contract. Read the amount carefully and click Confirm.\n\nStep 5: The game starts. Play, compete, win or lose. If you win, the pot is sent directly to your wallet within seconds of the game ending. No extra steps required.'
      },
      {
        title: 'How to get USDT on Polygon',
        answer: 'USDT on Polygon is different from USDT on Ethereum, even though they are both Tether. You need the Polygon version specifically. There are two main ways to get it.\n\nOption 1: Buy directly on a centralized exchange with Polygon withdrawal support. This is the easiest route. Binance, OKX, Bybit, and KuCoin all let you buy USDT and withdraw directly to the Polygon network. When withdrawing, select Polygon (not ERC-20/Ethereum) as the network. Paste your MetaMask wallet address as the destination. The USDT will arrive in your wallet within minutes.\n\nOption 2: Bridge from Ethereum. If you already have USDT on Ethereum Mainnet, you can move it to Polygon using the official Polygon Bridge at wallet.polygon.technology/bridge. Connect your wallet, select USDT as the token, enter the amount, and initiate the bridge. Bridging from Ethereum to Polygon typically takes 7 to 10 minutes and costs an Ethereum gas fee (which can be $2 to $10 depending on congestion). This option is more expensive than a direct withdrawal from an exchange.\n\nAfter receiving USDT in your wallet, open Arena Games, connect, and your balance is immediately available as your playing balance. There is no deposit step on the platform side.'
      },
      {
        title: 'How to get MATIC for gas fees',
        answer: 'MATIC is the native token of the Polygon network and is used to pay for gas fees on every transaction. Without MATIC, no transactions can be processed, even if you have USDT.\n\nHow much do you need? Each transaction on Polygon costs between $0.001 and $0.005 in MATIC. Buying 1 to 2 MATIC (roughly $1 to $2 in total) is more than enough to play dozens of games. We recommend keeping at least 0.1 MATIC in your wallet at all times as a buffer.\n\nHow to get it: The easiest way is to buy MATIC on a centralized exchange (Binance, Coinbase, OKX, Kraken) and withdraw it directly to your Polygon wallet address. When withdrawing, select the Polygon network (sometimes labeled POL or MATIC-Polygon) as the withdrawal network.\n\nAlternative if you are stuck: If you already have some USDT on Polygon but zero MATIC, you can use a gas station service like the Polygon gas faucet (various community faucets exist) or a swap interface that supports gasless swaps. Some wallets like MetaMask also have a built-in swap feature that can convert a tiny amount of USDT to MATIC in one step.\n\nCheck your MATIC balance: In MetaMask, switch to Polygon Mainnet and your MATIC balance appears at the top. If it shows 0, you need to get MATIC before any transactions will work.'
      },
    ],
  },
  {
    name: 'Deposits and Withdrawals', icon: 'M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6', color: '#34d399',
    articles: [
      {
        title: 'How deposits work',
        answer: 'Arena Games does not have a traditional deposit system. You do not send funds to a platform wallet or create a balance on a centralized server. Your wallet is your account, and your wallet balance is your playing balance at all times.\n\nHere is exactly what happens when you join a game: When you click Play Now and a match is found, Arena Games prepares a smart contract transaction. Your wallet will display a transaction approval popup showing the exact USDT amount (your entry fee), the contract address receiving it (the Arena escrow contract), and the gas fee in MATIC. You review these details and click Confirm.\n\nAt the moment you confirm, your entry fee moves from your wallet directly into the escrow smart contract. It is not held by Arena Games employees or servers. It sits in the contract, which is code on the Polygon blockchain that no one can change or access without following the contract rules.\n\nIf the match is cancelled before it starts (for example, the opponent disconnects in the first 10 seconds), the contract returns your funds automatically. Nothing is ever held longer than the duration of a game.\n\nThis design means you are always in control. Arena Games cannot touch your funds except through the transparent, publicly auditable rules written in the contract code.'
      },
      {
        title: 'How withdrawals work',
        answer: 'Withdrawals on Arena Games are automatic and instant. There is no withdrawal button, no request form, no waiting period, and no minimum withdrawal amount.\n\nHere is what happens the moment a game ends: The Arena game server submits the signed result to the escrow smart contract on Polygon. The contract verifies the result, calculates the winning pot minus the platform fee, and immediately sends the payout to the winner\'s wallet address. This all happens in a single blockchain transaction that completes in 2 to 5 seconds.\n\nThe funds go directly to the wallet address you connected with. There is no intermediate step and no manual processing. If you won $9.10 on a $5 game, that $9.10 is in your MetaMask wallet before you can even close the result screen.\n\nPlatform fee: A small percentage is deducted from the winning pot. The exact fee is always shown on the game card before you confirm entry, so there are no surprises. The fee is taken from the winner, not both players.\n\nWhat if you lose? Your entry fee stays in the contract and is paid out to the winner. There is no withdrawal action for a losing player because nothing remains in the contract for them.\n\nYour funds are never held overnight, never processed in batches, and never subject to a review. The contract executes immediately and automatically every time.'
      },
      {
        title: 'Why did my transaction fail',
        answer: 'Transaction failures on Polygon are uncommon but do happen. Here are the most frequent causes and how to fix each one.\n\nNot enough MATIC for gas: This is the most common reason. If your MATIC balance is 0 or very low, the transaction cannot be broadcast to the network. Fix: Buy 0.5 to 1 MATIC from any exchange and withdraw it to your Polygon wallet. Check your balance in MetaMask by switching to the Polygon network.\n\nUSDP approval rejected or set to zero: Some wallets have a feature where you can edit the approval amount. If you accidentally set it to 0 or cancelled the approval popup, the game entry transaction will fail. Fix: Return to the game, try to join again, and approve the correct amount without modifying it.\n\nInsufficient USDT balance: If your USDT balance is lower than the entry fee you selected, the transaction will revert. Fix: Check your USDT balance (add the Polygon USDT token to MetaMask if it does not appear) and either top up or choose a lower entry fee.\n\nNetwork congestion: Polygon is generally fast, but during brief congestion windows transactions can timeout. Fix: Wait 30 to 60 seconds and try again. You can check the current Polygon network status at polygonscan.com.\n\nTransaction nonce mismatch: This can happen if you have a stuck pending transaction from a previous session. Fix: Reset your account nonce in MetaMask by going to Settings, Advanced, Reset Account. This only clears the local transaction queue and does not affect your funds or history on the blockchain.'
      },
      {
        title: 'How long do transactions take',
        answer: 'Polygon is one of the fastest blockchain networks available. Under normal conditions, transactions confirm in 2 to 5 seconds. This covers both the entry fee approval when you join a game and the payout when a game ends.\n\nWhy Polygon is fast: Unlike Ethereum Mainnet where blocks take 12 seconds and confirmation requires multiple blocks, Polygon produces blocks every 2 seconds and has a high throughput capacity. Most Arena Games transactions will go through before you even notice a delay.\n\nDuring congestion: Occasionally, when there is a spike in activity across the Polygon network, transactions can take 15 to 30 seconds. This is still faster than most other networks. You will see your transaction listed as Pending in MetaMask during this window.\n\nWhen should you be concerned? If a transaction stays in the Pending state for more than 3 to 5 minutes, something unusual is happening. Possible causes: the gas price you submitted was too low for current network conditions, or there is a nonce issue from a previous failed transaction.\n\nWhat to do with a long-pending transaction: Open MetaMask, go to Activity, find the pending transaction, and click Speed Up. This resubmits the same transaction with a higher gas price, giving it priority. Alternatively, click Cancel to attempt to cancel it, though cancellation only works if it has not been included in a block yet.'
      },
      {
        title: 'Can I cancel a pending transaction',
        answer: 'Yes, you can attempt to cancel or speed up a pending transaction in MetaMask, but there is a time window during which this is possible.\n\nHow cancellation works: When you cancel a transaction in MetaMask, it does not actually delete the original transaction. Instead, MetaMask sends a new zero-value transaction to your own address using the same nonce (transaction sequence number) as the pending one, but with a higher gas fee. Miners on the network will pick up the higher-fee replacement transaction first and confirm it, effectively replacing and voiding the original. Your funds are never lost during this process.\n\nHow to cancel: Open MetaMask and go to the Activity tab. Find the transaction labeled Pending. Click on it to expand the details, then click Cancel. A new popup appears showing the cancellation gas fee. Confirm it. If successful, the original transaction will not go through and your USDT stays in your wallet.\n\nHow to speed up instead: If you want the original transaction to succeed but faster, click Speed Up instead of Cancel. This resubmits it with a higher gas fee and will typically confirm within seconds on Polygon.\n\nImportant caveats: If the original transaction is already included in a pending block (even if not yet confirmed in MetaMask), cancellation may fail and both transactions could go through. On Polygon this window is very short due to the fast block time. Act quickly if you need to cancel. Also note: if a game has already started and matched you with an opponent, cancelling the entry transaction mid-game may result in an automatic forfeit rather than a refund.'
      },
    ],
  },
  {
    name: 'Games', icon: 'M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z', color: '#fbbf24',
    articles: [
      {
        title: 'How Coin Flip works',
        answer: 'Coin Flip is the simplest game on Arena Games and a great starting point for new players.\n\nSetup: Two players are matched together. Before any flip happens, each player independently chooses either Heads or Tails. Both choices are locked in simultaneously so neither player can see or react to the other\'s pick before choosing.\n\nThe flip: Once both players have chosen, a verifiably random result is generated using a cryptographic seed that was committed before the round began. The server cannot change the outcome after players have locked in their choices. The result (Heads or Tails) is revealed to both players.\n\nScoring: Whoever chose correctly wins that round. The game is played as a best-of-5 series. The first player to win 3 rounds wins the match. If the score reaches 2-2, the fifth round is the deciding flip.\n\nPayout: The winner receives both entry fees minus the platform fee, paid directly to their wallet by the smart contract within seconds of the final round.\n\nFairness note: Because each flip uses a pre-committed random seed, neither the server nor any player can predict or manipulate the result. You can request the seed from your game log after the match to independently verify the outcome.\n\nStrategy: Coin Flip is purely chance within each round, but there is a meta-game element in deciding whether to switch your pick between rounds or stay consistent. Some players look for patterns, but statistically each flip is independent.'
      },
      {
        title: "How Liar's Dice works",
        answer: "Liar's Dice is a bluffing game of incomplete information. It rewards players who can read opponents and make bold calls at the right moment.\n\nSetup: Each player starts with 5 dice and a cup. At the beginning of each round, both players shake and roll their dice in secret. You can see your own dice but not your opponent's.\n\nBidding: Players take turns making bids. A bid consists of two parts: a quantity and a face value. For example, bidding '3 fours' means you believe there are at least 3 dice showing a 4 across all dice on the table combined (yours and your opponent's). Each new bid must be higher than the previous one. A bid is higher if it increases the quantity (e.g. 3 fours to 4 fours), increases the face value at the same quantity (3 fours to 3 fives), or both.\n\nCalling Liar: At any point instead of raising the bid, you can call Liar. This challenges the current bid. All dice are revealed. If the actual count of that face value meets or exceeds the bid, the bid was true and you (the challenger) lose one die. If the actual count is lower than the bid, the bid was false and the bidder loses one die.\n\nElimination: A player who loses all their dice is eliminated. The remaining player wins the pot.\n\nStrategy tips: The key is information asymmetry. You know your own dice perfectly. Use that to calculate probabilities. If you have three 4s yourself and the table has 10 dice total, a bid of '4 fours' is statistically reasonable. Bluff when you think your opponent does not have enough of a specific value to justify a high bid, and call when bids seem statistically implausible given what you hold."
      },
      {
        title: 'How Pattern Memory works',
        answer: 'Pattern Memory tests your ability to observe, retain, and reproduce sequences accurately under time pressure. It is a pure skill game with no luck component.\n\nSetup: Both players are shown the same grid of colored tiles. The grid size scales with the round number, starting smaller and growing larger in later rounds.\n\nThe sequence: The grid flashes a sequence of highlighted tiles one at a time. The highlight speed increases as rounds progress. You must watch carefully and remember the exact order in which tiles were highlighted.\n\nRecall phase: After the sequence completes, the grid goes dark. You must click the tiles in the exact same order the sequence showed them. If you click incorrectly at any point, that attempt is scored as failed. Partial credit is given for the number of correct sequential clicks before the first error.\n\nScoring: Both accuracy and speed matter. Completing the sequence correctly and quickly earns more points than completing it slowly. Each round has a time limit for the recall phase. Points accumulate across rounds and the player with the highest total score at the end wins the match.\n\nTips for improvement: Do not try to memorize each tile individually. Look for spatial patterns: shapes, paths, corners. Saying the sequence aloud quietly or tracing it with your finger on screen can help retention. Your peripheral vision matters: try to absorb the whole grid rather than tracking one tile at a time.'
      },
      {
        title: 'How Math Arena works',
        answer: 'Math Arena is a mental arithmetic speed game. Every player sees the same problem at the same instant and the fastest correct answer wins each point.\n\nSetup: Both players enter the match and are shown a countdown. When the countdown ends, the first math problem appears simultaneously on both screens.\n\nProblem types: Problems range from simple addition and subtraction in early rounds to multiplication, division, order of operations, percentages, and more complex mental calculations in later rounds. The difficulty increases progressively through the match. All problems are solvable without a calculator, designed for mental computation.\n\nSubmitting an answer: Type your answer into the input field and press Enter or click Submit. Speed matters: the first player to submit the correct answer wins the point. If you submit an incorrect answer, you are penalized by losing the ability to submit again for 2 seconds, giving the opponent a window to answer.\n\nScoring: Points accumulate across all rounds. The player with the most points at the end wins the match.\n\nStrategy: The 2-second penalty for wrong answers is significant. It is better to take an extra second to be certain than to guess and hand your opponent a free window. For multiplication, practice mental shortcuts: 47 times 8 is easier computed as (50 times 8) minus (3 times 8) = 400 minus 24 = 376. Building a toolkit of mental math strategies gives a real edge in this game.'
      },
      {
        title: 'How Reaction Grid works',
        answer: 'Reaction Grid is the most reflex-focused game on Arena Games. No strategy, no math, no bluffing. Just reaction time.\n\nSetup: Both players see the same grid of cells. The grid layout is identical for both players and shown simultaneously.\n\nGameplay: One cell lights up at a time. As soon as a cell highlights, the race begins. The first player to click that exact cell wins the point for that round. After the click is registered, there is a brief pause and then the next cell highlights. This continues for a fixed number of rounds.\n\nLatency compensation: Because players may be connecting from different locations with different internet speeds, the Arena server applies a latency compensation algorithm. Your click timestamps are measured relative to your individual connection latency to ensure the competition is fair regardless of where in the world you are playing from.\n\nScoring: Most rounds won at the end of the match wins the pot.\n\nTips: Keep your cursor near the center of the grid at all times so you have the shortest possible distance to move in any direction. Do not click before the highlight appears — pre-clicking is detected and penalized with a 1-second lockout. Focus on the whole grid, not individual cells, and let peripheral vision guide your hand. Reducing visual clutter on your screen and using a wired mouse rather than wireless can reduce response time.'
      },
      {
        title: 'How Highest Unique works',
        answer: 'Highest Unique is a game of psychology, probability, and reading crowd behavior. It requires no quick reflexes and no memorization, just strategic thinking.\n\nSetup: All players in the match are shown a number range of 1 to 20 and a timer. Each player secretly selects one number. No player can see what others are choosing in real time.\n\nReveal: When the timer ends (or all players have submitted), all chosen numbers are revealed simultaneously. The player who picked the highest number that no other player also picked wins the round. If two players both pick 20, neither can win with 20. If nobody chose a unique number at all, no one wins that round and it replays.\n\nWhy it is interesting: The naive strategy is to pick 20. But if everyone reasons this way, 20 becomes the most commonly chosen number, making it useless. The winning play involves predicting what others will avoid. Numbers in the mid-range (10 to 16) are often chosen frequently, while very high numbers (17 to 20) cluster due to the obvious incentive. The sweet spot shifts based on player count and round history.\n\nScoring: Winning a round earns a point. Most points across all rounds wins the pot. In multi-player formats, the dynamics change significantly as more players reduce the chance that any given number is unique.\n\nMeta-strategy: Watch the reveal each round. If 20 was duplicated in the last round, some players will abandon it next round. Anticipate the shift. Players who think one step ahead tend to outperform those with fixed strategies.'
      },
      {
        title: 'How Lowest Unique works',
        answer: 'Lowest Unique follows the same rules as Highest Unique but inverts the objective. Instead of picking the highest unique number, you want the lowest number that no one else chose.\n\nSetup: All players select a number from 1 to 20 secretly within the timer. All picks are revealed simultaneously.\n\nWinning condition: The player who chose the lowest number that nobody else also chose wins the round. If multiple players chose 1, neither wins with 1. The system then checks 2, then 3, and so on, awarding the point to the lowest unique pick found.\n\nWhy picking 1 is not always right: The obvious play is to pick 1. But in a group of players, 1 is also the most frequently duplicated number for exactly this reason. If three players all pick 1, the winner might be whoever uniquely chose 4.\n\nStrategy differences from Highest Unique: Lowest Unique rewards players willing to pick slightly higher numbers (3 to 7) when they believe the low numbers will be overcrowded. It tends to produce tighter clustering at the bottom of the range, and the variance round-to-round can be higher. The contrarian mindset is key: what number will most players avoid because it seems too high for a lowest unique game? That number may actually be the safest pick.\n\nScoring: Same as Highest Unique. Most points across all rounds wins the pot.'
      },
    ],
  },
  {
    name: 'Account and Profile', icon: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z', color: '#a78bfa',
    articles: [
      {
        title: 'What does my profile show',
        answer: 'Your Arena Games profile is a complete record of your activity on the platform. It is tied entirely to your wallet address and updates automatically after every match.\n\nWallet address: Your profile is identified by your Polygon wallet address. This is your unique identity on the platform and cannot be changed.\n\nUsername: A display name shown to opponents during games and in match history. You can customize this to anything between 3 and 20 characters.\n\nStats overview: The profile shows your total matches played (across all game types and entry levels), your win rate as a percentage, total USDT wagered across your lifetime on the platform, and your single biggest win. These stats reset only if you connect a different wallet.\n\nGame history: A full log of every completed match including the game type, your opponent\'s address or username, the entry fee, the result (Win or Loss), the round-by-round breakdown, and the payout amount. This log is stored for as long as your wallet is active on the platform.\n\nReferral section: Your unique referral link and the number of players who joined through it. Bonus credits earned via referrals are also tracked here.\n\nQuest progress: Your current quest tier progress for each entry fee level, how many matches you have played this month, and which tier rewards you have unlocked.'
      },
      {
        title: 'How to view my game history',
        answer: 'Your complete game history is available on your profile page at any time.\n\nHow to access it: Click your wallet address or the Profile link in the top navigation bar. This opens your profile page. Scroll down to the History section, which lists every game you have played in reverse chronological order (most recent first).\n\nWhat each entry shows: Game type (Coin Flip, Math Arena, etc.), the date and time of the match, your opponent\'s username or wallet address, the entry fee in USDT, the final result (Win or Loss), and the amount you received (for wins) or the amount you wagered (for losses). For skill games, you can also expand an entry to see the round-by-round breakdown.\n\nFiltering: You can filter your history by game type or result to find specific matches quickly.\n\nWhy history matters: Use your history to identify which games you perform best in, which entry fee levels are most profitable for you, and whether your win rate is improving over time. Players who review their history regularly tend to make better decisions about which games to focus on.\n\nIf a match is missing: Matches are recorded the moment the smart contract settles the result. If a match you played does not appear, wait a few minutes for the blockchain to confirm and the server to index the result. If it is still missing after 10 minutes, contact support with your room code.'
      },
      {
        title: 'How to change my username',
        answer: 'Your username is the display name that opponents and other players see during games and in match history. It is separate from your wallet address and can be changed at any time.\n\nHow to change it: Go to your Profile page by clicking the Profile link in the navigation bar. Find the username section near the top of the page. Click on your current username or the edit icon next to it. A text input will appear. Type your new username and click Save or press Enter to confirm.\n\nUsername rules: Usernames must be between 3 and 20 characters. Allowed characters are letters (A to Z, a to z), numbers (0 to 9), and underscores (_). Spaces, special characters, and emoji are not allowed. Usernames are not case-sensitive for uniqueness checks, meaning if someone already has the username Arena123, you cannot register arena123.\n\nHow often can I change it? Username changes are allowed. There is no fee for changing your username. However, frequent changes may make it harder for opponents to recognize you across sessions.\n\nDoes it affect my history or stats? No. Your match history and stats are tied to your wallet address, not your username. Changing your username does not affect any historical records.'
      },
      {
        title: 'How the referral program works',
        answer: 'The referral program rewards you with bonus match credits when you bring new players to Arena Games.\n\nGetting your referral link: Go to your Profile page and find the Referral section. Click Copy Link to copy your unique referral URL. This URL contains your wallet address as a parameter so any signups through it are tracked to you.\n\nHow a referral is counted: When someone visits Arena Games through your link for the first time, a referral tracking cookie is set in their browser (stored in sessionStorage). When that player connects their wallet and completes their first paid match, the referral is confirmed and your bonus credits are credited automatically.\n\nWhat you earn: For each confirmed referral, you earn bonus match credits that can be used as entry fees in any game. The credit amount is shown in the referral section of your profile.\n\nCredits vs cash: Referral credits are the same as quest bonus credits. They can be used as entry fees for future games but cannot be withdrawn as USDT. They expire 48 hours after being credited.\n\nNo cap on referrals: There is no maximum number of players you can refer. The more players you bring to the platform, the more credits you accumulate.\n\nTracking: The Referral section of your profile shows how many players have joined through your link and how many of those have completed a qualifying match.'
      },
    ],
  },
  {
    name: 'Bonuses and Quests', icon: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z', color: '#fb923c',
    articles: [
      {
        title: 'What are bonus credits and how do I earn them',
        answer: 'Bonus credits are free match credits awarded to you for reaching activity milestones on Arena Games. They reduce the real USDT you need to spend to enter games and are the platform\'s way of rewarding consistent players.\n\nHow you earn them: Credits are earned through two systems: the Quest system and the Referral program.\n\nQuest credits: Each entry fee level ($1 and $5) has its own set of milestone tiers. Every match you complete at that entry level counts toward the tier progress. When you reach the required match count for a tier, bonus credits are unlocked automatically. For the $1 entry level: 5 matches unlocks $0.50, 15 matches unlocks $1.20, 30 matches unlocks $2.00, and 50 matches unlocks $3.00. For the $5 entry level, the thresholds are the same but the rewards are proportionally larger.\n\nReferral credits: When someone you referred completes their first paid match, you receive a credit reward.\n\nWhat credits are NOT: Credits are not withdrawable USDT. You cannot convert them to real money or transfer them to your wallet. They are only usable as entry fees within the platform.\n\nCredits vs real USDT: When you enter a game using a bonus credit, the credit is deducted from your credit balance instead of your wallet USDT balance. If you win, the payout still comes from the pot of real USDT paid by both players.'
      },
      {
        title: 'Quest tiers explained',
        answer: 'The Quest system is organized into tiers for each entry fee level. Understanding how tiers work helps you plan your play to maximize the rewards you unlock.\n\nEntry fee levels: Currently there are two quest tracks: $1 entry and $5 entry. Each track is independent. Progress in one does not count toward the other.\n\nTier structure: Each track has four tiers with match count thresholds. For the $1 track: Bronze at 5 matches ($0.50 bonus), Silver at 15 matches ($1.20 bonus), Gold at 30 matches ($2.00 bonus), Elite at 50 matches ($3.00 bonus). For the $5 track the same match counts apply but with higher bonus amounts.\n\nHow progress is counted: Every completed match at the qualifying entry fee level increments your count by 1, win or lose. Abandoned matches or matches that ended in a technical error refund do not count.\n\nMonthly reset: All quest progress resets to zero at midnight UTC on the first day of each calendar month. Unlocked credits that have not been used before reset are forfeited if expired (credits expire 48 hours after being unlocked, regardless of the monthly reset).\n\nViewing your progress: The Quest panel on the home page shows your current tier, the number of matches completed this month, and how many more you need for the next tier. The panel also shows the current active bonus credit balance and its expiry countdown.'
      },
      {
        title: 'How to use bonus credits to enter a game',
        answer: 'Using a bonus credit is straightforward, but there are a few things to understand about how the system works.\n\nWhen you have active bonus credits: The Quest panel on the home page will show your available credit balance and an option to use credits for your next game. Before entering a game at the qualifying entry fee level, you will see an option to use bonus credits instead of USDT.\n\nHow the deduction works: If you enter a $1 game using a bonus credit, $1 worth of credits is deducted from your credit balance. Your USDT wallet balance is not touched for the entry fee portion. However, you still need a small amount of MATIC for the gas fee on the transaction.\n\nWinning with a credit entry: If you win a game entered with bonus credits, your payout is still calculated from the full pot. Your opponent paid real USDT, so the winner receives real USDT minus the platform fee. Winning with a credit entry pays out real USDT to your wallet.\n\nCredit expiry reminder: Credits expire 48 hours after being unlocked. The Quest panel shows the exact time remaining. If you have credits available, try to use them before the timer runs out. Expired credits are forfeited and cannot be restored.\n\nPartial credits: Credits are used in exact entry fee amounts. If you have $0.80 in credits and want to enter a $1 game, you cannot use the credits for a partial payment. You either use a full credit (if the balance is sufficient) or pay entirely in USDT.'
      },
      {
        title: 'When do bonuses expire and can they be extended',
        answer: 'Bonus credits have a fixed 48-hour expiry window that begins the moment they are unlocked. This timer cannot be paused, extended, or reset under any circumstances.\n\nWhen does the clock start? The moment a tier milestone is reached and the bonus is credited to your account. The Quest panel on the home page shows the exact expiry time for your current active bonus.\n\nWhat happens when they expire? The credits are forfeited automatically. They do not roll over to the next tier, and they cannot be restored by support even if you contact us before expiry. The system is automated and the rule applies universally.\n\nCan I get an extension? No. The 48-hour rule is fixed and cannot be modified for individual accounts. The intention is that credits are meant to encourage active play rather than accumulate as a savings balance.\n\nMonthly reset vs expiry: These are two separate things. The monthly reset clears your quest progress (match count toward the next tier) on the first of each month. The 48-hour expiry applies only to unlocked credits. If you unlock a bonus on the 30th of the month, you have until the 1st at the same time to use it, regardless of the monthly reset.\n\nBest practice: As soon as you see a bonus notification in the Quest panel, plan to use it in your next session. Do not let credits sit unused overnight if you can help it.'
      },
      {
        title: 'Can I stack or combine multiple bonuses',
        answer: 'The short answer is no, but the details are worth understanding so you do not lose credits unintentionally.\n\nOne active tier per entry level: Each entry fee level ($1 and $5) can only have one active bonus tier at a time. If you unlock the Silver tier bonus at $1 entry and that $1.20 bonus is still active (within its 48 hours), you cannot simultaneously activate the Gold tier bonus even if you reach the 30-match threshold.\n\nWhat happens when you reach the next tier while a bonus is active? The Gold tier milestone is recorded. The Gold bonus enters a pending state. Once your current Silver bonus is used in a game or expires, the Gold bonus activates and starts its own 48-hour countdown.\n\nCross-level independence: The $1 track and $5 track are completely independent. You can have an active $1 track bonus and an active $5 track bonus at the same time. They do not interfere with each other.\n\nReferral credits and quest credits: Referral credits and quest credits are both drawn from the same credit balance pool. There is no separate bucket for each type. They add together and the total is what you can use for game entry.\n\nPractical implication: Do not sprint through quest tiers faster than you can use the credits. Reaching Elite tier in one day while Silver credits are still active means you will need to use or expire Silver before Gold activates, and then use or expire Gold before Elite activates. Plan your play so bonuses have time to be used.'
      },
    ],
  },
  {
    name: 'Technical', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z', color: '#94a3b8',
    articles: [
      {
        title: 'Which network should I use and how to set it up',
        answer: 'Arena Games runs exclusively on Polygon Mainnet. This is non-negotiable — transactions on any other network will not work with the Arena escrow contract.\n\nPolygon Mainnet details:\nNetwork name: Polygon Mainnet\nChain ID: 137\nCurrency symbol: MATIC\nRPC URL: https://polygon-rpc.com\nBlock explorer: https://polygonscan.com\n\nHow to add Polygon to MetaMask manually: Open MetaMask, click the network dropdown at the top (it may say Ethereum Mainnet), click Add Network, then Add a Network Manually. Enter the details above and click Save. Polygon will now appear in your network list.\n\nAutomatic switch: If you visit Arena Games while connected to a different network, the app will detect the mismatch and show a Switch to Polygon button. Clicking it triggers a network switch request in your wallet. Approve it and you are ready to play.\n\nWhy Polygon? Polygon offers transaction costs under $0.01, confirmation times of 2 to 5 seconds, and is fully EVM-compatible (meaning MetaMask and all Ethereum tools work on it without modification). These properties make it ideal for a real-time gaming platform where every second and every cent of gas costs matters.'
      },
      {
        title: 'MetaMask not connecting — step by step fixes',
        answer: 'If MetaMask is installed but not connecting to Arena Games, work through these steps in order.\n\nStep 1: Refresh the page. Browser extensions sometimes need a fresh page load to inject properly. Hard refresh with Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac).\n\nStep 2: Unlock MetaMask. Click the MetaMask extension icon in your browser toolbar. If it shows a password screen, enter your password to unlock the wallet. A locked MetaMask will not respond to connection requests from websites.\n\nStep 3: Check if MetaMask is connected to the site. In MetaMask, click the three dots or the connected sites option and check whether joinarena.space appears as a connected site. If not, click Connect Manually.\n\nStep 4: Disable conflicting extensions. Other browser extensions (ad blockers, privacy tools, other crypto wallets) can intercept wallet connection requests. Temporarily disable all other extensions and try connecting again.\n\nStep 5: Clear browser cache. Open your browser settings, go to Privacy and Security, clear cached files and cookies for the last hour. Reload the page and reconnect.\n\nStep 6: Try a different browser. MetaMask works best in Chrome or Firefox. If you are using Brave, disable Brave Wallet in settings since it can conflict with MetaMask.\n\nStep 7: Reinstall MetaMask. As a last resort, export your seed phrase, remove the extension, reinstall from metamask.io, and restore your wallet. This resolves corrupted extension states.\n\nIf none of these work, try WalletConnect as an alternative connection method.'
      },
      {
        title: 'WalletConnect not working',
        answer: 'WalletConnect is the connection method for mobile wallets and wallets that do not have a browser extension. If it is not working, here are the most common causes.\n\nQR code expired: WalletConnect QR codes expire after 60 seconds. If you took too long to scan or something interrupted the process, close the modal, click Connect Wallet again, and select WalletConnect to generate a fresh QR code. Scan it within 30 seconds.\n\nInternet connectivity: WalletConnect works by relaying data through a server between your browser session and your mobile wallet. Both devices must have a stable internet connection. If either device drops internet for even a moment during the handshake, the connection fails. Try connecting both to a reliable Wi-Fi network.\n\nOutdated wallet app: WalletConnect v2 (the current standard) requires wallet apps to have updated their integration. If your mobile wallet app is more than a few months old, update it from the App Store or Google Play and try again.\n\nWallet app in background: On iOS, background app refresh limits can cause the wallet app to not process the connection while in the background. Keep your wallet app in the foreground on your phone while approving the connection on your browser.\n\nTry a different wallet: If one wallet app is not working with WalletConnect, try another compatible one (MetaMask Mobile, Trust Wallet, Rainbow, Zerion). They all support WalletConnect v2.\n\nFirewall or VPN issues: Some corporate networks or VPNs block WebSocket connections, which WalletConnect relies on. Disconnect from the VPN and try again.'
      },
      {
        title: 'Transaction stuck or pending for too long',
        answer: 'On Polygon, a stuck transaction is unusual because blocks are produced every 2 seconds. But it does happen occasionally, and here is how to handle it.\n\nFirst, wait 5 minutes. Before taking any action, give the network time. Brief spikes in activity can cause temporary backlogs. Check the transaction on Polygonscan (polygonscan.com) by pasting your wallet address in the search bar. If the transaction appears as Pending on-chain, it is in the mempool and will likely confirm soon.\n\nIf still stuck after 5 minutes: The most likely cause is a very low gas price. The transaction was broadcast but miners are not prioritizing it.\n\nOption 1 — Speed Up: In MetaMask, go to Activity, find the pending transaction, and click Speed Up. This resubmits the same transaction with a higher gas price. It does not create a new transaction or change what you are doing. After confirming the speed-up, the transaction typically goes through within seconds.\n\nOption 2 — Cancel: If you want to abandon the transaction, click Cancel instead. This sends a zero-value replacement transaction with higher gas. Once the cancel confirms, the original transaction is voided.\n\nOption 3 — Reset Account: If you have multiple stuck transactions or a nonce ordering issue (a later transaction cannot confirm because an earlier one is blocked), go to MetaMask Settings, Advanced, Reset Account. This clears your local pending transaction queue. It does not affect your funds on the blockchain. After resetting, resubmit the transaction.\n\nImportant: Resetting your account in MetaMask only clears the local transaction history display and nonce tracker. It does not affect your actual wallet balance, your tokens, or any confirmed transactions.'
      },
      {
        title: 'Game result seems wrong — how to dispute',
        answer: 'Arena Games logs all game actions with cryptographic signatures so disputes can be investigated accurately. If you believe a game result was incorrect, here is what to do.\n\nFirst, check the round breakdown: On your Profile page under Game History, expand the match in question. Review the round-by-round breakdown to confirm what you believe went wrong. In some cases, a result that seemed wrong in the moment turns out to be correct when reviewed.\n\nIf you still believe it is incorrect: Email support@joinarena.space with the following information: your wallet address, the room code of the match (visible in your game history), the date and time of the match, and a description of what you believe happened incorrectly.\n\nWhat we investigate: For each game we retain the server log containing every player action with a timestamp, the random seed used for any chance elements, all bid and pick submissions with server receipt timestamps, and the final result calculation. We verify these against what the smart contract recorded on-chain.\n\nTimeline: We respond to all disputes within 48 hours. If a verified server error caused an incorrect result, a full refund is processed to your wallet. If the game result is confirmed as correct, we explain the log findings in detail.\n\nDeadline: Disputes must be submitted within 90 days of the game date. After 90 days, game logs are purged and investigation is no longer possible. Do not wait if you have a concern.'
      },
      {
        title: 'The page is loading slowly or not loading at all',
        answer: 'Arena Games connects to two external systems on load: the Polygon RPC endpoint (for blockchain data) and the Arena WebSocket server (for real-time matchmaking). Slowness is usually caused by one of these.\n\nStep 1: Check your internet connection. Run a speed test or try loading a different site. If your connection is slow or intermittent, that is the root cause. Try switching from Wi-Fi to mobile data or vice versa.\n\nStep 2: Check Polygon network status. Occasionally the public Polygon RPC endpoint (polygon-rpc.com) experiences high load. Visit polygonscan.com — if that loads slowly too, the Polygon RPC is the issue and will typically recover within minutes.\n\nStep 3: Clear cache and reload. Browser cache issues can cause stale scripts to load. Press Ctrl+Shift+R or Cmd+Shift+R for a hard reload. Alternatively, open the page in an Incognito/Private window to bypass cache entirely.\n\nStep 4: Try a different browser. If Arena Games loads normally in another browser, the issue is a browser-specific extension or setting interfering with the app.\n\nStep 5: Disable VPN or proxy. VPNs route your traffic through additional servers and can significantly increase latency to the WebSocket server. Try connecting without a VPN.\n\nStep 6: Check WebSocket support. Arena Games requires WebSocket connections for real-time game functionality. Some corporate or school networks block WebSockets. If you are on such a network, you will need to switch to a personal connection.'
      },
    ],
  },
]

function getAllArticles() {
  return CATEGORIES.flatMap(c => c.articles.map(a => ({ ...a, category: c.name, color: c.color })))
}

interface ArticleItemProps {
  title: string; answer: string; isOpen: boolean
  onToggle: () => void; badge?: string; badgeColor?: string
}

function ArticleItem({ title, answer, isOpen, onToggle, badge, badgeColor }: ArticleItemProps) {
  return (
    <div style={{
      background: isOpen ? 'rgba(245,158,11,0.04)' : 'rgba(255,255,255,0.03)',
      border: `1px solid ${isOpen ? 'rgba(245,158,11,0.28)' : 'rgba(255,255,255,0.07)'}`,
      borderRadius: '12px', overflow: 'hidden',
      transition: 'all .18s',
      boxShadow: isOpen ? '0 4px 24px rgba(245,158,11,0.07)' : 'none',
    }}>
      <button onClick={onToggle} style={{
        width: '100%', background: 'transparent', border: 'none',
        cursor: 'pointer', padding: '16px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', textAlign: 'left',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
          {badge && badgeColor && (
            <span style={{
              background: `${badgeColor}14`, color: badgeColor,
              border: `1px solid ${badgeColor}28`,
              fontSize: '0.58rem', fontWeight: 700,
              padding: '2px 8px', borderRadius: '5px', whiteSpace: 'nowrap', flexShrink: 0, letterSpacing: '0.05em',
            }}>{badge}</span>
          )}
          <span style={{ color: '#e2e8f0', fontSize: '0.87rem', fontWeight: 600, lineHeight: 1.45, fontFamily: 'system-ui,sans-serif' }}>{title}</span>
        </div>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none"
          style={{ flexShrink: 0, transition: 'transform .22s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          <path d="M5 7.5l5 5 5-5" stroke={isOpen ? '#f59e0b' : '#475569'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {isOpen && (
        <div style={{ padding: '0 20px 20px', borderTop: '1px solid rgba(245,158,11,0.1)' }}>
          {answer.split('\n\n').map((para, i) => (
            <p key={i} style={{ margin: i === 0 ? '14px 0 0' : '12px 0 0', color: '#94a3b8', fontSize: '0.85rem', lineHeight: 1.85, fontFamily: 'system-ui,sans-serif', whiteSpace: 'pre-line' }}>{para}</p>
          ))}
        </div>
      )}
    </div>
  )
}

export default function HelpCenter() {
  const nav = useNavigate()
  const [search, setSearch] = useState('')
  const [openKey, setOpenKey] = useState<string | null>(null)

  const allArticles = getAllArticles()
  const isSearching = search.trim().length > 0
  const filtered = isSearching
    ? allArticles.filter(a => a.title.toLowerCase().includes(search.toLowerCase()) || a.answer.toLowerCase().includes(search.toLowerCase()))
    : []

  return (
    <div style={{ minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* Hero */}
      <div style={{
        background: 'linear-gradient(135deg, #0f0820 0%, #080d1a 60%, #06060e 100%)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '48px 20px 56px',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Glow orbs */}
        <div style={{ position: 'absolute', top: '-80px', left: '10%', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(245,158,11,0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '-60px', right: '15%', width: '200px', height: '200px', background: 'radial-gradient(circle, rgba(99,102,241,0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ maxWidth: '780px', margin: '0 auto', position: 'relative' }}>
          <button onClick={() => nav(-1)} style={{
            display: 'inline-flex', alignItems: 'center', gap: '7px',
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '9px', padding: '8px 16px', cursor: 'pointer',
            color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600, marginBottom: '32px', transition: 'all .14s',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.09)'; e.currentTarget.style.color = '#e2e8f0' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#94a3b8' }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M10 12.5L5.5 8 10 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Back
          </button>

          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '28px' }}>
            <div>
              <div style={{
                display: 'inline-block', background: 'rgba(245,158,11,0.1)',
                border: '1px solid rgba(245,158,11,0.25)', borderRadius: '8px',
                padding: '4px 14px', fontSize: '0.6rem', fontWeight: 800,
                letterSpacing: '0.12em', color: '#fbbf24', textTransform: 'uppercase', marginBottom: '16px',
              }}>Help Center</div>
              <h1 style={{
                fontFamily: 'Orbitron, sans-serif', fontWeight: 900,
                fontSize: 'clamp(1.5rem, 4vw, 2.2rem)',
                color: '#f1f5f9', margin: '0 0 10px', letterSpacing: '0.01em',
              }}>Find answers fast.</h1>
              <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0, lineHeight: 1.6 }}>
                Browse by category or search across all {allArticles.length} articles.
              </p>
            </div>

            {/* Search */}
            <div style={{ position: 'relative', width: '100%', maxWidth: '340px' }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
                style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                <circle cx="11" cy="11" r="8" stroke="#475569" strokeWidth="2"/>
                <path d="M21 21l-4.35-4.35" stroke="#475569" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <input
                type="text" placeholder="Search articles..."
                value={search} onChange={e => setSearch(e.target.value)}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '10px', padding: '12px 16px 12px 44px',
                  fontSize: '0.88rem', color: '#e2e8f0',
                  fontFamily: 'inherit', outline: 'none',
                  transition: 'border-color .14s',
                }}
                onFocus={e => (e.currentTarget.style.borderColor = 'rgba(245,158,11,0.4)')}
                onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)')}
              />
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '780px', margin: '0 auto', padding: '40px 20px 80px' }}>

        {/* Search results */}
        {isSearching && (
          <div>
            <p style={{ color: '#64748b', fontSize: '0.82rem', marginBottom: '14px', fontWeight: 500 }}>
              {filtered.length === 0
                ? 'No results found. Try different keywords.'
                : `${filtered.length} result${filtered.length !== 1 ? 's' : ''} for "${search}"`}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {filtered.map(a => {
                const k = `search-${a.title}`
                return (
                  <ArticleItem key={k} title={a.title} answer={a.answer}
                    badge={a.category} badgeColor={a.color}
                    isOpen={openKey === k}
                    onToggle={() => setOpenKey(openKey === k ? null : k)} />
                )
              })}
            </div>
          </div>
        )}

        {/* Category list */}
        {!isSearching && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '36px' }}>
            {CATEGORIES.map(cat => (
              <div key={cat.name}>
                {/* Category header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '9px',
                    background: `${cat.color}14`, border: `1px solid ${cat.color}28`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                      <path d={cat.icon} stroke={cat.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <h2 style={{
                    margin: 0, color: '#cbd5e1',
                    fontFamily: 'system-ui,sans-serif', fontWeight: 800,
                    fontSize: '0.75rem', letterSpacing: '0.1em', textTransform: 'uppercase',
                  }}>{cat.name}</h2>
                  <div style={{ height: '1px', flex: 1, background: 'rgba(255,255,255,0.06)' }} />
                  <span style={{
                    background: 'rgba(255,255,255,0.06)', color: '#64748b',
                    border: '1px solid rgba(255,255,255,0.08)',
                    fontSize: '0.7rem', borderRadius: '20px', padding: '2px 10px',
                  }}>{cat.articles.length}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {cat.articles.map(a => {
                    const k = `${cat.name}-${a.title}`
                    return (
                      <ArticleItem key={k} title={a.title} answer={a.answer}
                        isOpen={openKey === k}
                        onToggle={() => setOpenKey(openKey === k ? null : k)} />
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer CTA */}
        <div style={{
          marginTop: '56px',
          background: 'linear-gradient(135deg, rgba(245,158,11,0.07) 0%, rgba(249,115,22,0.04) 100%)',
          border: '1px solid rgba(245,158,11,0.2)',
          borderRadius: '18px', padding: '32px',
          textAlign: 'center',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, transparent, #f59e0b, transparent)' }} />
          <div style={{
            width: '44px', height: '44px', borderRadius: '13px',
            background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div style={{
            color: '#fbbf24', fontSize: '0.72rem', fontWeight: 800,
            letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px',
          }}>Still need help?</div>
          <p style={{ color: '#64748b', fontSize: '0.87rem', marginBottom: '20px', lineHeight: 1.6 }}>
            ARIA can answer most questions instantly.
          </p>
          <button onClick={() => nav('/contact')} style={{
            background: 'linear-gradient(135deg,#f97316,#ef4444)',
            color: 'white', border: 'none', borderRadius: '10px',
            padding: '12px 32px',
            fontFamily: 'Orbitron, sans-serif', fontSize: '0.62rem',
            fontWeight: 800, letterSpacing: '0.08em', cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(249,115,22,0.4)',
            transition: 'transform .14s, box-shadow .14s',
          }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(249,115,22,0.5)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(249,115,22,0.4)' }}
          >
            Chat with ARIA
          </button>
        </div>
      </div>
    </div>
  )
}
