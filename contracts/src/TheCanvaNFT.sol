// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

// Minimal ERC-721 for shared, dynamic metadata
// A single tokenId (1) represents the shared canva. tokenURI points to backend metadata.
contract TheCanvaNFT is ERC721, Ownable {
    string private _baseURIOverride;

    constructor(string memory baseURI_) ERC721("The Canva", "CANVA") Ownable() {
        _baseURIOverride = baseURI_;
    }

    function setBaseURI(string calldata baseURI_) external onlyOwner {
        _baseURIOverride = baseURI_;
        emit MetadataUpdated();
    }

    function baseURI() external view returns (string memory) {
        return _baseURI();
    }

    function _baseURI() internal view override returns (string memory) {
        return _baseURIOverride;
    }

    // Everyone mints the same token id 1 (multiple owners), but ERC-721 can’t have multiple owners.
    // Instead, we mint unique tokenIds but point them all to the same metadata route.
    // tokenURI is baseURI + "/api/canva/metadata" ignoring tokenId.
    function tokenURI(uint256) public view override returns (string memory) {
        return string(abi.encodePacked(_baseURI(), "/api/canva/metadata"));
    }

    // Mint a personal token that shares the dynamic metadata
    function mint(address to, uint256 tokenId) external {
        _safeMint(to, tokenId);
    }

    event MetadataUpdated();
}

