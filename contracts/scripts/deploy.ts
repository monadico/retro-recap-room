import { ethers, upgrades } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  const Achievements = await ethers.getContractFactory("Achievements1155Upgradeable");
  const name = "the capsule honor badges";
  const symbol = "CAPSULE-HONOR";
  const baseURI = process.env.BASE_URI || "https://example.com/achievements/";
  const admin = process.env.ADMIN || deployer.address;
  const signer = process.env.SIGNER || deployer.address;

  const proxy = await upgrades.deployProxy(
    Achievements,
    [name, symbol, baseURI, admin, signer],
    { initializer: "initialize", kind: "uups" }
  );
  await proxy.waitForDeployment();
  console.log("Achievements1155 proxy:", await proxy.getAddress());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

