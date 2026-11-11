// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {PuzzleLeague} from "../src/PuzzleLeague.sol";

/**
 * @notice Deploy PuzzleLeague to Arc Testnet.
 *
 *   forge script script/Deploy.s.sol \
 *     --rpc-url $ARC_RPC_URL \
 *     --private-key $PRIVATE_KEY \
 *     --broadcast \
 *     --sig "run(address,address,address)" \
 *     <USDC> <HOLDER_POOL> <PLATFORM_FEE>
 *
 * Default USDC on Arc Testnet: 0x3600000000000000000000000000000000000000
 */
contract Deploy is Script {
    function run(address usdc, address holderPool, address platformFee) external {
        vm.startBroadcast();
        new PuzzleLeague(usdc, holderPool, platformFee);
        vm.stopBroadcast();
    }
}
