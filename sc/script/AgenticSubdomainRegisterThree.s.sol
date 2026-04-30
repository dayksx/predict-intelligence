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
///      `agent0.agentic.eth`, `agent1.agentic.eth`, `agent2.agentic.eth` (edit labels in this file if needed).
///      Subname owner: set `SUBNAME_OWNER_ADDRESS=0x...` (recommended on a fork: a clean EOA,
///      not Anvil key #0 — see README). Otherwise `msg.sender` (`--private-key`).
///      Expiry = parent (read from NameWrapper).
///      When broadcasting via RPC (e.g. Alchemy), use `forge script ... --slow --broadcast` to
///      sequence the 3 txs (avoids *in-flight transaction limit*).
contract AgenticSubdomainRegisterThree is Script {
    /// @dev `REGISTRAR_CONTRACT_ADDRESS=0x... forge script ...`
    function run() public {
        registerThree(vm.envAddress("REGISTRAR_CONTRACT_ADDRESS"));
    }

    /// @dev `forge script ... --sig "runWithAddress(address)" 0x...` (only one `run` in the ABI for Foundry).
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

        r.setSubdomain("agent0", subnameOwner, parentExpiry);
        r.setSubdomain("agent1", subnameOwner, parentExpiry);
        r.setSubdomain("agent2", subnameOwner, parentExpiry);

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
