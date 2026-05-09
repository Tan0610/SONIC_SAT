// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title SonicVoiceMarketplace
/// @notice Minimal fixed-price marketplace for SonicVoiceNFT.
/// @dev No fees, no escrow — sellers retain custody until sale. Implements
///      IERC721Receiver so the contract could optionally hold tokens in the
///      future, but for the MVP it never takes custody.
contract SonicVoiceMarketplace is IERC721Receiver, ReentrancyGuard {
    struct Listing {
        address seller;
        uint256 price;
        bool active;
    }

    IERC721 public immutable nft;

    mapping(uint256 => Listing) private _listings;
    uint256[] private _activeTokenIds;
    /// @dev 1-based index into `_activeTokenIds`; 0 means "not present".
    mapping(uint256 => uint256) private _activeIndex;

    event Listed(uint256 indexed tokenId, address indexed seller, uint256 price);
    event Cancelled(uint256 indexed tokenId, address indexed seller);
    event Sold(uint256 indexed tokenId, address indexed seller, address indexed buyer, uint256 price);

    constructor(address nftAddress) {
        nft = IERC721(nftAddress);
    }

    // ---- External writes ----

    function listToken(uint256 tokenId, uint256 price) external {
        require(price > 0, "price must be > 0");
        require(nft.ownerOf(tokenId) == msg.sender, "not owner");
        require(
            nft.getApproved(tokenId) == address(this) ||
                nft.isApprovedForAll(msg.sender, address(this)),
            "not approved"
        );
        require(!_listings[tokenId].active, "already listed");

        _listings[tokenId] = Listing({seller: msg.sender, price: price, active: true});
        _activeTokenIds.push(tokenId);
        _activeIndex[tokenId] = _activeTokenIds.length; // 1-based

        emit Listed(tokenId, msg.sender, price);
    }

    function cancelListing(uint256 tokenId) external {
        Listing storage l = _listings[tokenId];
        require(l.active, "not active");
        require(l.seller == msg.sender, "not seller");

        l.active = false;
        _removeActive(tokenId);

        emit Cancelled(tokenId, msg.sender);
    }

    function buyToken(uint256 tokenId) external payable nonReentrant {
        Listing storage l = _listings[tokenId];
        require(l.active, "not active");
        require(msg.value == l.price, "wrong value");

        address seller = l.seller;
        uint256 price = l.price;

        // CEI: state changes before external calls.
        l.active = false;
        _removeActive(tokenId);

        nft.safeTransferFrom(seller, msg.sender, tokenId);

        (bool ok, ) = seller.call{value: price}("");
        require(ok, "payment failed");

        emit Sold(tokenId, seller, msg.sender, price);
    }

    // ---- External views ----

    function getListing(uint256 tokenId) external view returns (Listing memory) {
        return _listings[tokenId];
    }

    function getActiveCount() external view returns (uint256) {
        return _activeTokenIds.length;
    }

    function getActiveListings(uint256 offset, uint256 limit)
        external
        view
        returns (uint256[] memory tokenIds, Listing[] memory data)
    {
        uint256 length = _activeTokenIds.length;
        if (offset >= length) {
            return (new uint256[](0), new Listing[](0));
        }
        uint256 end = offset + limit;
        if (end > length) {
            end = length;
        }
        uint256 size = end - offset;
        tokenIds = new uint256[](size);
        data = new Listing[](size);
        for (uint256 i = 0; i < size; i++) {
            uint256 id = _activeTokenIds[offset + i];
            tokenIds[i] = id;
            data[i] = _listings[id];
        }
    }

    // ---- IERC721Receiver ----

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    // ---- Internal ----

    function _removeActive(uint256 tokenId) internal {
        uint256 indexPlusOne = _activeIndex[tokenId];
        require(indexPlusOne != 0, "not active");
        uint256 index = indexPlusOne - 1;
        uint256 lastIndex = _activeTokenIds.length - 1;

        if (index != lastIndex) {
            uint256 lastTokenId = _activeTokenIds[lastIndex];
            _activeTokenIds[index] = lastTokenId;
            _activeIndex[lastTokenId] = index + 1; // 1-based
        }

        _activeTokenIds.pop();
        delete _activeIndex[tokenId];
    }
}
