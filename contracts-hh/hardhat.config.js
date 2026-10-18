require("@nomicfoundation/hardhat-chai-matchers");
require("@nomicfoundation/hardhat-ethers");
require("dotenv").config();
const path = require("path");
const { subtask } = require("hardhat/config");
const { TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD } = require("hardhat/builtin-tasks/task-names");

// Use the solc compiler bundled from npm (solcjs) so no compiler download is needed.
// Set USE_NATIVE_SOLC=1 to let Hardhat download the native compiler instead.
// Handy on networks that block binaries.soliditylang.org.
if (process.env.USE_NATIVE_SOLC !== "1") {
  subtask(TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD, async (args, hre, runSuper) => {
    if (args.solcVersion === "0.8.24") {
      return {
        compilerPath: path.join(__dirname, "node_modules", "solc", "soljson.js"),
        isSolcJs: true,
        version: args.solcVersion,
        longVersion: "0.8.24+commit.e11b9ed9",
      };
    }
    return runSuper();
  });
}

const { PRIVATE_KEY, SEPOLIA_RPC_URL, AMOY_RPC_URL, ETHERSCAN_API_KEY } = process.env;
const accounts = PRIVATE_KEY ? [PRIVATE_KEY.startsWith("0x") ? PRIVATE_KEY : `0x${PRIVATE_KEY}`] : [];

module.exports = {
  solidity: {
    version: "0.8.24",
    settings: { optimizer: { enabled: true, runs: 200 }, viaIR: true },
  },
  networks: {
    hardhat: { chainId: 31337 },
    localhost: { url: "http://127.0.0.1:8545", chainId: 31337 },
    sepolia: {
      url: SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com",
      chainId: 11155111,
      accounts,
    },
    amoy: {
      url: AMOY_RPC_URL || "https://rpc-amoy.polygon.technology",
      chainId: 80002,
      accounts,
    },
  },
};
