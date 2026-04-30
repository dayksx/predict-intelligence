// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script} from "forge-std/Script.sol";
import {AgenticSubdomain} from "../src/AgenticSubdomain.sol";

/// @dev `NameWrapper` token id for a node is `uint256(bytes32 node)`.
interface INameWrapperView {
    function getData(uint256 id)
        external
        view
        returns (address owner, uint32 fuses, uint64 expiry);
}

/// @dev After deploy + owner `setApprovalForAll` on NameWrapper, registers three subnames:
///      `dayan.agentic.eth`, `nicolas.agentic.eth`, `gabriel.agentic.eth`.
///      Subname owner: set `SUBNAME_OWNER_ADDRESS=0x...` (recommandé sur un fork : le compte EOA
///      « propre », pas la clé Anvil #0 — voir README). Sinon = `msg.sender` (clé `--private-key`).
///      Expiry = parent (lu sur le NameWrapper).
contract AgenticSubdomainRegisterThree is Script {
    /// @dev `REGISTRAR_CONTRACT_ADDRESS=0x... forge script ...`
    function run() public {
        registerThree(vm.envAddress("REGISTRAR_CONTRACT_ADDRESS"));
    }

    /// @dev `forge script ... --sig "runWithAddress(address)" 0x...` (un seul `run` dans l’ABI pour Foundry).
    function runWithAddress(address registrar) public {
        registerThree(registrar);
    }

    function registerThree(address registrar) internal {
        address subnameOwner = _subnameOwner();

        AgenticSubdomain r = AgenticSubdomain(registrar);
        bytes32 parent = r.parentNode();
        (, , uint64 parentExpiry) = INameWrapperView(address(r.nameWrapper()))
            .getData(uint256(parent));

        vm.startBroadcast();

        r.setSubdomain("dayan", subnameOwner, parentExpiry);
        r.setSubdomain("nicolas", subnameOwner, parentExpiry);
        r.setSubdomain("gabriel", subnameOwner, parentExpiry);

        vm.stopBroadcast();
    }

    /// @dev Owner of the new wrapped subname NFTs. Optional env overrides `msg.sender`.
    function _subnameOwner() internal view returns (address) {
        if (vm.envExists("SUBNAME_OWNER_ADDRESS")) {
            return vm.envAddress("SUBNAME_OWNER_ADDRESS");
        }
        return msg.sender;
    }
}
