// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

interface IMarketplace {
    function buyToken(uint256 tokenId) external payable;
}

/// @notice Test-only: tries to re-enter `buyToken` from `onERC721Received`.
contract MaliciousBuyer is IERC721Receiver {
    IMarketplace public immutable marketplace;
    uint256 public targetTokenId;
    uint256 public attackPrice;
    bool public attacked;

    constructor(address marketplaceAddress) {
        marketplace = IMarketplace(marketplaceAddress);
    }

    function setTarget(uint256 tokenId, uint256 price) external {
        targetTokenId = tokenId;
        attackPrice = price;
    }

    function attack(uint256 tokenId) external payable {
        targetTokenId = tokenId;
        attackPrice = msg.value;
        marketplace.buyToken{value: msg.value}(tokenId);
    }

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external returns (bytes4) {
        if (!attacked) {
            attacked = true;
            // Try to re-enter — should revert under the nonReentrant guard.
            marketplace.buyToken{value: attackPrice}(targetTokenId);
        }
        return IERC721Receiver.onERC721Received.selector;
    }

    receive() external payable {}
}
