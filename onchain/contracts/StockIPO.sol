// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title StockIPO
 * @notice 台股代幣「新股認購(IPO)」。發行人預先把代幣庫存放進本合約,
 *         於認購窗口內以固定 IPO 價格收 TWD 認購;
 *         足額/不足額 → 依出資買到對應股數;超額 → pro-rata 配額並退還溢繳 TWD。
 *         結束後認購人 claim() 領股 + 退款。對標台股「抽籤/配額」體驗。
 *
 *  前端 view:getOffering / userPosition / offeringCount。
 */
contract StockIPO is Ownable {
    uint256 private constant ONE = 1e18;

    IERC20 public immutable twd;

    struct Offering {
        address token;          // 認購的台股代幣(18 位)
        uint256 priceTWD;       // 每「股」(1e18 代幣)認購價,TWD(6 位)
        uint256 totalShares;    // 釋出庫存(1e18 計)
        uint64 start;
        uint64 end;
        uint256 totalRaisedTWD; // 累計認購金額
        uint256 sharesSold;     // 已配出股數(claim 時累計)
        uint256 proceedsTWD;    // 發行人可提領之認購所得(claim 時累計)
        bool finalized;
    }

    Offering[] public offerings;
    mapping(uint256 => mapping(address => uint256)) public paidTWD;  // id => user => 出資
    mapping(uint256 => mapping(address => bool)) public claimed;

    event OfferingCreated(uint256 indexed id, address indexed token, uint256 priceTWD, uint256 totalShares, uint64 start, uint64 end);
    event Subscribed(uint256 indexed id, address indexed user, uint256 twdAmount);
    event Finalized(uint256 indexed id, uint256 totalRaisedTWD);
    event Claimed(uint256 indexed id, address indexed user, uint256 shares, uint256 refundTWD);

    constructor(address twd_, address owner_) Ownable(owner_) {
        twd = IERC20(twd_);
    }

    function offeringCount() external view returns (uint256) { return offerings.length; }

    /// @notice 發行人建立認購案。需先 approve 本合約可動用 totalShares 庫存。
    function createOffering(
        address token, uint256 priceTWD, uint256 totalShares, uint64 start, uint64 end
    ) external onlyOwner returns (uint256 id) {
        require(token != address(0) && priceTWD > 0 && totalShares > 0, "bad args");
        require(end > start && end > block.timestamp, "bad window");
        require(IERC20(token).transferFrom(msg.sender, address(this), totalShares), "inventory in failed");
        id = offerings.length;
        offerings.push(Offering(token, priceTWD, totalShares, start, end, 0, 0, 0, false));
        emit OfferingCreated(id, token, priceTWD, totalShares, start, end);
    }

    /// @notice 認購窗口內以 TWD 認購。
    function subscribe(uint256 id, uint256 twdAmount) external {
        Offering storage o = offerings[id];
        require(block.timestamp >= o.start, "not started");
        require(block.timestamp <= o.end, "ended");
        require(twdAmount > 0, "amount=0");
        require(twd.transferFrom(msg.sender, address(this), twdAmount), "TWD in failed");
        paidTWD[id][msg.sender] += twdAmount;
        o.totalRaisedTWD += twdAmount;
        emit Subscribed(id, msg.sender, twdAmount);
    }

    function finalize(uint256 id) public {
        Offering storage o = offerings[id];
        require(block.timestamp > o.end, "not ended");
        require(!o.finalized, "finalized");
        o.finalized = true;
        emit Finalized(id, o.totalRaisedTWD);
    }

    /// @return offeringValueTWD 滿額募資金額(= totalShares × price)
    function offeringValueTWD(uint256 id) public view returns (uint256) {
        Offering storage o = offerings[id];
        return o.totalShares * o.priceTWD / ONE;
    }

    /// @return shares 應得股數 refund 應退 TWD
    function _entitlement(uint256 id, address user) internal view returns (uint256 shares, uint256 refund) {
        Offering storage o = offerings[id];
        uint256 paid = paidTWD[id][user];
        if (paid == 0) return (0, 0);
        uint256 maxRaise = offeringValueTWD(id);
        if (o.totalRaisedTWD <= maxRaise) {
            // 足額/不足額:出資全買股,只退整除餘額
            shares = paid * ONE / o.priceTWD;
        } else {
            // 超額:pro-rata 配額
            shares = o.totalShares * paid / o.totalRaisedTWD;
        }
        uint256 cost = shares * o.priceTWD / ONE;
        refund = paid > cost ? paid - cost : 0;
    }

    /// @notice 結束後領取配發代幣 + 退還溢繳 TWD。
    function claim(uint256 id) external {
        Offering storage o = offerings[id];
        if (!o.finalized) finalize(id);
        require(!claimed[id][msg.sender], "claimed");
        (uint256 shares, uint256 refund) = _entitlement(id, msg.sender);
        require(shares > 0 || refund > 0, "nothing");
        claimed[id][msg.sender] = true;
        o.sharesSold += shares;
        o.proceedsTWD += (paidTWD[id][msg.sender] - refund);
        if (shares > 0) require(IERC20(o.token).transfer(msg.sender, shares), "shares out failed");
        if (refund > 0) require(twd.transfer(msg.sender, refund), "refund failed");
        emit Claimed(id, msg.sender, shares, refund);
    }

    // ---------- 發行人提領 ----------
    function ownerWithdrawProceeds(uint256 id) external onlyOwner {
        Offering storage o = offerings[id];
        require(o.finalized, "not finalized");
        uint256 amt = o.proceedsTWD;
        o.proceedsTWD = 0;
        require(twd.transfer(msg.sender, amt), "proceeds out failed");
    }
    function ownerReclaimUnsold(uint256 id) external onlyOwner {
        Offering storage o = offerings[id];
        require(o.finalized, "not finalized");
        uint256 unsold = o.totalShares - o.sharesSold;
        require(unsold > 0, "none");
        o.totalShares = o.sharesSold; // 防重複領回
        require(IERC20(o.token).transfer(msg.sender, unsold), "unsold out failed");
    }

    // ---------- 前端 view ----------
    // status: 0=即將開始 1=認購中 2=已結束待定案 3=已定案
    function getOffering(uint256 id) external view returns (
        address token, uint256 priceTWD, uint256 totalShares, uint64 start, uint64 end,
        uint256 totalRaisedTWD, uint256 maxRaiseTWD, uint256 allocationBps, uint8 status
    ) {
        Offering storage o = offerings[id];
        token = o.token; priceTWD = o.priceTWD; totalShares = o.totalShares;
        start = o.start; end = o.end; totalRaisedTWD = o.totalRaisedTWD;
        maxRaiseTWD = offeringValueTWD(id);
        allocationBps = (o.totalRaisedTWD > maxRaiseTWD && o.totalRaisedTWD > 0)
            ? maxRaiseTWD * 10000 / o.totalRaisedTWD : 10000;
        if (block.timestamp < o.start) status = 0;
        else if (block.timestamp <= o.end) status = 1;
        else if (!o.finalized) status = 2;
        else status = 3;
    }

    function userPosition(uint256 id, address user) external view returns (
        uint256 paid, uint256 estShares, uint256 estRefund, bool didClaim
    ) {
        paid = paidTWD[id][user];
        (estShares, estRefund) = _entitlement(id, user);
        didClaim = claimed[id][user];
    }
}
