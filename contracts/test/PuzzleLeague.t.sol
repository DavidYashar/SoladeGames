// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {PuzzleLeague} from "../src/PuzzleLeague.sol";
import {MockUSDC} from "../src/MockUSDC.sol";

contract PuzzleLeagueTest is Test {
    PuzzleLeague league;
    MockUSDC usdc;

    address owner = address(0xB0B);
    address holder = address(0x10D);
    address platform = address(0xFEE);
    address alice = address(0xA11CE);
    address bob = address(0xB0B2);
    address carol = address(0xC0FFEE);

    uint256 day = 20_705; // arbitrary epoch-day number for tests

    function setUp() public {
        vm.startPrank(owner);
        usdc = new MockUSDC();
        league = new PuzzleLeague(address(usdc), holder, platform);
        usdc.mint(alice, 1000e6);
        usdc.mint(bob, 1000e6);
        usdc.mint(carol, 1000e6);
        vm.stopPrank();
    }

    function enterAs(address p, uint8 tier) internal {
        vm.startPrank(p);
        usdc.approve(address(league), type(uint256).max);
        league.enter(day, tier);
        vm.stopPrank();
    }

    function test_EnterIncreasesPot() public {
        enterAs(alice, 0);
        enterAs(bob, 0);

        assertEq(league.entries(day, 0), 2);
        assertEq(league.pot(day, 0), 200_000);
        assertEq(usdc.balanceOf(address(league)), 200_000);
        assertEq(usdc.balanceOf(alice), 1000e6 - 100_000);
        assertTrue(league.entered(day, 0, alice));
    }

    function test_CannotDoubleEnter() public {
        enterAs(alice, 0);

        vm.startPrank(alice);
        vm.expectRevert("already entered");
        league.enter(day, 0);
        vm.stopPrank();
    }

    function test_EntryFees() public view {
        assertEq(league.entryFees(0), 100_000);
        assertEq(league.entryFees(1), 500_000);
        assertEq(league.entryFees(2), 1_000_000);
    }

    function test_SettleSplitAndClaims() public {
        enterAs(alice, 0);
        enterAs(bob, 0);
        enterAs(carol, 0);

        address[] memory winners = new address[](2);
        winners[0] = alice;
        winners[1] = bob;

        vm.prank(owner);
        league.settle(day, 0, winners);

        assertTrue(league.settled(day, 0));
        // Pot 300_000: 180_000 prize / 75_000 holder / 45_000 platform.
        assertEq(usdc.balanceOf(holder), 75_000);
        assertEq(usdc.balanceOf(platform), 45_000);
        assertEq(league.prizeOf(alice, day, 0), 90_000);
        assertEq(league.prizeOf(bob, day, 0), 90_000);
        assertEq(league.prizeOf(carol, day, 0), 0);

        vm.prank(alice);
        league.claim(day, 0);
        assertEq(usdc.balanceOf(alice), 1000e6 - 100_000 + 90_000);
        assertEq(league.prizeOf(alice, day, 0), 0);

        vm.expectRevert("nothing");
        vm.prank(alice);
        league.claim(day, 0);
    }

    function test_NoDoubleSettle() public {
        enterAs(alice, 0);
        address[] memory winners = new address[](1);
        winners[0] = alice;

        vm.startPrank(owner);
        league.settle(day, 0, winners);
        vm.expectRevert("already settled");
        league.settle(day, 0, winners);
        vm.stopPrank();
    }

    function test_OnlyOwnerCanSettle() public {
        enterAs(alice, 0);
        address[] memory winners = new address[](1);
        winners[0] = alice;

        vm.expectRevert("not owner");
        vm.prank(alice);
        league.settle(day, 0, winners);
    }

    function test_SettleRequiresEntries() public {
        address[] memory winners = new address[](1);
        winners[0] = alice;

        vm.expectRevert("no entries");
        vm.prank(owner);
        league.settle(day, 0, winners);
    }

    function test_WinnerMustBeEntrant() public {
        enterAs(alice, 0);
        address[] memory winners = new address[](1);
        winners[0] = bob; // bob never entered

        vm.expectRevert("not entrant");
        vm.prank(owner);
        league.settle(day, 0, winners);
    }

    function test_DuplicateWinnersRejected() public {
        enterAs(alice, 0);
        enterAs(bob, 0);
        address[] memory winners = new address[](2);
        winners[0] = alice;
        winners[1] = alice;

        vm.expectRevert("dup winner");
        vm.prank(owner);
        league.settle(day, 0, winners);
    }

    function test_DustRemainderStaysInContract() public {
        // 8 copper entries: pot 800_000 → prize 480_000 / 7 winners = 68_571.42… → dust 3.
        address[] memory players = new address[](8);
        for (uint256 i = 0; i < 8; i++) {
            address p = address(uint160(0x1000 + i));
            players[i] = p;
            vm.prank(owner);
            usdc.mint(p, 1000e6);
            enterAs(p, 0);
        }

        address[] memory winners = new address[](7);
        for (uint256 i = 0; i < 7; i++) winners[i] = players[i];

        vm.prank(owner);
        league.settle(day, 0, winners);

        // 480_000 - 7 * 68_571 = 3 units of dust, held inside the unclaimed
        // prize pool. The contract still holds the full 480_000 until claims.
        assertEq(league.prizeOf(players[0], day, 0), 68_571);
        assertEq(usdc.balanceOf(address(league)), 480_000);

        // After all seven winners claim, exactly the 3-unit dust remains.
        for (uint256 i = 0; i < 7; i++) {
            vm.prank(winners[i]);
            league.claim(day, 0);
        }
        assertEq(usdc.balanceOf(address(league)), 3);
    }

    function test_SetSplits() public {
        vm.prank(owner);
        league.setSplits(address(0x1111), address(0x2222));
        assertEq(league.holderPool(), address(0x1111));
        assertEq(league.platformFee(), address(0x2222));
    }

    function test_SetEntryFee() public {
        vm.prank(owner);
        league.setEntryFee(0, 250_000);
        assertEq(league.entryFees(0), 250_000);
    }

    function test_GoldTierFee() public {
        enterAs(alice, 2);
        assertEq(league.pot(day, 2), 1_000_000);
        assertEq(usdc.balanceOf(alice), 1000e6 - 1_000_000);
    }
}
