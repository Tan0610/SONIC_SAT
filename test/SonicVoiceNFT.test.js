const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("SonicVoiceNFT", function () {
  async function deployFixture() {
    const [owner, addr1, addr2] = await ethers.getSigners();
    const NFT = await ethers.getContractFactory("SonicVoiceNFT");
    const nft = await NFT.deploy(owner.address);
    await nft.waitForDeployment();
    return { nft, owner, addr1, addr2 };
  }

  it("allows anyone to mint", async function () {
    const { nft, addr1 } = await loadFixture(deployFixture);

    await nft.connect(addr1).mint(addr1.address, "ipfs://abc");
    expect(await nft.ownerOf(1)).to.equal(addr1.address);
    expect(await nft.tokenURI(1)).to.equal("ipfs://abc");
  });

  it("emits Minted event", async function () {
    const { nft, addr1 } = await loadFixture(deployFixture);

    await expect(nft.connect(addr1).mint(addr1.address, "ipfs://abc"))
      .to.emit(nft, "Minted")
      .withArgs(1, addr1.address, "ipfs://abc");
  });

  it("increments _nextTokenId across mints", async function () {
    const { nft, addr1, addr2 } = await loadFixture(deployFixture);

    const tx1 = await nft.connect(addr1).mint(addr1.address, "ipfs://one");
    const r1 = await tx1.wait();
    const event1 = r1.logs.find((l) => {
      try { return nft.interface.parseLog(l)?.name === "Minted"; } catch { return false; }
    });
    expect(nft.interface.parseLog(event1).args.tokenId).to.equal(1n);

    const tx2 = await nft.connect(addr2).mint(addr2.address, "ipfs://two");
    const r2 = await tx2.wait();
    const event2 = r2.logs.find((l) => {
      try { return nft.interface.parseLog(l)?.name === "Minted"; } catch { return false; }
    });
    expect(nft.interface.parseLog(event2).args.tokenId).to.equal(2n);

    expect(await nft.nextTokenId()).to.equal(3n);
  });

  it("reverts tokenURI on non-existent token", async function () {
    const { nft } = await loadFixture(deployFixture);
    await expect(nft.tokenURI(999)).to.be.reverted;
  });

  it("totalMinted increments correctly", async function () {
    const { nft, addr1 } = await loadFixture(deployFixture);
    expect(await nft.totalMinted()).to.equal(0n);

    await nft.connect(addr1).mint(addr1.address, "ipfs://a");
    expect(await nft.totalMinted()).to.equal(1n);

    await nft.connect(addr1).mint(addr1.address, "ipfs://b");
    expect(await nft.totalMinted()).to.equal(2n);
  });
});
