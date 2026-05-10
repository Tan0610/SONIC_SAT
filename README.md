# Sonic IP Loops

Sonic IP Loops is a Filecoin Calibration dApp for recording audio loops, uploading metadata to IPFS with Lighthouse, minting audio NFTs, and listing them on an on-chain marketplace.

![Next.js](https://img.shields.io/badge/Next.js-15.3-black)
![Filecoin](https://img.shields.io/badge/Filecoin-Calibration-blue)
![IPFS](https://img.shields.io/badge/IPFS-Lighthouse-green)
![Solidity](https://img.shields.io/badge/Solidity-0.8.24-purple)

## Features

- Record audio in the browser and upload it to IPFS.
- Mint an ERC-721 token with IPFS metadata.
- List, buy, and cancel marketplace listings on-chain.
- View owned tokens in a collection dashboard.
- Connect with RainbowKit and WalletConnect.

## Tech Stack

- Next.js 15.3 App Router
- TypeScript
- Wagmi + Viem + RainbowKit
- Hardhat + OpenZeppelin
- Lighthouse IPFS uploads
- Filecoin Calibration network

## Project Structure

- `app/` - App Router pages for store, marketplace, buyer, and collection views.
- `components/` - Shared UI components.
- `contracts/` - `SonicVoiceNFT` and `SonicVoiceMarketplace` Solidity contracts.
- `hooks/` - Marketplace and collection hooks.
- `lib/` - ABI, IPFS, metadata, and gateway helpers.
- `scripts/` - Deployment scripts.
- `deployments/` - Deployment metadata written by the deploy script.

## Getting Started

### Prerequisites

- Node.js 22+
- npm
- A Filecoin Calibration wallet with tFIL
- Lighthouse API key
- WalletConnect project ID

### Install

```bash
npm install
```

### Environment Variables

Create a `.env.local` file in the project root:

```env
PRIVATE_KEY=your_deployer_private_key
NEXT_PUBLIC_NFT_ADDRESS=0x...
NEXT_PUBLIC_MARKETPLACE_ADDRESS=0x...
NEXT_PUBLIC_DEPLOY_BLOCK=123456
NEXT_PUBLIC_CHAIN_ID=314159
NEXT_PUBLIC_FILECOIN_RPC=https://api.calibration.node.glif.io/rpc/v1
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=your_walletconnect_project_id
NEXT_PUBLIC_LIGHTHOUSE_API_KEY=your_lighthouse_api_key
```

Do not commit `PRIVATE_KEY`.

### Run Locally

```bash
npm run dev
```

Open http://localhost:3000

## Usage

### Mint and List

1. Open `/store`.
2. Record audio.
3. Upload the audio and metadata to IPFS.
4. Mint the NFT.
5. Approve the marketplace and list the token for sale.

### Buy a Listing

1. Open `/marketplace`.
2. Connect a buyer wallet.
3. Preview the listing if available.
4. Click Buy to purchase the NFT on-chain.

### Cancel a Listing

1. Open `/collection`.
2. Find a token you listed.
3. Click Cancel listing.

## Deployment

### Compile Contracts

```bash
npm run compile
```

### Deploy to Filecoin Calibration

```bash
npm run deploy:calibration
```

The script writes deployment details to `deployments/calibration.json` and prints the values to copy into `.env.local`.

### Frontend Build

```bash
npm run build
```

## Supported Networks

- Filecoin Calibration
- Filecoin Mainnet

## Vercel Deployment

1. Push your branch to GitHub.
2. Import the repo into Vercel.
3. Add the same `NEXT_PUBLIC_*` variables from `.env.local`.
4. Do not add `PRIVATE_KEY` to Vercel.
5. Deploy with the default Next.js build settings.

## Acknowledgments

- Lighthouse
- IPFS
- Filecoin
- RainbowKit
- Wagmi
- OpenZeppelin




