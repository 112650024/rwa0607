/* 在 Etherscan(Sepolia)驗證所有已部署合約原始碼。
 * 需 .env 的 ETHERSCAN_API_KEY(etherscan.io 同一把 V2 金鑰即可)。
 * 用法:npm run verify:sepolia   (等同 npx hardhat run scripts/verify.js --network sepolia) */
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
  const [deployer] = await ethers.getSigners();   // = 各 StockToken 的 owner

  console.log("驗證基礎合約…");
  await verify(d.twd, []);
  await verify(d.oracle, []);
  await verify(d.factory, [d.twd, d.oracle]);

  console.log("驗證各台股代幣…");
  for (const s of d.stocks) {
    await verify(s.token, [s.name, s.tokenSymbol, d.twd, d.oracle, ethers.encodeBytes32String(s.code), deployer.address]);
  }
  console.log("完成。到 sepolia.etherscan.io 查看綠勾與 Read Contract 分頁。");
}
main().catch((e) => { console.error(e); process.exit(1); });
