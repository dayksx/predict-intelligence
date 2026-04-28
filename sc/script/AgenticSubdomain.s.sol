// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script} from "forge-std/Script.sol";
import {AgenticSubdomain} from "../src/AgenticSubdomain.sol";

contract AgenticSubdomainScript is Script {
    AgenticSubdomain public agenticSubdomain;

    function setUp() public {}

    function run() public {
        vm.startBroadcast();

        agenticSubdomain = new AgenticSubdomain("agentic");
        agenticSubdomain.setSubdomain("agenticpunk");
        vm.stopBroadcast();
    }
}
