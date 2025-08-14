import 'dotenv/config';
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 }
    }
  },
  paths: {
    sources: "src",
  },
  networks: {
    monad: {
      url: process.env.RPC_URL || "",
      chainId: process.env.CHAIN_ID ? Number(process.env.CHAIN_ID) : undefined,
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : undefined,
    }
  }
};

export default config;

