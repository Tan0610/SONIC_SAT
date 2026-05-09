// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title SonicVoiceNFT
/// @notice ERC-721 representing tokenized audio loops. Anyone may mint.
contract SonicVoiceNFT is ERC721, ERC721URIStorage, Ownable {
    uint256 private _nextTokenId;

    event Minted(uint256 indexed tokenId, address indexed to, string tokenURI);

    constructor(address initialOwner)
        ERC721("Sonic Voice IP", "SVIP")
        Ownable(initialOwner)
    {
        _nextTokenId = 1;
    }

    /// @notice Mint a new token. Open to anyone.
    /// @param to Recipient of the new token.
    /// @param tokenURI_ The token URI (typically `ipfs://<metadata-cid>`).
    /// @return tokenId The minted token id.
    function mint(address to, string memory tokenURI_) external returns (uint256 tokenId) {
        tokenId = _nextTokenId;
        unchecked {
            _nextTokenId = tokenId + 1;
        }
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, tokenURI_);
        emit Minted(tokenId, to, tokenURI_);
    }

    /// @notice The next token id that will be minted.
    function nextTokenId() external view returns (uint256) {
        return _nextTokenId;
    }

    /// @notice Total number of tokens minted so far.
    function totalMinted() external view returns (uint256) {
        return _nextTokenId - 1;
    }

    // -- OZ v5 required overrides --

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
