import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const baseURI = process.env.METADATA_BASE_URI || "http://localhost:3001";
  const TheCanva = await ethers.getContractFactory("TheCanvaNFT");
  const canva = await TheCanva.deploy(baseURI);
  await canva.waitForDeployment();
  const address = await canva.getAddress();
  console.log("TheCanvaNFT deployed:", address);

  // Write address for backend to consume
  try {
    const repoRoot = path.resolve(__dirname, "..", "..");
    const backendPath = path.join(repoRoot, "backend", "canva-contract-address.txt");
    fs.writeFileSync(backendPath, address);
    console.log("Wrote contract address to:", backendPath);
  } catch (e) {
    console.warn("Warning: failed to write backend address file:", e);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

