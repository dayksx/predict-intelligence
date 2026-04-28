// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Test} from "forge-std/Test.sol";
import {AgenticSubdomain} from "../src/AgenticSubdomain.sol";

contract AgenticSubdomainTest is Test {
    AgenticSubdomain public agenticSubdomain;

    function setUp() public {
        agenticSubdomain = new AgenticSubdomain("agentic");
    }

    function test_SetSubdomain() public {
        agenticSubdomain.setSubdomain("agenticpunk");
        assertEq(agenticSubdomain.subdomain(), "agenticpunk");
    }
}