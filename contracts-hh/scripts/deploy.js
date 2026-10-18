// Deploys DaanSetu and writes the address + ABI into the web app.
//   npx hardhat run scripts/deploy.js --network sepolia
// Env:
//   VOTING_PERIOD_SECONDS   default 259200 (3 days). Use e.g. 300 for a quick demo.
//   INACTIVITY_PERIOD_SECONDS default 2592000 (30 days).
const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

async function main() {
  const voting = BigInt(process.env.VOTING_PERIOD_SECONDS || 3 * 24 * 3600);
  const idle = BigInt(process.env.INACTIVITY_PERIOD_SECONDS || 30 * 24 * 3600);
  const [deployer] = await hre.ethers.getSigners();
  if (!deployer) throw new Error("No deployer account. Set PRIVATE_KEY in contracts-hh/.env");

  const { chainId } = await hre.ethers.provider.getNetwork();
  const bal = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`Network ${hre.network.name} (chainId ${chainId})`);
  console.log(`Deployer ${deployer.address}  balance ${hre.ethers.formatEther(bal)}`);

  const factory = await hre.ethers.getContractFactory("DaanSetu");
  const ds = await factory.deploy(voting, idle);
  const receipt = await ds.deploymentTransaction().wait();
  const address = await ds.getAddress();
  console.log(`DaanSetu deployed at ${address} (block ${receipt.blockNumber})`);
  console.log(`Voting period ${voting}s, inactivity period ${idle}s`);

  const outDir = path.join(__dirname, "..", "..", "web", "src", "contracts");
  fs.mkdirSync(outDir, { recursive: true });
  const depFile = path.join(outDir, "deployments.json");
  const deployments = fs.existsSync(depFile) ? JSON.parse(fs.readFileSync(depFile, "utf8")) : {};
  deployments[chainId.toString()] = {
    network: hre.network.name,
    address,
    deployBlock: receipt.blockNumber,
    deployedAt: new Date().toISOString(),
  };
  fs.writeFileSync(depFile, JSON.stringify(deployments, null, 2) + "\n");

  const artifact = await hre.artifacts.readArtifact("DaanSetu");
  fs.writeFileSync(path.join(outDir, "DaanSetu.abi.json"), JSON.stringify(artifact.abi, null, 2) + "\n");
  console.log(`Wrote ${path.relative(process.cwd(), depFile)} and ABI`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
