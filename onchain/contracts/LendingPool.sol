// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IStockValuation {
    /// @notice 回傳 tokenAmount 顆股票代幣的 TWD(6 位)估值(以預言機即時價)
    function previewRedeem(uint256 tokenAmount) external view returns (uint256);
}

/**
 * @title LendingPool
 * @notice 台股 RWA 借貸池(對標 Aave/Compound 迷你版)。
 *         出借方存入 TWD 賺利息;借款方質押台股代幣,依預言機估值借出 TWD。
 *         利率隨資金使用率浮動,利息以指數累積(borrowIndex)。
 *         健康因子 < 1(10000 bps)即可被清算,清算人享折價獎勵。
 *
 *  前端可讀 view:getPoolStats / getUserAccount / getUserDeposit / userCollateralOf。
 */
contract LendingPool is Ownable {
    uint256 private constant WAD = 1e18;
    uint256 private constant BPS = 10000;
    uint256 private constant SECONDS_PER_YEAR = 365 days;

    IERC20 public immutable twd;

    // 風險參數(全域,簡化)
    uint256 public ltvBps = 5000;             // 可借成數 50%
    uint256 public liqThresholdBps = 6500;    // 清算門檻 65%
    uint256 public liqBonusBps = 500;         // 清算獎勵 5%

    // 利率模型(WAD 年化):borrowRate = base + slope * 使用率
    uint256 public baseRatePerYear = 2e16;    // 2%
    uint256 public slopePerYear = 20e16;      // 滿載再 +20%

    // 借款側
    uint256 public totalBorrows;              // 含已累積利息
    uint256 public borrowIndex = WAD;
    uint64 public lastAccrual;
    mapping(address => uint256) public borrowPrincipal;  // 用戶借款本金(快照時)
    mapping(address => uint256) public borrowSnapshotIndex;

    // 出借側(份額制,匯率隨利息成長)
    uint256 public totalDepositShares;
    mapping(address => uint256) public depositShares;

    // 抵押品
    mapping(address => bool) public isCollateral;
    address[] public collateralList;
    mapping(address => mapping(address => uint256)) public userCollateral; // user => token => amount
    mapping(address => address[]) private userTokens;
    mapping(address => mapping(address => bool)) private userHasToken;

    event Deposit(address indexed user, uint256 amount, uint256 shares);
    event Withdraw(address indexed user, uint256 amount, uint256 shares);
    event SupplyCollateral(address indexed user, address indexed token, uint256 amount);
    event WithdrawCollateral(address indexed user, address indexed token, uint256 amount);
    event Borrow(address indexed user, uint256 amount);
    event Repay(address indexed user, uint256 amount);
    event Liquidate(address indexed liquidator, address indexed user, address indexed token, uint256 repaidTWD, uint256 seized);
    event CollateralListed(address indexed token);

    constructor(address twd_, address owner_) Ownable(owner_) {
        twd = IERC20(twd_);
        lastAccrual = uint64(block.timestamp);
    }

    // ---------- 管理 ----------
    function addCollateral(address token) external onlyOwner {
        if (!isCollateral[token]) {
            isCollateral[token] = true;
            collateralList.push(token);
            emit CollateralListed(token);
        }
    }
    function setRiskParams(uint256 ltv, uint256 liqThreshold, uint256 liqBonus) external onlyOwner {
        require(ltv <= liqThreshold && liqThreshold <= BPS, "bad params");
        ltvBps = ltv; liqThresholdBps = liqThreshold; liqBonusBps = liqBonus;
    }

    // ---------- 利息累積 ----------
    function accrue() public {
        uint256 dt = block.timestamp - lastAccrual;
        if (dt > 0) {
            if (totalBorrows > 0) {
                uint256 ratePerYear = borrowRatePerYear();
                uint256 factor = ratePerYear * dt / SECONDS_PER_YEAR;      // 期間利率(WAD)
                uint256 interest = totalBorrows * factor / WAD;
                totalBorrows += interest;
                borrowIndex += borrowIndex * factor / WAD;
            }
            lastAccrual = uint64(block.timestamp);
        }
    }

    function cash() public view returns (uint256) { return twd.balanceOf(address(this)); }

    function utilizationWad() public view returns (uint256) {
        uint256 c = cash();
        uint256 denom = c + totalBorrows;
        if (denom == 0) return 0;
        return totalBorrows * WAD / denom;
    }
    function borrowRatePerYear() public view returns (uint256) {
        return baseRatePerYear + slopePerYear * utilizationWad() / WAD;
    }
    function supplyRatePerYear() public view returns (uint256) {
        // 出借年化 ≈ 借款年化 × 使用率
        return borrowRatePerYear() * utilizationWad() / WAD;
    }
    function exchangeRateWad() public view returns (uint256) {
        if (totalDepositShares == 0) return WAD;
        return (cash() + totalBorrows) * WAD / totalDepositShares;
    }

    // ---------- 出借 TWD ----------
    function depositTWD(uint256 amount) external {
        require(amount > 0, "amount=0");
        accrue();
        uint256 shares = amount * WAD / exchangeRateWad();
        require(shares > 0, "too small");
        require(twd.transferFrom(msg.sender, address(this), amount), "TWD in failed");
        depositShares[msg.sender] += shares;
        totalDepositShares += shares;
        emit Deposit(msg.sender, amount, shares);
    }
    function withdrawTWD(uint256 amount) external {
        require(amount > 0, "amount=0");
        accrue();
        uint256 shares = (amount * WAD + exchangeRateWad() - 1) / exchangeRateWad(); // 無條件進位
        require(shares <= depositShares[msg.sender], "insufficient shares");
        require(cash() >= amount, "insufficient liquidity");
        depositShares[msg.sender] -= shares;
        totalDepositShares -= shares;
        require(twd.transfer(msg.sender, amount), "TWD out failed");
        emit Withdraw(msg.sender, amount, shares);
    }
    function getUserDeposit(address user) public view returns (uint256) {
        return depositShares[user] * exchangeRateWad() / WAD;
    }

    // ---------- 抵押 / 借款 ----------
    function supplyCollateral(address token, uint256 amount) external {
        require(isCollateral[token], "not collateral");
        require(amount > 0, "amount=0");
        require(IERC20(token).transferFrom(msg.sender, address(this), amount), "collateral in failed");
        userCollateral[msg.sender][token] += amount;
        if (!userHasToken[msg.sender][token]) {
            userHasToken[msg.sender][token] = true;
            userTokens[msg.sender].push(token);
        }
        emit SupplyCollateral(msg.sender, token, amount);
    }
    function withdrawCollateral(address token, uint256 amount) external {
        require(userCollateral[msg.sender][token] >= amount, "exceeds collateral");
        accrue();
        userCollateral[msg.sender][token] -= amount;
        require(healthFactorBps(msg.sender) >= BPS, "would be unhealthy");
        require(IERC20(token).transfer(msg.sender, amount), "collateral out failed");
        emit WithdrawCollateral(msg.sender, token, amount);
    }

    function borrowTWD(uint256 amount) external {
        require(amount > 0, "amount=0");
        accrue();
        require(cash() >= amount, "insufficient liquidity");
        uint256 newDebt = debtOf(msg.sender) + amount;
        require(newDebt <= maxBorrowTWD(msg.sender), "exceeds borrow limit");
        _setDebt(msg.sender, newDebt);
        totalBorrows += amount;
        require(twd.transfer(msg.sender, amount), "TWD out failed");
        emit Borrow(msg.sender, amount);
    }
    function repay(uint256 amount) external {
        accrue();
        uint256 debt = debtOf(msg.sender);
        uint256 pay = amount > debt ? debt : amount;
        require(pay > 0, "nothing to repay");
        require(twd.transferFrom(msg.sender, address(this), pay), "TWD in failed");
        _setDebt(msg.sender, debt - pay);
        totalBorrows = totalBorrows > pay ? totalBorrows - pay : 0;
        emit Repay(msg.sender, pay);
    }

    // ---------- 清算 ----------
    function liquidate(address user, address token, uint256 repayAmount) external {
        accrue();
        require(healthFactorBps(user) < BPS, "healthy");
        uint256 debt = debtOf(user);
        uint256 pay = repayAmount > debt ? debt : repayAmount;
        require(pay > 0, "nothing");
        // 依預言機價換算可沒收的抵押(含清算獎勵)
        uint256 seizeValue = pay * (BPS + liqBonusBps) / BPS;             // TWD(6)
        uint256 collAmt = userCollateral[user][token];
        uint256 collValue = IStockValuation(token).previewRedeem(collAmt); // TWD(6)
        require(collValue > 0, "no collateral value");
        uint256 seize = collAmt * seizeValue / collValue;
        if (seize > collAmt) seize = collAmt;
        require(twd.transferFrom(msg.sender, address(this), pay), "TWD in failed");
        _setDebt(user, debt - pay);
        totalBorrows = totalBorrows > pay ? totalBorrows - pay : 0;
        userCollateral[user][token] -= seize;
        require(IERC20(token).transfer(msg.sender, seize), "seize transfer failed");
        emit Liquidate(msg.sender, user, token, pay, seize);
    }

    // ---------- 估值 / 風險 view ----------
    function debtOf(address user) public view returns (uint256) {
        uint256 p = borrowPrincipal[user];
        if (p == 0) return 0;
        return p * borrowIndex / borrowSnapshotIndex[user];
    }
    function _setDebt(address user, uint256 newDebt) internal {
        borrowPrincipal[user] = newDebt;
        borrowSnapshotIndex[user] = borrowIndex;
    }
    function collateralValueTWD(address user) public view returns (uint256 total) {
        address[] storage toks = userTokens[user];
        for (uint256 i = 0; i < toks.length; i++) {
            uint256 amt = userCollateral[user][toks[i]];
            if (amt > 0) total += IStockValuation(toks[i]).previewRedeem(amt);
        }
    }
    function maxBorrowTWD(address user) public view returns (uint256) {
        return collateralValueTWD(user) * ltvBps / BPS;
    }
    function borrowableTWD(address user) external view returns (uint256) {
        uint256 max = maxBorrowTWD(user);
        uint256 debt = debtOf(user);
        return max > debt ? max - debt : 0;
    }
    /// @return 健康因子(bps,10000 = 1.0;< 10000 可被清算)
    function healthFactorBps(address user) public view returns (uint256) {
        uint256 debt = debtOf(user);
        if (debt == 0) return type(uint256).max;
        return collateralValueTWD(user) * liqThresholdBps / debt;
    }

    function getUserAccount(address user) external view returns (
        uint256 collateralTWD, uint256 debtTWD, uint256 borrowable, uint256 hfBps
    ) {
        collateralTWD = collateralValueTWD(user);
        debtTWD = debtOf(user);
        uint256 max = collateralTWD * ltvBps / BPS;
        borrowable = max > debtTWD ? max - debtTWD : 0;
        hfBps = debtTWD == 0 ? type(uint256).max : collateralTWD * liqThresholdBps / debtTWD;
    }
    function getPoolStats() external view returns (
        uint256 cash_, uint256 borrows, uint256 totalLiquidity,
        uint256 utilBps, uint256 borrowAprBps, uint256 supplyAprBps
    ) {
        cash_ = cash();
        borrows = totalBorrows;
        totalLiquidity = cash_ + borrows;
        utilBps = utilizationWad() * BPS / WAD;
        borrowAprBps = borrowRatePerYear() * BPS / WAD;
        supplyAprBps = supplyRatePerYear() * BPS / WAD;
    }
    function userTokenList(address user) external view returns (address[] memory) {
        return userTokens[user];
    }
}
