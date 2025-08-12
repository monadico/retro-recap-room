// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {ERC1155Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import {ERC1155SupplyUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC1155/extensions/ERC1155SupplyUpgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/**
 * the capsule honor badges - upgradeable ERC-1155 for achievements
 * - Soulbound per achievement (toggleable)
 * - 1-per-user-per-achievement enforced
 * - EIP-712 signer-gated minting
 */
contract Achievements1155Upgradeable is
    Initializable,
    ERC1155Upgradeable,
    ERC1155SupplyUpgradeable,
    AccessControlUpgradeable,
    UUPSUpgradeable
{
    using Strings for uint256;

    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    bytes32 public constant SIGNER_ROLE = keccak256("SIGNER_ROLE");

    struct AchievementDef {
        bool enabled;
        bool soulbound;
        string uri; // optional per-id override; if empty, use baseURI + id
    }

    mapping(uint256 => AchievementDef) public achievements;
    mapping(uint256 => mapping(address => bool)) public hasMinted; // id => user => bool

    string public name;
    string public symbol;
    string public baseURI;

    // EIP-712 domain separator parts
    bytes32 private _DOMAIN_SEPARATOR;
    bytes32 private constant _TYPEHASH = keccak256("MintPermit(address to,uint256 id,uint256 deadline,bytes32 nonce)");
    mapping(address => mapping(uint256 => bool)) public usedNonces; // to => nonce => used

    function initialize(
        string memory _name,
        string memory _symbol,
        string memory _baseURI,
        address admin,
        address signer
    ) public initializer {
        __ERC1155_init("");
        __ERC1155Supply_init();
        __AccessControl_init();
        __UUPSUpgradeable_init();

        name = _name;
        symbol = _symbol;
        baseURI = _baseURI;

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(UPGRADER_ROLE, admin);
        _grantRole(SIGNER_ROLE, signer);

        _rebuildDomainSeparator();
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}

    function setBaseURI(string calldata newBase) external onlyRole(DEFAULT_ADMIN_ROLE) {
        baseURI = newBase;
        emit URI(uri(0), 0); // clients can refetch
    }

    function setAchievement(uint256 id, bool enabled, bool soulbound, string calldata perIdURI) external onlyRole(DEFAULT_ADMIN_ROLE) {
        achievements[id] = AchievementDef({enabled: enabled, soulbound: soulbound, uri: perIdURI});
    }

    function uri(uint256 id) public view override returns (string memory) {
        string memory per = achievements[id].uri;
        if (bytes(per).length != 0) return per;
        return string(abi.encodePacked(baseURI, id.toString(), ".json"));
    }

    function domainSeparator() public view returns (bytes32) { return _DOMAIN_SEPARATOR; }

    function _rebuildDomainSeparator() internal {
        _DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes(name)),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
    }

    function _hashPermit(address to, uint256 id, uint256 deadline, bytes32 nonce) internal view returns (bytes32) {
        return keccak256(
            abi.encodePacked("\x19\x01", _DOMAIN_SEPARATOR, keccak256(abi.encode(_TYPEHASH, to, id, deadline, nonce)))
        );
    }

    function mintWithPermit(
        address to,
        uint256 id,
        uint256 deadline,
        bytes32 nonce,
        bytes calldata signature
    ) external {
        require(achievements[id].enabled, "disabled");
        require(block.timestamp <= deadline, "expired");
        require(!usedNonces[to][uint256(nonce)], "nonce used");
        require(!hasMinted[id][to], "already minted");

        bytes32 digest = _hashPermit(to, id, deadline, nonce);
        address recovered = _recover(digest, signature);
        require(hasRole(SIGNER_ROLE, recovered), "bad sig");

        usedNonces[to][uint256(nonce)] = true;
        hasMinted[id][to] = true;
        _mint(to, id, 1, "");
    }

    function _recover(bytes32 digest, bytes memory sig) internal pure returns (address) {
        if (sig.length != 65) return address(0);
        bytes32 r; bytes32 s; uint8 v;
        assembly {
            r := mload(add(sig, 0x20))
            s := mload(add(sig, 0x40))
            v := byte(0, mload(add(sig, 0x60)))
        }
        if (v < 27) v += 27;
        if (v != 27 && v != 28) return address(0);
        return ecrecover(digest, v, r, s);
    }

    function _update(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory values
    ) internal override(ERC1155Upgradeable, ERC1155SupplyUpgradeable) {
        if (from != address(0) && to != address(0)) {
            // transfers: enforce per-id soulbound
            for (uint256 i = 0; i < ids.length; i++) {
                require(!achievements[ids[i]].soulbound, "soulbound");
            }
        }
        super._update(from, to, ids, values);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC1155Upgradeable, AccessControlUpgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}

