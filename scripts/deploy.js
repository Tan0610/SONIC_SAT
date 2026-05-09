const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const { ethers, network } = hre;

  const [deployer] = await ethers.getSigners();
  console.log(`Deploying with account: ${deployer.address}`);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Account balance: ${ethers.formatEther(balance)} ETH`);

  // -- Deploy SonicVoiceNFT --
  console.log("\nDeploying SonicVoiceNFT...");
  const NFT = await ethers.getContractFactory("SonicVoiceNFT");
  const nft = await NFT.deploy(deployer.address);
  await nft.waitForDeployment();
  const nftAddress = nft.target;
  const nftDeployTx = nft.deploymentTransaction();
  const nftReceipt = await nftDeployTx.wait();
  const nftDeployBlock = nftReceipt.blockNumber;
  console.log(`SonicVoiceNFT deployed to: ${nftAddress} (block ${nftDeployBlock})`);

  // -- Deploy SonicVoiceMarketplace --
  console.log("\nDeploying SonicVoiceMarketplace...");
  const Marketplace = await ethers.getContractFactory("SonicVoiceMarketplace");
  const marketplace = await Marketplace.deploy(nftAddress);
  await marketplace.waitForDeployment();
  const marketplaceAddress = marketplace.target;
  const marketplaceDeployTx = marketplace.deploymentTransaction();
  const marketplaceReceipt = await marketplaceDeployTx.wait();
  const marketplaceDeployBlock = marketplaceReceipt.blockNumber;
  console.log(
    `SonicVoiceMarketplace deployed to: ${marketplaceAddress} (block ${marketplaceDeployBlock})`
  );

  const deployBlock = Math.min(nftDeployBlock, marketplaceDeployBlock);

  // -- Resolve chainId --
  let chainId = 314159;
  try {
    const net = await ethers.provider.getNetwork();
    chainId = Number(net.chainId);
  } catch (_) {
    // fall back to default
  }

  // -- Persist deployments/calibration.json --
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  const outFile = path.join(deploymentsDir, "calibration.json");
  const record = {
    nftAddress,
    marketplaceAddress,
    chainId,
    deployBlock,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
  };
  fs.writeFileSync(outFile, JSON.stringify(record, null, 2));
  console.log(`\nWrote ${outFile}`);

  console.log("\n=====================================================");
  console.log("SUCCESS - Paste these into .env.local:");
  console.log("=====================================================");
  console.log(`NEXT_PUBLIC_NFT_ADDRESS=${nftAddress}`);
  console.log(`NEXT_PUBLIC_MARKETPLACE_ADDRESS=${marketplaceAddress}`);
  console.log(`NEXT_PUBLIC_DEPLOY_BLOCK=${deployBlock}`);
  console.log(`NEXT_PUBLIC_CHAIN_ID=${chainId}`);
  console.log("=====================================================");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error during deployment:", error);
    process.exit(1);
  });
