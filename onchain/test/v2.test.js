const { expect } = require("chai");
const { ethers, network } = require("hardhat");

const TWD6 = 10n ** 6n;
const ONE = 10n ** 18n;
const SYM = "2330";
const sym32 = () => ethers.encodeBytes32String(SYM);

let twd, oracle, factory, token, owner, alice, bob;

async function deployCore() {
  [owner, alice, bob] = await ethers.getSigners();
  twd = await (await ethers.getContractFactory("RegulatedTWD")).deploy(owner.address);
  oracle = await (await ethers.getContractFactory("PriceOracle")).deploy();
  factory = await (await ethers.getContractFactory("StockFactory"))
    .deploy(await twd.getAddress(), await oracle.getAddress());
  await oracle.updatePrice(sym32(), 100000, 2); // 1000.00 TWD/股
  await factory.createStock(sym32(), "Digitized TSMC", "dTSMC");
  token = await ethers.getContractAt("StockToken", await factory.tokenOf(sym32()));
}

describe("RegulatedTWD(受監管穩定幣)", () => {
  beforeEach(deployCore);

  it("水龍頭鑄造同步儲備,維持 100% 足額", async () => {
    await twd.connect(alice).mintTWD(100000n);
    expect(await twd.balanceOf(alice.address)).to.equal(100000n * TWD6);
    expect(await twd.reserveRatioBps()).to.equal(10000n);
    expect(await twd.isFullyReserved()).to.equal(true);
  });

  it("儲備簽證:僅 ATTESTOR 可呼叫,且更新時間戳", async () => {
    await expect(twd.connect(alice).attestReserves(1n, ethers.ZeroHash))
      .to.be.revertedWithCustomError(twd, "AccessControlUnauthorizedAccount");
    await twd.attestReserves(500000n * TWD6, ethers.id("report-2026-06"));
    expect(await twd.reserveAttestedTWD()).to.equal(500000n * TWD6);
    expect(await twd.lastAttestationAt()).to.be.greaterThan(0n);
  });

  it("凍結地址不可轉帳;暫停時全面停止", async () => {
    await twd.connect(alice).mintTWD(100n);
    await twd.setFrozen(alice.address, true);
    await expect(twd.connect(alice).transfer(bob.address, 1n)).to.be.revertedWith("TWD: sender frozen");
    await twd.setFrozen(alice.address, false);
    await twd.pause();
    await expect(twd.connect(alice).mintTWD(1n)).to.be.revertedWithCustomError(twd, "EnforcedPause");
    await twd.unpause();
    await twd.connect(alice).transfer(bob.address, 1n); // 解除後可動
  });

  it("持有人贖回:燒幣並降低儲備", async () => {
    await twd.connect(alice).mintTWD(100000n);
    await twd.connect(alice).requestRedemption(40000n * TWD6);
    expect(await twd.balanceOf(alice.address)).to.equal(60000n * TWD6);
    expect(await twd.redemptionCount()).to.equal(1n);
  });
});

describe("LendingPool(借貸池)", () => {
  let pool;
  beforeEach(async () => {
    await deployCore();
    pool = await (await ethers.getContractFactory("LendingPool"))
      .deploy(await twd.getAddress(), owner.address);
    await pool.addCollateral(await token.getAddress());
  });

  it("出借 TWD → 份額估值約等於存入額", async () => {
    await twd.connect(alice).mintTWD(1000000n);
    await twd.connect(alice).approve(await pool.getAddress(), 1000000n * TWD6);
    await pool.connect(alice).depositTWD(500000n * TWD6);
    expect(await pool.getUserDeposit(alice.address)).to.be.closeTo(500000n * TWD6, 100n);
  });

  it("質押台股 → 依 LTV 借 TWD;超額被擋;跌價可清算", async () => {
    // 出借方提供流動性
    await twd.connect(alice).mintTWD(1000000n);
    await twd.connect(alice).approve(await pool.getAddress(), 1000000n * TWD6);
    await pool.connect(alice).depositTWD(500000n * TWD6);

    // 借款方買 10 股 dTSMC(10×1000=10000 TWD)並質押
    await twd.connect(bob).mintTWD(20000n);
    await twd.connect(bob).approve(await token.getAddress(), 20000n * TWD6);
    await token.connect(bob).mint(10000n * TWD6);
    const shares = await token.balanceOf(bob.address);
    expect(shares).to.equal(10n * ONE);
    await token.connect(bob).approve(await pool.getAddress(), shares);
    await pool.connect(bob).supplyCollateral(await token.getAddress(), shares);

    const acct = await pool.getUserAccount(bob.address);
    expect(acct.collateralTWD).to.be.closeTo(10000n * TWD6, TWD6);

    await pool.connect(bob).borrowTWD(4000n * TWD6);                       // LTV 50% → 上限 5000
    await expect(pool.connect(bob).borrowTWD(2000n * TWD6)).to.be.revertedWith("exceeds borrow limit");

    // 跌到 500 → 抵押 5000,清算門檻 65% → 3250 < 債 4000 → HF<1
    await oracle.updatePrice(sym32(), 50000, 2);
    expect(await pool.healthFactorBps(bob.address)).to.be.lessThan(10000n);

    await twd.connect(alice).approve(await pool.getAddress(), 1000000n * TWD6);
    const debtBefore = await pool.debtOf(bob.address);
    await pool.connect(alice).liquidate(bob.address, await token.getAddress(), 1000n * TWD6);
    expect(await pool.debtOf(bob.address)).to.be.lessThan(debtBefore);
  });
});

describe("StockIPO(新股認購)", () => {
  let ipo;
  beforeEach(async () => {
    await deployCore();
    ipo = await (await ethers.getContractFactory("StockIPO"))
      .deploy(await twd.getAddress(), owner.address);
  });

  it("超額認購 → pro-rata 配額 + 退溢繳款", async () => {
    // 發行人備 100 股庫存(100×1000=100000 TWD)
    await twd.mintTWD(200000n);
    await twd.approve(await token.getAddress(), 200000n * TWD6);
    await token.mint(100000n * TWD6);
    const inv = await token.balanceOf(owner.address);
    expect(inv).to.equal(100n * ONE);
    await token.approve(await ipo.getAddress(), inv);

    const now = (await ethers.provider.getBlock("latest")).timestamp;
    await ipo.createOffering(await token.getAddress(), 800n * TWD6, inv, now + 2, now + 1000); // IPO 折價 800
    await network.provider.send("evm_increaseTime", [5]);
    await network.provider.send("evm_mine");

    // alice 40000、bob 120000 → 共 160000;滿額募資 80000 → 超額 2×
    await twd.connect(alice).mintTWD(40000n);
    await twd.connect(alice).approve(await ipo.getAddress(), 40000n * TWD6);
    await ipo.connect(alice).subscribe(0, 40000n * TWD6);
    await twd.connect(bob).mintTWD(120000n);
    await twd.connect(bob).approve(await ipo.getAddress(), 120000n * TWD6);
    await ipo.connect(bob).subscribe(0, 120000n * TWD6);

    await network.provider.send("evm_increaseTime", [1001]);
    await network.provider.send("evm_mine");
    await ipo.finalize(0);

    const posA = await ipo.userPosition(0, alice.address);
    expect(posA.estShares).to.equal(25n * ONE);          // 100 × 40000/160000
    expect(posA.estRefund).to.equal(20000n * TWD6);      // 付40000 - 買25股×800=20000

    await ipo.connect(alice).claim(0);
    expect(await token.balanceOf(alice.address)).to.equal(25n * ONE);
  });
});
