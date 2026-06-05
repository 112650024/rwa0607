// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./StockToken.sol";

/**
 * @title StockFactory
 * @notice 量產台股代幣:每呼叫一次 createStock 就部署一個 StockToken,
 *         全部共用同一 TWD 與 PriceOracle。前端可用 getAllStocks 列出所有已上架代幣。
 */
contract StockFactory {
    address public owner;
    address public immutable twd;
    address public immutable oracle;

    address[] public allStocks;
    mapping(bytes32 => address) public tokenOf;   // 股票代號 → 代幣地址

    event StockCreated(bytes32 indexed symbol, address token, string name, string tokenSymbol);

    modifier onlyOwner() { require(msg.sender == owner, "Factory: not owner"); _; }

    constructor(address twd_, address oracle_) {
        require(twd_ != address(0) && oracle_ != address(0), "zero addr");
        owner = msg.sender;
        twd = twd_;
        oracle = oracle_;
    }

    function createStock(bytes32 symbol, string memory name, string memory tokenSymbol) external onlyOwner returns (address) {
        require(tokenOf[symbol] == address(0), "Factory: exists");
        StockToken t = new StockToken(name, tokenSymbol, twd, oracle, symbol, owner);
        tokenOf[symbol] = address(t);
        allStocks.push(address(t));
        emit StockCreated(symbol, address(t), name, tokenSymbol);
        return address(t);
    }

    function getAllStocks() external view returns (address[] memory) {
        return allStocks;
    }

    function stockCount() external view returns (uint256) {
        return allStocks.length;
    }
}
