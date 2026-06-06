/* v2:在 Etherscan(Sepolia)驗證所有已部署合約原始碼。
 * 需 .env 的 ETHERSCAN_API_KEY。用法:npm run verify:sepolia */
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function verify(address, args) {
  try {
    await hre.run("verify:verify", { address, constructorArguments: args });
    console.log("✅ verified:", address);
  } catch (e) {
    const msg = (e.message || "").split("\n")[0];
    if (/already verified/i.test(msg)) console.log("➖ 已驗證:", address);
    else console.log("⚠️ 失敗:", address, "-", msg);
  }
}

async function main() {
  const { ethers } = hre;
  const file = path.join(__dirname, "..", "deployed.json");
  if (!fs.existsSync(file)) throw new Error("找不到 deployed.json,請先 npm run deploy:sepolia");
  const d = JSON.parse(fs.readFileSync(file));
  const C = d.contracts;
  const [deployer] = await ethers.getSigners();   // = StockToken / Lending / IPO 的 owner

  console.log("驗證基礎合約…");
  await verify(C.twd.address, [deployer.address]);
  await verify(C.oracle.address, []);
  await verify(C.factory.address, [C.twd.address, C.oracle.address]);
  await verify(C.lending.address, [C.twd.address, deployer.address]);
  await verify(C.ipo.address, [C.twd.address, deployer.address]);

  console.log("驗證各台股代幣…");
  for (const s of d.stocks) {
    await verify(s.token, [s.name, s.tokenSymbol, C.twd.address, C.oracle.address, ethers.encodeBytes32String(s.code), deployer.address]);
  }
  console.log("完成。到 sepolia.etherscan.io 查看綠勾與 Read Contract 分頁。");
}
main().catch((e) => { console.error(e); process.exit(1); });
