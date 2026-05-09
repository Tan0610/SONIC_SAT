const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

const { parseEther } = ethers;

describe("SonicVoiceMarketplace", function () {
  async function deployFixture() {
    const [owner, seller, buyer, attacker] = await ethers.getSigners();

    const NFT = await ethers.getContractFactory("SonicVoiceNFT");
    const nft = await NFT.deploy(owner.address);
    await nft.waitForDeployment();

    const Marketplace = await ethers.getContractFactory("SonicVoiceMarketplace");
    const marketplace = await Marketplace.deploy(nft.target);
    await marketplace.waitForDeployment();

    // Mint a few tokens to seller and approve marketplace via setApprovalForAll.
    await nft.connect(seller).mint(seller.address, "ipfs://t1");
    await nft.connect(seller).mint(seller.address, "ipfs://t2");
    await nft.connect(seller).mint(seller.address, "ipfs://t3");
    await nft.connect(seller).setApprovalForAll(marketplace.target, true);

    return { nft, marketplace, owner, seller, buyer, attacker };
  }

  describe("listToken", function () {
    it("happy path", async function () {
      const { nft, marketplace, seller } = await loadFixture(deployFixture);
      const price = parseEther("0.1");

      await expect(marketplace.connect(seller).listToken(1, price))
        .to.emit(marketplace, "Listed")
        .withArgs(1, seller.address, price);

      expect(await marketplace.getActiveCount()).to.equal(1n);
      const [ids, data] = await marketplace.getActiveListings(0, 10);
      expect(ids.map((b) => Number(b))).to.deep.equal([1]);
      expect(data[0].seller).to.equal(seller.address);
      expect(data[0].price).to.equal(price);
      expect(data[0].active).to.equal(true);
    });

    it("reverts when not owner", async function () {
      const { marketplace, buyer } = await loadFixture(deployFixture);
      await expect(
        marketplace.connect(buyer).listToken(1, parseEther("0.1"))
      ).to.be.revertedWith("not owner");
    });

    it("reverts without approval", async function () {
      const { nft, marketplace, owner } = await loadFixture(deployFixture);
      // Mint a fresh token to `owner` who has NOT approved the marketplace.
      await nft.connect(owner).mint(owner.address, "ipfs://fresh");
      // Find the token id (mint emits Minted).
      const totalMinted = await nft.totalMinted();
      await expect(
        marketplace.connect(owner).listToken(totalMinted, parseEther("0.1"))
      ).to.be.revertedWith("not approved");
    });

    it("reverts on already listed", async function () {
      const { marketplace, seller } = await loadFixture(deployFixture);
      await marketplace.connect(seller).listToken(1, parseEther("0.1"));
      await expect(
        marketplace.connect(seller).listToken(1, parseEther("0.2"))
      ).to.be.revertedWith("already listed");
    });

    it("reverts on price 0", async function () {
      const { marketplace, seller } = await loadFixture(deployFixture);
      await expect(
        marketplace.connect(seller).listToken(1, 0)
      ).to.be.revertedWith("price must be > 0");
    });
  });

  describe("cancelListing", function () {
    it("happy path", async function () {
      const { marketplace, seller } = await loadFixture(deployFixture);
      await marketplace.connect(seller).listToken(1, parseEther("0.1"));

      await expect(marketplace.connect(seller).cancelListing(1))
        .to.emit(marketplace, "Cancelled")
        .withArgs(1, seller.address);

      expect(await marketplace.getActiveCount()).to.equal(0n);
      const listing = await marketplace.getListing(1);
      expect(listing.active).to.equal(false);
    });

    it("reverts when not seller", async function () {
      const { marketplace, seller, buyer } = await loadFixture(deployFixture);
      await marketplace.connect(seller).listToken(1, parseEther("0.1"));
      await expect(
        marketplace.connect(buyer).cancelListing(1)
      ).to.be.revertedWith("not seller");
    });

    it("reverts when inactive (never listed)", async function () {
      const { marketplace, seller } = await loadFixture(deployFixture);
      await expect(
        marketplace.connect(seller).cancelListing(1)
      ).to.be.revertedWith("not active");
    });
  });

  describe("buyToken", function () {
    it("happy path", async function () {
      const { nft, marketplace, seller, buyer } = await loadFixture(deployFixture);
      const price = parseEther("0.1");
      await marketplace.connect(seller).listToken(1, price);

      const tx = marketplace.connect(buyer).buyToken(1, { value: price });

      await expect(tx).to.changeEtherBalances(
        [seller, buyer],
        [price, -price],
      );

      // Re-list to evaluate state without re-running the tx.
      // (changeEtherBalances ran the tx; below assertions read post-state.)
      expect(await nft.ownerOf(1)).to.equal(buyer.address);
      const listing = await marketplace.getListing(1);
      expect(listing.active).to.equal(false);
      expect(await marketplace.getActiveCount()).to.equal(0n);
    });

    it("emits Sold with correct args", async function () {
      const { marketplace, seller, buyer } = await loadFixture(deployFixture);
      const price = parseEther("0.1");
      await marketplace.connect(seller).listToken(1, price);

      await expect(marketplace.connect(buyer).buyToken(1, { value: price }))
        .to.emit(marketplace, "Sold")
        .withArgs(1, seller.address, buyer.address, price);
    });

    it("reverts on wrong msg.value (too low)", async function () {
      const { marketplace, seller, buyer } = await loadFixture(deployFixture);
      const price = parseEther("0.1");
      await marketplace.connect(seller).listToken(1, price);

      await expect(
        marketplace.connect(buyer).buyToken(1, { value: parseEther("0.05") })
      ).to.be.revertedWith("wrong value");
    });

    it("reverts on wrong msg.value (too high)", async function () {
      const { marketplace, seller, buyer } = await loadFixture(deployFixture);
      const price = parseEther("0.1");
      await marketplace.connect(seller).listToken(1, price);

      await expect(
        marketplace.connect(buyer).buyToken(1, { value: parseEther("0.2") })
      ).to.be.revertedWith("wrong value");
    });

    it("reverts on inactive listing", async function () {
      const { marketplace, buyer } = await loadFixture(deployFixture);
      await expect(
        marketplace.connect(buyer).buyToken(1, { value: parseEther("0.1") })
      ).to.be.revertedWith("not active");
    });

    it("reentrancy probe — second buy is blocked", async function () {
      const { nft, marketplace, seller, attacker } = await loadFixture(deployFixture);
      const price = parseEther("0.1");
      await marketplace.connect(seller).listToken(1, price);

      const Malicious = await ethers.getContractFactory("MaliciousBuyer");
      const malicious = await Malicious.deploy(marketplace.target);
      await malicious.waitForDeployment();

      // Fund attacker contract enough for two purchases (only one should succeed-attempt).
      await attacker.sendTransaction({ to: malicious.target, value: parseEther("1") });

      // The outer call should revert because safeTransferFrom -> onERC721Received
      // re-enters buyToken which trips the nonReentrant guard, causing the inner
      // call to revert and bubble up.
      await expect(
        malicious.connect(attacker).attack(1, { value: price })
      ).to.be.reverted;

      // Listing should still be active (state preserved on revert), token still with seller.
      const listing = await marketplace.getListing(1);
      expect(listing.active).to.equal(true);
      expect(await nft.ownerOf(1)).to.equal(seller.address);
    });
  });

  describe("getActiveListings pagination", function () {
    it("returns 3, 4, 0 across slices", async function () {
      const { nft, marketplace, seller } = await loadFixture(deployFixture);
      // Already minted 3 in fixture; mint 4 more to reach 7.
      for (let i = 0; i < 4; i++) {
        await nft.connect(seller).mint(seller.address, `ipfs://x${i}`);
      }
      // List all 7.
      for (let i = 1; i <= 7; i++) {
        await marketplace.connect(seller).listToken(i, parseEther("0.01"));
      }

      const [ids0, data0] = await marketplace.getActiveListings(0, 3);
      expect(ids0.length).to.equal(3);
      expect(data0.length).to.equal(3);

      const [ids1, data1] = await marketplace.getActiveListings(3, 10);
      expect(ids1.length).to.equal(4);
      expect(data1.length).to.equal(4);

      const [ids2, data2] = await marketplace.getActiveListings(10, 5);
      expect(ids2.length).to.equal(0);
      expect(data2.length).to.equal(0);
    });
  });

  describe("swap-and-pop integrity", function () {
    it("after cancelling middle item, list has [1, 3]", async function () {
      const { marketplace, seller } = await loadFixture(deployFixture);
      await marketplace.connect(seller).listToken(1, parseEther("0.1"));
      await marketplace.connect(seller).listToken(2, parseEther("0.2"));
      await marketplace.connect(seller).listToken(3, parseEther("0.3"));

      await marketplace.connect(seller).cancelListing(2);

      const [ids] = await marketplace.getActiveListings(0, 10);
      const numbers = ids.map((b) => Number(b)).sort((a, b) => a - b);
      expect(numbers).to.deep.equal([1, 3]);
      expect(numbers).to.not.include(0);
      expect(new Set(numbers).size).to.equal(numbers.length);
      expect(numbers.length).to.equal(2);
    });
  });
});
