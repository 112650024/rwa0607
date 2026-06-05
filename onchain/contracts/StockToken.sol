// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

interface IPriceOracle {
    function latestPrice(bytes32 symbol) external view returns (int256 price, uint8 decimals, uint64 updatedAt);
}

/**
 * @title StockToken
 * @notice 由「預言機即時價」定價的台股代幣(ERC-20,18 位)。以 TWD(6 位)鑄造/贖回。
 *         監管能力(供 RegTech 展示):
 *           - 黑名單 blacklisted:預設全開放,owner 可封鎖地址(不能買/賣/轉)。
 *           - KYC 註冊表 kycVerified:owner 可標記、Etherscan 可查;不擋交易(保持開放)。
 *           - 暫停 pause/unpause:僅 owner,暫停時停止鑄造/贖回。
 *         owner = 部署者錢包(由工廠帶入),可直接在 Etherscan write tab 操作。
 */
contract StockToken is ERC20, Ownable, Pausable {
    IERC20 public immutable twd;
    IPriceOracle public immutable oracle;
    bytes32 public immutable stockSymbol;   // 例如 "2330"
    uint8 public constant TWD_DECIMALS = 6;

    uint256 public maxPriceAge = 30 days;
    uint256 public totalTwdReserve;

    mapping(address => bool) public blacklisted;   // true = 被封鎖
    mapping(address => bool) public kycVerified;    // true = 已通過 KYC(僅展示,不擋交易)

    event Minted(address indexed user, uint256 twdAmount, uint256 tokenAmount, uint256 reserve);
    event Redeemed(address indexed user, uint256 tokenAmount, uint256 twdAmount, uint256 reserve);
    event BlacklistUpdated(address indexed account, bool blocked);
    event KycUpdated(address indexed account, bool verified);

    constructor(string memory name_, string memory symbol_, address twd_, address oracle_, bytes32 stockSymbol_, address owner_)
        ERC20(name_, symbol_)
        Ownable(owner_)
    {
        require(twd_ != address(0) && oracle_ != address(0), "zero addr");
        twd = IERC20(twd_);
        oracle = IPriceOracle(oracle_);
        stockSymbol = stockSymbol_;
    }

    // ---- 監管控制(僅 owner)----
    function setBlacklist(address account, bool blocked) external onlyOwner {
        blacklisted[account] = blocked;
        emit BlacklistUpdated(account, blocked);
    }
    function setKyc(address account, bool verified) external onlyOwner {
        kycVerified[account] = verified;
        emit KycUpdated(account, verified);
    }
    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
    function setMaxPriceAge(uint256 a) external onlyOwner { maxPriceAge = a; }

    // ---- 定價(讀預言機)----
    function pricePerShare() public view returns (uint256) {
        (int256 p, uint8 dec, uint64 ts) = oracle.latestPrice(stockSymbol);
        require(p > 0, "bad price");
        require(block.timestamp - ts <= maxPriceAge, "stale price");
        return uint256(p) * (10 ** TWD_DECIMALS) / (10 ** dec);
    }
    function previewMint(uint256 twdAmount) public view returns (uint256) { return twdAmount * 1e18 / pricePerShare(); }
    function previewRedeem(uint256 tokenAmount) public view returns (uint256) { return tokenAmount * pricePerShare() / 1e18; }

    // ---- 鑄造 / 贖回(暫停時禁止)----
    function mint(uint256 twdAmount) external whenNotPaused {
        require(twdAmount > 0, "amount=0");
        require(twd.transferFrom(msg.sender, address(this), twdAmount), "TWD in failed");
        uint256 tokenAmount = previewMint(twdAmount);
        require(tokenAmount > 0, "too small");
        totalTwdReserve += twdAmount;
        _mint(msg.sender, tokenAmount);
        emit Minted(msg.sender, twdAmount, tokenAmount, totalTwdReserve);
    }
    function redeem(uint256 tokenAmount) external whenNotPaused {
        require(tokenAmount > 0, "amount=0");
        require(balanceOf(msg.sender) >= tokenAmount, "insufficient balance");
        uint256 twdAmount = previewRedeem(tokenAmount);
        require(twdAmount > 0, "too small");
        require(totalTwdReserve >= twdAmount, "insufficient reserve");
        _burn(msg.sender, tokenAmount);
        totalTwdReserve -= twdAmount;
        require(twd.transfer(msg.sender, twdAmount), "TWD out failed");
        emit Redeemed(msg.sender, tokenAmount, twdAmount, totalTwdReserve);
    }

    // ---- 黑名單:封鎖地址不可轉入/轉出(含鑄造/銷毀對象)----
    function _update(address from, address to, uint256 value) internal override {
        require(!blacklisted[from], "sender blacklisted");
        require(!blacklisted[to], "recipient blacklisted");
        super._update(from, to, value);
    }

    // ---- views(前端 / 簡報展示)----
    function getReserveStatus() external view returns (uint256 reserve, uint256 supply, uint256 actualBalance) {
        return (totalTwdReserve, totalSupply(), twd.balanceOf(address(this)));
    }
    function getCollateralRatio() external view returns (uint256) {
        uint256 supply = totalSupply();
        if (supply == 0) return 0;
        uint256 supplyValue = previewRedeem(supply);
        if (supplyValue == 0) return 0;
        return totalTwdReserve * 100 / supplyValue;
    }
}
