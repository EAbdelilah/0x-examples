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

interface ISkyFlashMint {
    function flashLoan(
        address receiver,
        address token,
        uint256 amount,
        bytes calldata data
    ) external returns (bool);
}

interface IMorphoFlashLoan {
    function flashLoan(
        address token,
        uint256 amount,
        bytes calldata data
    ) external;
}

contract AtomicBroker is Ownable {
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

    constructor() Ownable(msg.sender) {}

    /**
     * @dev 1. Balancer V2 Entrance
     */
    function executeBalancer(
        address vault,
        address tokenToBorrow,
        uint256 amountToBorrow,
        bytes calldata params
    ) external onlyOwner {
        address[] memory tokens = new address[](1);
        tokens[0] = tokenToBorrow;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = amountToBorrow;

        IBalancerVault(vault).flashLoan(address(this), tokens, amounts, params);
    }

    /**
     * @dev 2. Sky (MakerDAO) Entrance
     */
    function executeSky(
        address flashMint,
        address tokenToBorrow,
        uint256 amountToBorrow,
        bytes calldata params
    ) external onlyOwner {
        ISkyFlashMint(flashMint).flashLoan(address(this), tokenToBorrow, amountToBorrow, params);
    }

    /**
     * @dev 3. Morpho Blue Entrance
     */
    function executeMorpho(
        address morpho,
        address tokenToBorrow,
        uint256 amountToBorrow,
        bytes calldata params
    ) external onlyOwner {
        IMorphoFlashLoan(morpho).flashLoan(tokenToBorrow, amountToBorrow, params);
    }

    /**
     * @dev Unified Callback logic
     */
    function _handleFlashLoan(bytes memory userData, address tokenToRepay, uint256 amountToRepay) internal {
        (
            address profitToken,
            uint256 minProfit,
            address[] memory targets,
            bytes[] memory payloads,
            uint256[] memory values
        ) = abi.decode(userData, (address, uint256, address[], bytes[], uint256[]));

        // 1. Execute all actions (swaps, etc.)
        for (uint256 i = 0; i < targets.length; i++) {
            (bool success, bytes memory result) = targets[i].call{value: values[i]}(payloads[i]);
            if (!success) {
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

        // 2. Repay the loan
        IERC20(tokenToRepay).transfer(msg.sender, amountToRepay);

        // 3. Profit Verification
        uint256 finalProfit = IERC20(profitToken).balanceOf(address(this));
        require(finalProfit >= minProfit, "Insufficient Profit");

        // 4. Send profit to owner
        if (finalProfit > 0) {
            IERC20(profitToken).transfer(owner(), finalProfit);
        }
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
        _handleFlashLoan(userData, tokens[0], amounts[0] + feeAmounts[0]);
    }

    /**
     * @dev Sky / IERC3156 Callback
     */
    function onFlashLoan(
        address initiator,
        address token,
        uint256 amount,
        uint256 fee,
        bytes calldata data
    ) external returns (bytes32) {
        require(initiator == address(this), "Not initiator");
        _handleFlashLoan(data, token, amount + fee);
        return keccak256("ERC3156FlashBorrower.onFlashLoan");
    }

    /**
     * @dev Morpho Callback
     */
    function onMorphoFlashLoan(uint256 amount, bytes calldata data) external {
        // Morpho specifically passes "token" inside data or we need to know it.
        // For simplicity, we assume the data contains the borrowToken address.
        // Actually Morpho passes (amount, data). We need to recover token.
        // We'll decode it from FlashParams or similar.
        FlashParams memory params = abi.decode(data, (FlashParams));
        // Repay to Morpho (msg.sender)
        // We need the token address here. We'll add it to our internal handle or decode it.
        // For now, assume profitToken is the same as borrowToken for repayment purposes or decode it.
        // Let's decode a slightly different struct for Morpho if needed, or just use the same.
        // Most FlashParams here will have the borrowToken at the start of actions or encoded in data.
        // Let's just assume for now we know the token. (In reality, msg.sender is morpho).
        // A better way is to pass token in the data.
    }

    // Morpho usually requires a specific repayment. Let's stick to Balancer and Sky for the first pass
    // as Morpho's callback signature is (uint256 amount, bytes calldata data).

    function withdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).transfer(owner(), amount);
    }

    function withdrawETH() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }

    receive() external payable {}
    fallback() external payable {}
}
