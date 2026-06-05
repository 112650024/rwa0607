const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("RWA 台股代幣化", function () {
  let twd, oracle, factory, token, owner, user;
  const SYM = "2330";
  const sym32 = () => ethers.encodeBytes32String(SYM);

  beforeEach(async () => {
    [owner, user] = await ethers.getSigners();
    twd = await (await ethers.getContractFactory("MockTWD")).deploy();
    oracle = await (await ethers.getContractFactory("PriceOracle")).deploy();
    factory = await (await ethers.getContractFactory("StockFactory"))
      .deploy(await twd.getAddress(), await oracle.getAddress());

    // 台積電 2355.00 → price=235500, dec=2
    await oracle.updatePrice(sym32(), 235500, 2);
    await factory.createStock(sym32(), "Digitized TSMC", "dTSMC");
    token = await ethers.getContractAt("StockToken", await factory.tokenOf(sym32()));
  });

  it("預言機:非授權者不可餵價", async () => {
    await expect(oracle.connect(user).updatePrice(sym32(), 1, 2)).to.be.revertedWith("Oracle: not feeder");
  });

  it("工廠:重複上架同一檔會 revert", async () => {
    await expect(factory.createStock(sym32(), "x", "x")).to.be.revertedWith("Factory: exists");
  });

  it("依預言機價鑄造:2355 TWD = 1 股 dTSMC", async () => {
    const TWD6 = 10n ** 6n;
    const buyTwd = 2355n * TWD6;                 // 2355 TWD(6 位)
    // 領 TWD
    await twd.connect(user).mintTWD(10000n);     // 10000 TWD
    expect(await twd.balanceOf(user.address)).to.equal(10000n * TWD6);
    // previewMint 應為 1e18
    expect(await token.previewMint(buyTwd)).to.equal(10n ** 18n);
    // approve + mint
    await twd.connect(user).approve(await token.getAddress(), buyTwd);
    await token.connect(user).mint(buyTwd);
    expect(await token.balanceOf(user.address)).to.equal(10n ** 18n);   // 1 股
    expect(await token.totalTwdReserve()).to.equal(buyTwd);
    expect(await token.getCollateralRatio()).to.equal(100n);            // 足額擔保
  });

  it("贖回:燒代幣退回 TWD", async () => {
    const TWD6 = 10n ** 6n;
    const buyTwd = 2355n * TWD6;
    await twd.connect(user).mintTWD(10000n);
    await twd.connect(user).approve(await token.getAddress(), buyTwd);
    await token.connect(user).mint(buyTwd);

    await token.connect(user).redeem(10n ** 18n);                       // 贖回 1 股
    expect(await token.balanceOf(user.address)).to.equal(0n);
    expect(await token.totalTwdReserve()).to.equal(0n);
    expect(await twd.balanceOf(user.address)).to.equal(10000n * TWD6);  // TWD 全數退回
  });

  it("價格變動會反映在估值(漲價→抵押不足 100%)", async () => {
    const TWD6 = 10n ** 6n;
    const buyTwd = 2355n * TWD6;
    await twd.connect(user).mintTWD(10000n);
    await twd.connect(user).approve(await token.getAddress(), buyTwd);
    await token.connect(user).mint(buyTwd);
    // 台積電漲到 2500 → 同樣 1 股現值更高,儲備相對不足
    await oracle.updatePrice(sym32(), 250000, 2);
    expect(await token.getCollateralRatio()).to.be.lessThan(100n);
  });

  it("黑名單:被封鎖地址不能買", async () => {
    const buyTwd = 2355n * 10n ** 6n;
    await twd.connect(user).mintTWD(10000n);
    await twd.connect(user).approve(await token.getAddress(), buyTwd);
    await token.connect(owner).setBlacklist(user.address, true);
    expect(await token.blacklisted(user.address)).to.equal(true);
    await expect(token.connect(user).mint(buyTwd)).to.be.revertedWith("recipient blacklisted");
  });

  it("暫停:owner 暫停後不能鑄造,解除後恢復", async () => {
    const buyTwd = 2355n * 10n ** 6n;
    await twd.connect(user).mintTWD(10000n);
    await twd.connect(user).approve(await token.getAddress(), buyTwd);
    await token.connect(owner).pause();
    await expect(token.connect(user).mint(buyTwd)).to.be.revertedWithCustomError(token, "EnforcedPause");
    await token.connect(owner).unpause();
    await token.connect(user).mint(buyTwd);
    expect(await token.balanceOf(user.address)).to.equal(10n ** 18n);
  });

  it("KYC 可標記、可讀,且不擋交易(預設開放)", async () => {
    expect(await token.kycVerified(user.address)).to.equal(false);
    await token.connect(owner).setKyc(user.address, true);
    expect(await token.kycVerified(user.address)).to.equal(true);
    const buyTwd = 2355n * 10n ** 6n;
    await twd.connect(user).mintTWD(10000n);
    await twd.connect(user).approve(await token.getAddress(), buyTwd);
    await token.connect(user).mint(buyTwd);            // 未 KYC 也能買
    expect(await token.balanceOf(user.address)).to.equal(10n ** 18n);
  });

  it("權限:非 owner 不能設黑名單 / 暫停", async () => {
    await expect(token.connect(user).setBlacklist(user.address, true)).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
    await expect(token.connect(user).pause()).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
  });
});
