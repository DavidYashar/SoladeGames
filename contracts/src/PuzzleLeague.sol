// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/** Minimal ERC-20 surface used by the league. */
interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

/**
 * @title PuzzleLeague
 * @notice Daily skill-game league escrow on Arc. Players pay a USDC entry fee
 *         per day + tier. The owner (game server) settles each league with the
 *         verified winner list. Split: 60% winners / 25% NFT holder pool /
 *         15% platform. Winners pull their share via claim().
 */
contract PuzzleLeague {
    address public immutable usdc;
    address public owner;
    address public holderPool;
    address public platformFee;

    uint256 public constant BPS = 10_000;
    uint256 public constant PRIZE_BPS = 6_000; // 60%
    uint256 public constant HOLDER_BPS = 2_500; // 25%
    uint256 public constant PLATFORM_BPS = 1_500; // 15%

    /// Tiers: 0 = Copper (0.10), 1 = Silver (0.50), 2 = Gold (1.00) in USDC units.
    uint256[3] public entryFees;

    struct LeagueState {
        uint256 pot; // total collected entries
        uint256 entries;
        bool settled;
        uint256 prizePool;
        uint256 holderShare;
        uint256 platformShare;
    }

    mapping(uint256 day => mapping(uint8 tier => LeagueState)) public leagues;
    mapping(uint256 day => mapping(uint8 tier => mapping(address => bool))) public entered;
    mapping(uint256 day => mapping(uint8 tier => mapping(address => uint256))) public winnings;

    event Entered(uint256 indexed day, uint8 indexed tier, address indexed player, uint256 fee);
    event Settled(uint256 indexed day, uint8 indexed tier, address[] winners, uint256 perWinner);
    event Claimed(uint256 indexed day, uint8 indexed tier, address indexed player, uint256 amount);
    event SplitsUpdated(address holderPool, address platformFee);
    event EntryFeeUpdated(uint8 tier, uint256 fee);

    constructor(address _usdc, address _holderPool, address _platformFee) {
        require(_usdc != address(0), "zero usdc");
        require(_holderPool != address(0), "zero holder");
        require(_platformFee != address(0), "zero platform");
        usdc = _usdc;
        holderPool = _holderPool;
        platformFee = _platformFee;
        owner = msg.sender;
        entryFees = [100_000, 500_000, 1_000_000];
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    function enter(uint256 day, uint8 tier) external {
        require(tier < 3, "bad tier");
        LeagueState storage s = leagues[day][tier];
        require(!s.settled, "settled");
        require(!entered[day][tier][msg.sender], "already entered");
        uint256 fee = entryFees[tier];

        // Checks-effects-interactions.
        entered[day][tier][msg.sender] = true;
        s.pot += fee;
        s.entries += 1;

        require(IERC20(usdc).transferFrom(msg.sender, address(this), fee), "transfer failed");
        emit Entered(day, tier, msg.sender, fee);
    }

    function settle(uint256 day, uint8 tier, address[] calldata winners) external onlyOwner {
        require(tier < 3, "bad tier");
        LeagueState storage s = leagues[day][tier];
        require(!s.settled, "already settled");
        require(s.entries > 0, "no entries");
        require(winners.length > 0, "no winners");
        require(winners.length <= s.entries, "too many winners");

        // Mark settled before external transfers (reentrancy guard).
        s.settled = true;
        s.prizePool = (s.pot * PRIZE_BPS) / BPS;
        s.holderShare = (s.pot * HOLDER_BPS) / BPS;
        s.platformShare = s.pot - s.prizePool - s.holderShare;

        uint256 per = s.prizePool / winners.length;
        for (uint256 i = 0; i < winners.length; i++) {
            address w = winners[i];
            require(w != address(0), "zero winner");
            require(entered[day][tier][w], "not entrant");
            for (uint256 j = 0; j < i; j++) {
                require(winners[j] != w, "dup winner");
            }
            winnings[day][tier][w] += per;
        }

        if (s.holderShare > 0) {
            require(IERC20(usdc).transfer(holderPool, s.holderShare), "holder transfer");
        }
        if (s.platformShare > 0) {
            require(IERC20(usdc).transfer(platformFee, s.platformShare), "fee transfer");
        }
        emit Settled(day, tier, winners, per);
    }

    function claim(uint256 day, uint8 tier) external {
        uint256 amount = winnings[day][tier][msg.sender];
        require(amount > 0, "nothing");
        winnings[day][tier][msg.sender] = 0;
        require(IERC20(usdc).transfer(msg.sender, amount), "claim transfer");
        emit Claimed(day, tier, msg.sender, amount);
    }

    function setSplits(address _holderPool, address _platformFee) external onlyOwner {
        require(_holderPool != address(0), "zero holder");
        require(_platformFee != address(0), "zero platform");
        holderPool = _holderPool;
        platformFee = _platformFee;
        emit SplitsUpdated(_holderPool, _platformFee);
    }

    function setEntryFee(uint8 tier, uint256 fee) external onlyOwner {
        require(tier < 3, "bad tier");
        entryFees[tier] = fee;
        emit EntryFeeUpdated(tier, fee);
    }

    /* ---------- views ---------- */

    function pot(uint256 day, uint8 tier) external view returns (uint256) {
        return leagues[day][tier].pot;
    }

    function entries(uint256 day, uint8 tier) external view returns (uint256) {
        return leagues[day][tier].entries;
    }

    function settled(uint256 day, uint8 tier) external view returns (bool) {
        return leagues[day][tier].settled;
    }

    function prizeOf(address player, uint256 day, uint8 tier) external view returns (uint256) {
        return winnings[day][tier][player];
    }
}
