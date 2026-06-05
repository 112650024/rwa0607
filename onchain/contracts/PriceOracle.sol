// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title PriceOracle
 * @notice 台股價格預言機(可信餵價者模式):授權的 feeder 把鏈下真實股價寫上鏈。
 *         以 bytes32 股票代號為 key(例如 "2330")。價格以整數 + decimals 表示
 *         (例如 2355.00 → price=235500, decimals=2)。
 *         提供 Chainlink AggregatorV3 風格的 latestPrice,未來可無痛替換為去中心化預言機。
 */
contract PriceOracle {
    struct Round {
        int256 price;
        uint8 decimals;
        uint64 updatedAt;
    }

    address public owner;
    mapping(address => bool) public feeders;
    mapping(bytes32 => Round) private _rounds;

    event PriceUpdated(bytes32 indexed symbol, int256 price, uint8 decimals, uint64 updatedAt);
    event FeederSet(address indexed feeder, bool allowed);

    modifier onlyOwner() { require(msg.sender == owner, "Oracle: not owner"); _; }
    modifier onlyFeeder() { require(feeders[msg.sender], "Oracle: not feeder"); _; }

    constructor() {
        owner = msg.sender;
        feeders[msg.sender] = true;
        emit FeederSet(msg.sender, true);
    }

    function setFeeder(address feeder, bool allowed) external onlyOwner {
        feeders[feeder] = allowed;
        emit FeederSet(feeder, allowed);
    }

    /// @notice 單檔更新
    function updatePrice(bytes32 symbol, int256 price, uint8 decimals_) public onlyFeeder {
        require(price > 0, "Oracle: price<=0");
        _rounds[symbol] = Round(price, decimals_, uint64(block.timestamp));
        emit PriceUpdated(symbol, price, decimals_, uint64(block.timestamp));
    }

    /// @notice 批次更新(全市場餵價用,省 gas)。所有價格共用同一 decimals。
    function updatePrices(bytes32[] calldata symbols, int256[] calldata prices, uint8 decimals_) external onlyFeeder {
        require(symbols.length == prices.length, "Oracle: length mismatch");
        uint64 ts = uint64(block.timestamp);
        for (uint256 i = 0; i < symbols.length; i++) {
            require(prices[i] > 0, "Oracle: price<=0");
            _rounds[symbols[i]] = Round(prices[i], decimals_, ts);
            emit PriceUpdated(symbols[i], prices[i], decimals_, ts);
        }
    }

    function latestPrice(bytes32 symbol) external view returns (int256 price, uint8 decimals, uint64 updatedAt) {
        Round memory r = _rounds[symbol];
        require(r.updatedAt > 0, "Oracle: no price");
        return (r.price, r.decimals, r.updatedAt);
    }

    function hasPrice(bytes32 symbol) external view returns (bool) {
        return _rounds[symbol].updatedAt > 0;
    }
}
