import { ethers, upgrades } from "hardhat";

async function main() {
  const addr = process.env.CONTRACT_ADDRESS;
  if (!addr) throw new Error('Set CONTRACT_ADDRESS');

  const Achievements = await ethers.getContractFactory("Achievements1155Upgradeable");
  const proxy = Achievements.attach(addr);

  const txs = [];
  // id, enabled, soulbound, uri
  txs.push(await (await proxy.setAchievement(1, true, true, `${process.env.BASE_URI || "https://example.com/achievements/"}1.json`)).wait());
  txs.push(await (await proxy.setAchievement(2, true, true, `${process.env.BASE_URI || "https://example.com/achievements/"}2.json`)).wait());
  txs.push(await (await proxy.setAchievement(3, true, true, `${process.env.BASE_URI || "https://example.com/achievements/"}3.json`)).wait());
  txs.push(await (await proxy.setAchievement(4, true, true, `${process.env.BASE_URI || "https://example.com/achievements/"}4.json`)).wait());
  txs.push(await (await proxy.setAchievement(5, true, true, `${process.env.BASE_URI || "https://example.com/achievements/"}5.json`)).wait());

  console.log('Initialized achievements 1-5');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

