// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IBalancerVault {
    function flashLoan(
        address recipient,
        address[] memory tokens,
        uint256[] memory amounts,
        bytes memory userData
    ) external;
}

contract AtomicBroker is Ownable {
    IBalancerVault public immutable vault;

    struct Call {
        address target;
        bytes callData;
        uint256 value;
    }

    struct FlashParams {
        address profitToken;
        uint256 minProfit;
        Call[] actions;
    }

    constructor(address _vault) Ownable(msg.sender) {
        vault = IBalancerVault(_vault);
    }

    /**
     * @dev Start the arbitrage by requesting a flashloan from Balancer
     */
    function execute(
        address tokenToBorrow,
        uint256 amountToBorrow,
        bytes calldata params
    ) external onlyOwner {
        address[] memory tokens = new address[](1);
        tokens[0] = tokenToBorrow;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = amountToBorrow;

        vault.flashLoan(address(this), tokens, amounts, params);
    }

    /**
     * @dev Balancer Callback
     */
    function receiveFlashLoan(
        address[] memory tokens,
        uint256[] memory amounts,
        uint256[] memory feeAmounts,
        bytes memory userData
    ) external {
        require(msg.sender == address(vault), "Only Vault");

        FlashParams memory params = abi.decode(userData, (FlashParams));

        // 1. Execute all actions (swaps, etc.)
        for (uint256 i = 0; i < params.actions.length; i++) {
            (bool success, bytes memory result) = params.actions[i].target.call{value: params.actions[i].value}(params.actions[i].callData);
            if (!success) {
                // Return descriptive error if possible
                if (result.length > 0) {
                    assembly {
                        let returndata_size := mload(result)
                        revert(add(32, result), returndata_size)
                    }
                } else {
                    revert("Call Failed");
                }
            }
        }

        // 2. Repay Balancer (Borrowed Amount + Fee)
        IERC20(tokens[0]).transfer(address(vault), amounts[0] + feeAmounts[0]);

        // 3. Profit Verification
        uint256 finalProfit = IERC20(params.profitToken).balanceOf(address(this));
        require(finalProfit >= params.minProfit, "Insufficient Profit");

        // 4. Send profit to owner (if any)
        if (finalProfit > 0) {
            IERC20(params.profitToken).transfer(owner(), finalProfit);
        }
    }

    // Function to withdraw any stuck tokens
    function withdraw(address token) external onlyOwner {
        uint256 balance = IERC20(token).balanceOf(address(this));
        IERC20(token).transfer(owner(), balance);
    }

    // Emergency ETH withdrawal
    function withdrawETH() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }

    receive() external payable {}
}
