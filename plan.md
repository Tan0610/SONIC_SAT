SONIC_SAT — On-Chain Marketplace Conversion                                                                                              
     
     Context                                                                                                                                  
                                                                                                                                                   Why this change. SONIC_SAT is a Next.js dApp for the Filecoin bounty: creators record audio loops, store them on Filecoin via IPFS       
     (Lighthouse), and license them to buyers as NFTs. A diagnostic pass found that the marketplace is currently a frontend simulation —           listings live only in localStorage, the deployed contract at 0xc50dd07ae5CdE4B1bFf213881b87180e22e34A9c only stores raw CIDs (no 
     marketplace logic), handleTokenize fakes the mint with a setTimeout(2000), and Buy is an alert(). Three Solidity stubs exist                  (lib/SonicVoice*.sol) but are empty. lib/sonicVoiceService.ts references undeployed contract addresses ("YOUR_DEPLOYED_...") and uses the
      ethers v5 API even though the project ships ethers v6 — so it's dead code.                                                              
                                                                                                                                                   Outcome. Creators mint a real ERC-721 backed by an IPFS metadata JSON (uploaded via Lighthouse) and list it for sale on a real           
     marketplace contract. Buyers see active listings read from chain, click Buy, send tFIL, and receive the NFT. Buyers' owned tokens appear
     under /collection. Chain: Filecoin Calibration (FVM-EVM, already configured in app/providers.tsx:14-24, aligns with the bounty). Audio   
     CIDs remain public — buying transfers ownership/commercial-use license, not access exclusivity. Two-step flow: mint, then optionally     
     list. Zero marketplace fee for MVP. No ERC721Enumerable — /collection uses Transfer event log scanning via viem getLogs.

     Metadata JSON schema (pinned)

     tokenURI resolves to a JSON document at ipfs://<metadata-cid> with this exact shape. Both the mint helper and every renderer (buyer page,
      marketplace page, collection page, MarketplaceCard) read against this contract.

     {
       "schema_version": 1,
       "name": "string (non-empty, <=120 chars)",
       "description": "string (<=2000 chars)",
       "audio_cid": "raw CID, no scheme prefix",
       "audio_uri": "ipfs://<audio_cid>",
       "mime_type": "audio/webm | audio/mpeg | audio/wav",
       "duration_seconds": 0,
       "size_bytes": 0,
       "creator": "0x… (lowercased, EIP-55-checksum optional)",
       "created_at": "ISO 8601 UTC, e.g. 2026-05-08T14:23:00.000Z",
       "price_hint": { "amount": "string (decimal)", "currency": "tFIL" }
     }

     Notes:
     - price_hint is informational only — the on-chain Listing.price is the source of truth for any actual sale.
     - Renderers MUST tolerate missing price_hint (older listings) and missing mime_type (fallback to audio/webm).
     - The creator field MUST equal the wallet that signed the mint tx (verified at render time against the Minted event's to field for       
     trust).
     - schema_version: 1 is the only supported value today; renderers ignore unknown versions with a warning.

     A small helper at lib/listingMetadata.ts exports the TypeScript type, a Zod-style validator, and buildMetadata({ ... }) so the schema    
     lives in one place.

     Files to modify or create

     Contracts (new, in contracts/ because hardhat.config.js sets paths.sources: "./contracts")

     - contracts/SonicVoiceNFT.sol — ERC-721 + URIStorage + Ownable (OpenZeppelin v5). Single mint(address to, string tokenURI_) returns      
     (uint256) open to anyone. Emits Minted(uint256 tokenId, address to, string tokenURI). Standard tokenURI / supportsInterface overrides per
      OZ v5.
     - contracts/SonicVoiceMarketplace.sol — ReentrancyGuard. Holds IERC721 immutable nft. struct Listing { address seller; uint256 price;    
     bool active; } mapped by tokenId. Maintains uint256[] _activeTokenIds + mapping(uint256=>uint256) _activeIndex for O(1) swap-and-pop     
     removal. Functions: listToken(uint256 tokenId, uint256 price) (caller must own + have approved this contract), cancelListing(uint256     
     tokenId) (seller-only), buyToken(uint256 tokenId) external payable nonReentrant (msg.value == price, safeTransferFrom, then
     seller.call{value: msg.value}("")), getActiveListings(uint256 offset, uint256 limit) view returns (uint256[] tokenIds, Listing[] data),  
     getListing(uint256) view, getActiveCount() view. Events: Listed, Cancelled, Sold.

     Hardhat & deploy

     - hardhat.config.js — confirm solidity: { version: "0.8.20", settings: { optimizer: { enabled: true, runs: 200 } } }. Calibration network
      entry already exists; no change needed there.
     - scripts/deploy.js — rewrite. Deploy SonicVoiceNFT; await waitForDeployment. Deploy SonicVoiceMarketplace(nft.target). Capture the      
     deployment block number from the SonicVoiceMarketplace deploy receipt (and equivalently for the NFT, taking the min of the two as        
     DEPLOY_BLOCK). Write deployments/calibration.json with both addresses, chainId, deploy block, and timestamps. Print
     NEXT_PUBLIC_NFT_ADDRESS=… / NEXT_PUBLIC_MARKETPLACE_ADDRESS=… / NEXT_PUBLIC_DEPLOY_BLOCK=… lines for paste-into-.env.local. Skip
     etherscan verify (Calibration uses Filfox).
     - package.json — add scripts: "compile": "hardhat compile", "test:contracts": "hardhat test", "deploy:calibration": "hardhat run
     scripts/deploy.js --network filecoinCalibration", "typecheck": "tsc --noEmit".

     Contract tests (new, in test/)

     - test/SonicVoiceNFT.test.js — covers: anyone can mint; Minted event is emitted with correct args; tokenURI returns the URI passed in;   
     _nextTokenId increments; tokenURI reverts on a non-existent token.
     - test/SonicVoiceMarketplace.test.js — covers all critical paths and reverts:
       - listToken — happy path (owner with approval lists; Listed event; getActiveCount() increments; getActiveListings(0, 10) includes it); 
     reverts when caller is not owner; reverts when marketplace is not approved; reverts when re-listing an already-active token; reverts on  
     price == 0.
       - cancelListing — happy path (seller cancels; Cancelled event; removed from active array; getActiveCount() decrements); reverts when   
     caller is not seller; reverts when listing is inactive.
       - buyToken — happy path (buyer pays exact price; NFT transfers; seller balance increases by price; Sold event; listing marked inactive 
     and removed from active array); reverts when msg.value doesn't equal price (both under and over); reverts when listing inactive;
     reentrancy probe: deploy a malicious receiver contract that re-enters buyToken in onERC721Received and verify the second call reverts    
     (covers nonReentrant).
       - getActiveListings pagination — list 7 tokens, verify (offset=0, limit=3) returns first 3, (offset=3, limit=10) returns remaining 4,  
     (offset=10, limit=5) returns empty.
       - swap-and-pop integrity — list tokens A, B, C; cancel B; verify A and C are both still discoverable via getActiveListings, no
     duplicates, no zero entries.
     - All tests use Hardhat's loadFixture for deterministic state; signers via ethers.getSigners().

     Frontend wiring

     - lib/marketplaceContract.ts (new) — single source of truth. Exports NFT_ADDRESS, MARKETPLACE_ADDRESS from process.env.NEXT_PUBLIC_*,    
     nftAbi and marketplaceAbi (as const, copy from artifacts/contracts/.../*.json after compile), and typed wagmi configs nftConfig,
     marketplaceConfig.
     - lib/lighthouseMetadata.ts (new) — small helper: uploadMetadataJSON(meta) -> Promise<string> returning ipfs://<cid>. Use
     @lighthouse-web3/sdk's text/buffer upload (existing audio upload already uses Lighthouse — same API key).
     - hooks/useMintAndList.ts (new) — orchestrates: upload metadata JSON → nft.mint(account, tokenURI) (wagmi writeContractAsync) → wait for 
     receipt → parse Minted event → if user opted to list: nft.approve(MARKETPLACE_ADDRESS, tokenId) → marketplace.listToken(tokenId,
     parseEther(price)). Returns { tokenId, txHash }.
     - hooks/useActiveListings.ts (new) — useReadContract on marketplace.getActiveListings(0n, 50n) → for each tokenId fetch nft.tokenURI via 
     useReadContracts (multicall) → fetch metadata JSON from https://gateway.lighthouse.storage/ipfs/<cid> (with ipfs.io fallback). Returns   
     hydrated listings array.
     - hooks/useBuy.ts (new) — writeContractAsync(marketplace.buyToken, [tokenId], { value: price }).
     - hooks/useCancelListing.ts (new) — writeContractAsync(marketplace.cancelListing, [tokenId]). Surfaced from /collection for tokens the   
     connected wallet owns AND has actively listed.
     - hooks/useOwnedTokens.ts (new) — usePublicClient().getLogs({ address: NFT_ADDRESS, event: transferEvent, args: { to: account } }) minus 
     from: account, dedupe latest owner. Block-range chunking: scan in 10k-block windows from a configured NEXT_PUBLIC_DEPLOY_BLOCK to latest 
     to stay under Calibration RPC log limits. Hydrate tokenURI + IPFS metadata same as useActiveListings. For each owned token, also call    
     marketplace.getListing(tokenId) (multicall) so the UI knows whether it's currently listed and at what price.
     - app/store/page.tsx — replace the setTimeout(2000) (~line 137) with useMintAndList. Replace localStorage write (~line 232) with toast on
      tx hash + invalidate active-listings query. Drop the Math.random() profileViews (~line 227) — set to 0 or compute later from Sold event 
     count.
     - app/buyer/page.tsx — replace localStorage read (line 19) with useActiveListings(). Replace the alert() Buy (lines 64–66) with useBuy() 
     call passing the listing's price. Show pending/success/error toasts.
     - app/marketplace/page.tsx (new — currently linked from BuyerSidebar.tsx but missing) — full grid using a shared <ListingGrid />
     component extracted from buyer/page.tsx.
     - app/collection/page.tsx (new — currently linked but missing) — useOwnedTokens() rendered with <ListingGrid /> in owned mode. For each  
     owned token whose Listing.active is true, surface a Cancel listing button wired to useCancelListing (with optimistic removal + tx-pending
      state). For tokens not currently listed, surface a List for sale entry point that reuses the listing form (price + currency) and runs   
     nft.approve → marketplace.listToken (the second half of useMintAndList, factored out).
     - components/ListingGrid.tsx (new) — extracted shared grid; props: listings, mode: "buy" | "owned". In owned mode, exposes per-card slots
      for Cancel listing / List for sale controls (rendered when the parent passes them) instead of the Buy button.
     - contexts/IPContext.tsx — kept as a transient client-side cache for the current user's just-minted-but-not-yet-indexed items (optimistic
      UI) only; legacy localStorage entries are silently ignored (chain is source of truth). Strip addRegisteredIP writes that hit
     localStorage with stale shape; rebuild around mint receipts. If this proves messy during implementation, delete the file and inline the  
     optimistic state in app/store/page.tsx.
     - .env.example — append NEXT_PUBLIC_NFT_ADDRESS=, NEXT_PUBLIC_MARKETPLACE_ADDRESS=, NEXT_PUBLIC_DEPLOY_BLOCK=,
     NEXT_PUBLIC_CHAIN_ID=314159, NEXT_PUBLIC_FILECOIN_RPC=https://api.calibration.node.glif.io/rpc/v1. PRIVATE_KEY and
     NEXT_PUBLIC_LIGHTHOUSE_API_KEY already documented.

     Files to delete (verify no live imports first)

     - lib/sonicVoiceService.ts — dead, ethers v5, placeholder addresses.
     - lib/sonicIpContract.ts — dead, placeholder address 0x123….
     - lib/contract.ts — legacy store/retrieve ABI, no longer used after wiring.
     - lib/SonicVoiceNFT.sol, lib/SonicVoiceMarketplace.sol, lib/SonicVoiceRegistry.sol — empty stubs in the wrong path; replaced by
     contracts/SonicVoice{NFT,Marketplace}.sol. (No registry contract — out of scope for MVP.)
     - lib/SonicIPToken.sol and contracts/SonicIPToken.sol — legacy ERC-721 not used by the new flow; remove to avoid confusion.

     Existing code/utilities to reuse

     - Lighthouse audio upload: app/store/page.tsx:297-357 — already calls Lighthouse SDK with NEXT_PUBLIC_LIGHTHOUSE_API_KEY. Reuse the same 
     client/key for the new metadata-JSON upload helper.
     - Audio recording: app/store/page.tsx:244-277 (MediaRecorder) — unchanged.
     - IPFS gateway resolution + fallback: components/MarketplaceCard.tsx — already does ipfs.io → gateway.lighthouse.storage fallback. Lift  
     into a small util at lib/ipfsGateway.ts and reuse from new hooks + card.
     - Wallet/network gating: app/store/page.tsx:49, 105, 436-449 — useAccount() + isConnected + isMatching chain check. Pattern is sound;    
     reuse for the new mint/list/buy paths.
     - wagmi/RainbowKit provider stack: app/providers.tsx — Filecoin Calibration is the only chain; no change.
     - MarketplaceCard: components/MarketplaceCard.tsx — adapt to take a hydrated Listing (tokenId + on-chain price + IPFS metadata) instead  
     of the legacy RegisteredIP shape.

     Order of operations

     Phase 0 — Pre-flight verification (agent does, no new files written)
     0.1. Read package.json — confirm hardhat version, presence of @nomicfoundation/hardhat-toolbox, presence (or absence) of
     @openzeppelin/contracts, presence of @lighthouse-web3/sdk, scripts already defined.
     0.2. Hardhat compatibility probe — run npx hardhat --version and npx hardhat compile against the current contracts/ (just
     SonicIPToken.sol). If Hardhat 3 + toolbox produces a load error or peer-dep mismatch, downgrade plan: npm i -D hardhat@^2.22
     @nomicfoundation/hardhat-toolbox@^5 and document in DEPLOY.md. If it compiles, continue with 3.x.
     0.3. OpenZeppelin v5 check — if @openzeppelin/contracts is missing or below ^5.0.0, run npm i -D @openzeppelin/contracts@^5.0.2. (OZ v5  
     changes Ownable constructor and _exists; the new contracts target v5 explicitly.)
     0.4. Lighthouse SDK probe — read node_modules/@lighthouse-web3/sdk/dist/index.d.ts (or its .js exports) to confirm the actual JSON/text  
     upload symbol — likely lighthouse.uploadText(text, apiKey) returning { data: { Hash } }. Pin the exact call in lib/lighthouseMetadata.ts 
     based on what's actually exported.
     0.5. Dead-import grep — grep -r for any importer of lib/contract.ts, lib/sonicVoiceService.ts, lib/sonicIpContract.ts,
     lib/audioTokenizationService.ts, IPContext. Confirm the only live importer is app/store/page.tsx (for lib/contract.ts) and
     app/buyer/page.tsx + app/page.tsx (for IPContext). If anything else shows up, surface to user before proceeding.
     0.6. Block any of A–D until 0.1–0.5 pass. If a probe fails in a way that materially changes the plan, pause and report to the user before
      writing files.

     Phase A — Contracts + tests (agent does, fully local)
     1. Write contracts/SonicVoiceNFT.sol and contracts/SonicVoiceMarketplace.sol. Delete the empty lib/SonicVoice*.sol stubs.
     2. Update hardhat.config.js solidity settings (optimizer).
     3. Rewrite scripts/deploy.js.
     4. Write test/SonicVoiceNFT.test.js and test/SonicVoiceMarketplace.test.js (per the "Contract tests" file list above).
     5. Run npm run compile (clean) → npm run test:contracts (all green). If any test fails, fix the contract or test; do not move on with red
      tests.

     Phase B — Deploy (USER does — agent cannot, needs private key + funded wallet)
     6. Fund a Calibration testnet wallet from https://faucet.calibnet.chainsafe-fil.io/.
     7. Put PRIVATE_KEY in .env.local (a fresh key, not your main wallet).
     8. Run npm run deploy:calibration.
     9. Paste printed NEXT_PUBLIC_NFT_ADDRESS / NEXT_PUBLIC_MARKETPLACE_ADDRESS / NEXT_PUBLIC_DEPLOY_BLOCK into .env.local. (Agent reminds you
      and gates Phase C on receiving these.)

     Phase C — Frontend wiring (agent does)
     10. Create lib/marketplaceContract.ts (paste ABIs from artifacts/).
     11. Create lib/lighthouseMetadata.ts, lib/ipfsGateway.ts, lib/listingMetadata.ts (schema + builder).
     12. Create hooks/useMintAndList.ts, hooks/useBuy.ts, hooks/useCancelListing.ts, hooks/useActiveListings.ts, hooks/useOwnedTokens.ts.     
     13. Port app/store/page.tsx and app/buyer/page.tsx. Adapt IPContext to optimistic-cache-only (or inline-and-delete).
     14. Create components/ListingGrid.tsx. Adapt components/MarketplaceCard.tsx to the new shape (schema-v1 metadata).
     15. Create app/marketplace/page.tsx and app/collection/page.tsx (latter includes List-for-sale + Cancel-listing controls).
     16. Delete dead files (Phase 0.5 already confirmed zero live imports): lib/sonicVoiceService.ts, lib/sonicIpContract.ts, lib/contract.ts,
      lib/audioTokenizationService.ts, leftover lib/SonicVoice*.sol, lib/SonicIPToken.sol, contracts/SonicIPToken.sol.
     17. Run npm run lint && npm run typecheck && npm run build. Fix until clean.

     Phase D — Verification (USER does end-to-end on Calibration)
     18. Connect wallet on /store, record audio, mint, then list at a tFIL price.
     19. Open /marketplace in another browser/wallet → buy the listing → confirm tx.
     20. Confirm token shows in buyer's /collection, seller's tFIL balance increases by the price, listing disappears from /marketplace.      
     21. From the original (seller) wallet, list another token then click Cancel listing on /collection; confirm it disappears from
     /marketplace.

     Verification

     Static checks (agent runs in Phase A step 5 and Phase C step 17):
     - npm run compile — contracts compile without warnings.
     - npm run test:contracts — all Hardhat tests green (NFT + Marketplace suites).
     - npm run lint — no new ESLint errors.
     - npm run typecheck — TS clean.
     - npm run build — Next.js production build succeeds.

     On-chain checks (run after deploy):
     - npx hardhat console --network filecoinCalibration → call nft.totalSupply() (or nextTokenId getter) and marketplace.getActiveCount() to 
     confirm wiring.
     - Inspect deployed contracts on https://calibration.filfox.info/ using printed addresses.

     End-to-end (Phase D, user does in browser):
     - Mint without listing: tokenize audio without listing → token visible in /collection, not in /marketplace. Confirms mint works
     standalone.
     - Mint and list: tokenize + list at e.g. 0.01 tFIL → appears in /marketplace from a fresh wallet's perspective. Confirms
     getActiveListings read path.
     - Cancel listing: from /collection, click Cancel on a listing you own → listing disappears from /marketplace. Confirms swap-and-pop      
     removal end-to-end through the UI.
     - List from collection: pick an unlisted owned token on /collection, click List for sale, set price → appears in /marketplace. Confirms  
     approve+listToken from the collection page (not just the original mint flow).
     - Buy: second wallet buys → tx succeeds → token in second wallet's /collection, seller's tFIL increased by price net of gas, listing     
     removed from /marketplace. Confirms full flow.
     - Error paths: try buying with wrong msg.value (should revert), try listing without approving Marketplace (should revert), try canceling 
     someone else's listing (should revert). Manual via Etherscan-equivalent or console.

     Risks & open notes (recorded, but not blocking start)

     presence (or absence) of @openzeppelin/contracts, presence of @lighthouse-web3/sdk, scripts      
     already defined.
     0.2. Hardhat compatibility probe — run npx hardhat --version and npx hardhat compile against the 
     current contracts/ (just SonicIPToken.sol). If Hardhat 3 + toolbox produces a load error or      
     peer-dep mismatch, downgrade plan: npm i -D hardhat@^2.22 @nomicfoundation/hardhat-toolbox@^5 and
      document in DEPLOY.md. If it compiles, continue with 3.x.
     0.3. OpenZeppelin v5 check — if @openzeppelin/contracts is missing or below ^5.0.0, run npm i -D 
     @openzeppelin/contracts@^5.0.2. (OZ v5 changes Ownable constructor and _exists; the new contracts
      target v5 explicitly.)
     0.4. Lighthouse SDK probe — read node_modules/@lighthouse-web3/sdk/dist/index.d.ts (or its .js   
     exports) to confirm the actual JSON/text upload symbol — likely lighthouse.uploadText(text,      
     apiKey) returning { data: { Hash } }. Pin the exact call in lib/lighthouseMetadata.ts based on   
     what's actually exported.
     0.5. Dead-import grep — grep -r for any importer of lib/contract.ts, lib/sonicVoiceService.ts,   
     lib/sonicIpContract.ts, lib/audioTokenizationService.ts, IPContext. Confirm the only live        
     importer is app/store/page.tsx (for lib/contract.ts) and app/buyer/page.tsx + app/page.tsx (for  
     IPContext). If anything else shows up, surface to user before proceeding.
     0.6. Block any of A–D until 0.1–0.5 pass. If a probe fails in a way that materially changes the  
     plan, pause and report to the user before writing files.

     Phase A — Contracts + tests (agent does, fully local)
     1. Write contracts/SonicVoiceNFT.sol and contracts/SonicVoiceMarketplace.sol. Delete the empty   
     lib/SonicVoice*.sol stubs.
     2. Update hardhat.config.js solidity settings (optimizer).
     3. Rewrite scripts/deploy.js.
     4. Write test/SonicVoiceNFT.test.js and test/SonicVoiceMarketplace.test.js (per the "Contract    
     tests" file list above).
     5. Run npm run compile (clean) → npm run test:contracts (all green). If any test fails, fix the  
     contract or test; do not move on with red tests.

     Phase B — Deploy (USER does — agent cannot, needs private key + funded wallet)
     6. Fund a Calibration testnet wallet from https://faucet.calibnet.chainsafe-fil.io/.
     7. Put PRIVATE_KEY in .env.local (a fresh key, not your main wallet).
     8. Run npm run deploy:calibration.
     9. Paste printed NEXT_PUBLIC_NFT_ADDRESS / NEXT_PUBLIC_MARKETPLACE_ADDRESS /
     NEXT_PUBLIC_DEPLOY_BLOCK into .env.local. (Agent reminds you and gates Phase C on receiving      
     these.)

     Phase C — Frontend wiring (agent does)
     10. Create lib/marketplaceContract.ts (paste ABIs from artifacts/).
     11. Create lib/lighthouseMetadata.ts, lib/ipfsGateway.ts, lib/listingMetadata.ts (schema +       
     builder).
     12. Create hooks/useMintAndList.ts, hooks/useBuy.ts, hooks/useCancelListing.ts,
     hooks/useActiveListings.ts, hooks/useOwnedTokens.ts.
     13. Port app/store/page.tsx and app/buyer/page.tsx. Adapt IPContext to optimistic-cache-only (or 
     inline-and-delete).
     14. Create components/ListingGrid.tsx. Adapt components/MarketplaceCard.tsx to the new shape     
     (schema-v1 metadata).
     15. Create app/marketplace/page.tsx and app/collection/page.tsx (latter includes List-for-sale + 
     Cancel-listing controls).
     16. Delete dead files (Phase 0.5 already confirmed zero live imports): lib/sonicVoiceService.ts, 
     lib/sonicIpContract.ts, lib/contract.ts, lib/audioTokenizationService.ts, leftover
     lib/SonicVoice*.sol, lib/SonicIPToken.sol, contracts/SonicIPToken.sol.
     17. Run npm run lint && npm run typecheck && npm run build. Fix until clean.

     Phase D — Verification (USER does end-to-end on Calibration)
     18. Connect wallet on /store, record audio, mint, then list at a tFIL price.
     19. Open /marketplace in another browser/wallet → buy the listing → confirm tx.
     20. Confirm token shows in buyer's /collection, seller's tFIL balance increases by the price,    
     listing disappears from /marketplace.
     21. From the original (seller) wallet, list another token then click Cancel listing on
     /collection; confirm it disappears from /marketplace.

     Verification

     Static checks (agent runs in Phase A step 5 and Phase C step 17):
     - npm run compile — contracts compile without warnings.
     - npm run test:contracts — all Hardhat tests green (NFT + Marketplace suites).
     - npm run lint — no new ESLint errors.
     - npm run typecheck — TS clean.
     - npm run build — Next.js production build succeeds.

     On-chain checks (run after deploy):
     - npx hardhat console --network filecoinCalibration → call nft.totalSupply() (or nextTokenId     
     getter) and marketplace.getActiveCount() to confirm wiring.
     - Inspect deployed contracts on https://calibration.filfox.info/ using printed addresses.        

     End-to-end (Phase D, user does in browser):
     - Mint without listing: tokenize audio without listing → token visible in /collection, not in    
     /marketplace. Confirms mint works standalone.
     - Mint and list: tokenize + list at e.g. 0.01 tFIL → appears in /marketplace from a fresh        
     wallet's perspective. Confirms getActiveListings read path.
     - Cancel listing: from /collection, click Cancel on a listing you own → listing disappears from  
     /marketplace. Confirms swap-and-pop removal end-to-end through the UI.
     - List from collection: pick an unlisted owned token on /collection, click List for sale, set    
     price → appears in /marketplace. Confirms approve+listToken from the collection page (not just   
     the original mint flow).
     - Buy: second wallet buys → tx succeeds → token in second wallet's /collection, seller's tFIL    
     removal end-to-end through the UI.
     - List from collection: pick an unlisted owned token on /collection, click List for sale, set price → appears in /marketplace. Confirms  
     approve+listToken from the collection page (not just the original mint flow).
     - Buy: second wallet buys → tx succeeds → token in second wallet's /collection, seller's tFIL increased by price net of gas, listing     
     removed from /marketplace. Confirms full flow.
     - Error paths: try buying with wrong msg.value (should revert), try listing without approving Marketplace (should revert), try canceling 
     someone else's listing (should revert). Manual via Etherscan-equivalent or console.

     Risks & open notes (recorded, but not blocking start)
     current contracts/ (just SonicIPToken.sol). If Hardhat 3 + toolbox produces a load error or      
     peer-dep mismatch, downgrade plan: npm i -D hardhat@^2.22 @nomicfoundation/hardhat-toolbox@^5 and
      document in DEPLOY.md. If it compiles, continue with 3.x.
     0.3. OpenZeppelin v5 check — if @openzeppelin/contracts is missing or below ^5.0.0, run npm i -D 
     @openzeppelin/contracts@^5.0.2. (OZ v5 changes Ownable constructor and _exists; the new contracts
      target v5 explicitly.)
     0.4. Lighthouse SDK probe — read node_modules/@lighthouse-web3/sdk/dist/index.d.ts (or its .js   
     exports) to confirm the actual JSON/text upload symbol — likely lighthouse.uploadText(text,      
     apiKey) returning { data: { Hash } }. Pin the exact call in lib/lighthouseMetadata.ts based on   
     what's actually exported.
     0.5. Dead-import grep — grep -r for any importer of lib/contract.ts, lib/sonicVoiceService.ts,   
     lib/sonicIpContract.ts, lib/audioTokenizationService.ts, IPContext. Confirm the only live        
     importer is app/store/page.tsx (for lib/contract.ts) and app/buyer/page.tsx + app/page.tsx (for  
     IPContext). If anything else shows up, surface to user before proceeding.
     0.6. Block any of A–D until 0.1–0.5 pass. If a probe fails in a way that materially changes the  
     plan, pause and report to the user before writing files.

     Phase A — Contracts + tests (agent does, fully local)
     1. Write contracts/SonicVoiceNFT.sol and contracts/SonicVoiceMarketplace.sol. Delete the empty   
     lib/SonicVoice*.sol stubs.
     2. Update hardhat.config.js solidity settings (optimizer).
     3. Rewrite scripts/deploy.js.
     4. Write test/SonicVoiceNFT.test.js and test/SonicVoiceMarketplace.test.js (per the "Contract    
     tests" file list above).
     5. Run npm run compile (clean) → npm run test:contracts (all green). If any test fails, fix the  
     contract or test; do not move on with red tests.

     Phase B — Deploy (USER does — agent cannot, needs private key + funded wallet)
     6. Fund a Calibration testnet wallet from https://faucet.calibnet.chainsafe-fil.io/.
     7. Put PRIVATE_KEY in .env.local (a fresh key, not your main wallet).
     8. Run npm run deploy:calibration.
     9. Paste printed NEXT_PUBLIC_NFT_ADDRESS / NEXT_PUBLIC_MARKETPLACE_ADDRESS /
     NEXT_PUBLIC_DEPLOY_BLOCK into .env.local. (Agent reminds you and gates Phase C on receiving      
     these.)

     Phase C — Frontend wiring (agent does)
     10. Create lib/marketplaceContract.ts (paste ABIs from artifacts/).
     11. Create lib/lighthouseMetadata.ts, lib/ipfsGateway.ts, lib/listingMetadata.ts (schema +       
     builder).
     12. Create hooks/useMintAndList.ts, hooks/useBuy.ts, hooks/useCancelListing.ts,
     hooks/useActiveListings.ts, hooks/useOwnedTokens.ts.
     13. Port app/store/page.tsx and app/buyer/page.tsx. Adapt IPContext to optimistic-cache-only (or 
     inline-and-delete).
     14. Create components/ListingGrid.tsx. Adapt components/MarketplaceCard.tsx to the new shape     
     (schema-v1 metadata).
     15. Create app/marketplace/page.tsx and app/collection/page.tsx (latter includes List-for-sale + 
     Cancel-listing controls).
     16. Delete dead files (Phase 0.5 already confirmed zero live imports): lib/sonicVoiceService.ts, 
     lib/sonicIpContract.ts, lib/contract.ts, lib/audioTokenizationService.ts, leftover
     lib/SonicVoice*.sol, lib/SonicIPToken.sol, contracts/SonicIPToken.sol.
     17. Run npm run lint && npm run typecheck && npm run build. Fix until clean.

     Phase D — Verification (USER does end-to-end on Calibration)
     18. Connect wallet on /store, record audio, mint, then list at a tFIL price.
     19. Open /marketplace in another browser/wallet → buy the listing → confirm tx.
     20. Confirm token shows in buyer's /collection, seller's tFIL balance increases by the price,    
     listing disappears from /marketplace.
     21. From the original (seller) wallet, list another token then click Cancel listing on
     /collection; confirm it disappears from /marketplace.

     Verification

     Static checks (agent runs in Phase A step 5 and Phase C step 17):
     - npm run compile — contracts compile without warnings.
     - npm run test:contracts — all Hardhat tests green (NFT + Marketplace suites).
     - npm run lint — no new ESLint errors.
     - npm run typecheck — TS clean.
     - npm run build — Next.js production build succeeds.

     On-chain checks (run after deploy):
     - npx hardhat console --network filecoinCalibration → call nft.totalSupply() (or nextTokenId     
     getter) and marketplace.getActiveCount() to confirm wiring.
     - Inspect deployed contracts on https://calibration.filfox.info/ using printed addresses.        

     End-to-end (Phase D, user does in browser):
     - Mint without listing: tokenize audio without listing → token visible in /collection, not in    
     /marketplace. Confirms mint works standalone.
     - Mint and list: tokenize + list at e.g. 0.01 tFIL → appears in /marketplace from a fresh        
     wallet's perspective. Confirms getActiveListings read path.
     - Cancel listing: from /collection, click Cancel on a listing you own → listing disappears from  
     /marketplace. Confirms swap-and-pop removal end-to-end through the UI.
     - List from collection: pick an unlisted owned token on /collection, click List for sale, set    
     price → appears in /marketplace. Confirms approve+listToken from the collection page (not just   
     the original mint flow).
     - Buy: second wallet buys → tx succeeds → token in second wallet's /collection, seller's tFIL    
     removal end-to-end through the UI.
     - List from collection: pick an unlisted owned token on /collection, click List for sale, set price → appears in /marketplace. Confirms  
     approve+listToken from the collection page (not just the original mint flow).
     - Buy: second wallet buys → tx succeeds → token in second wallet's /collection, seller's tFIL increased by price net of gas, listing     
     removed from /marketplace. Confirms full flow.
     - Error paths: try buying with wrong msg.value (should revert), try listing without approving Marketplace (should revert), try canceling 
     someone else's listing (should revert). Manual via Etherscan-equivalent or console.

     Risks & open notes (recorded, but not blocking start)

     - Hardhat 3.x compatibility with @nomicfoundation/hardhat-toolbox — verify in Phase A step 4. If it breaks, pin to Hardhat 2.x.
     - Lighthouse JSON upload API — confirm @lighthouse-web3/sdk exposes a text/buffer upload (it does, via lighthouse.uploadText /
     lighthouse.uploadBuffer); verify shape on first integration.
     - Audio "license" semantics — public CIDs mean anyone can stream; ownership is the NFT, not access exclusivity. The product framing ("buy
      to use commercially") fits this; if access-gating is needed later, layer Lighthouse encrypted storage on top without changing contracts.
     - Legacy localStorage entries — silently ignored. If existing demo data must be preserved, that's a follow-up migration script (re-upload
      metadata, re-mint per entry); not in scope.
     - No ERC721Enumerable — /collection uses Transfer event log scanning. Acceptable for MVP volumes; revisit if event scanning gets slow.   
     - Etherscan verify on Calibration — Filecoin uses Filfox/Filscan; verification flow is different. Left as TODO; doesn't block
     functionality.