// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script} from "forge-std/Script.sol";

address constant NAME_WRAPPER_SEPOLIA =
    0x0635513f179D50A207757E05759CbD106d7dFcE8;

/// @dev NameWrapper is ERC-1155; `setApprovalForAll` authorizes the registrar to call `setSubnodeRecord` for names you own.
interface IERC1155SetApprovalForAll {
    function setApprovalForAll(address operator, bool approved) external;
}

/// @dev Step 2: broadcast with the private key of the account that **owns** wrapped `agentic.eth` on this network.
///      `registrar` = address returned from `AgenticSubdomainDeploy` (the deployed `AgenticSubdomain`).
contract AgenticSubdomainApprove is Script {
    /// @dev `REGISTRAR_CONTRACT_ADDRESS=0x... forge script ...`
    function run() public {
        approve(vm.envAddress("REGISTRAR_CONTRACT_ADDRESS"));
    }

    /// @dev `forge script ... --sig "runWithAddress(address)" 0x...` (avoids a second `run`: Foundry allows only one `run` in the ABI).
    function runWithAddress(address registrar) public {
        approve(registrar);
    }

    function approve(address registrar) internal {
        vm.startBroadcast();
        IERC1155SetApprovalForAll(NAME_WRAPPER_SEPOLIA).setApprovalForAll(
            registrar,
            true
        );
        vm.stopBroadcast();
    }
}
