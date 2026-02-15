// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IBalancerVault {
    enum UserBalanceOpKind { WITHDRAW, DEPOSIT, INTERNAL_ETH, UPDATE_INTERNAL_BALANCE }

    struct BatchSwapStep {
        bytes32 poolId;
        uint256 assetInIndex;
        uint256 assetOutIndex;
        uint256 amount;
        bytes userData;
    }

    struct FundManagement {
        address sender;
        bool fromInternalBalance;
        address payable recipient;
        bool toInternalBalance;
    }

    function flashLoan(
        address recipient,
        address[] memory tokens,
        uint256[] memory amounts,
        bytes memory userData
    ) external;
}

interface IZeroEx {
    function transformERC20(
        IERC20 inputToken,
        IERC20 outputToken,
        uint256 inputTokenAmount,
        uint256 minOutputTokenAmount,
        bytes[] memory transformations
    ) external payable returns (uint256 outputTokenAmount);
}

contract AtomicBroker is Ownable {
    IBalancerVault public immutable vault;
    address public immutable zeroExProxy;

    constructor(address _vault, address _zeroExProxy) Ownable(msg.sender) {
        vault = IBalancerVault(_vault);
        zeroExProxy = _zeroExProxy;
    }

    struct FlashParams {
        address sellToken;
        address buyToken;
        uint256 sellAmount;
        uint256 minBuyAmount;
        bytes zeroExData;
        address targetReactor;
        bytes reactorData;
    }

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

    function receiveFlashLoan(
        address[] memory tokens,
        uint256[] memory amounts,
        uint256[] memory feeAmounts,
        bytes memory userData
    ) external {
        require(msg.sender == address(vault), "Only Vault");

        FlashParams memory params = abi.decode(userData, (FlashParams));

        // 1. Approve 0x to spend the borrowed tokens
        IERC20(tokens[0]).approve(zeroExProxy, amounts[0]);

        // 2. Execute 0x Swap
        (bool success, ) = zeroExProxy.call(params.zeroExData);
        require(success, "0x Swap Failed");

        // 3. Deliver to Aggregator (Reactor)
        // This part depends on the specific reactor's interface (UniswapX/Kyber)
        // For UniswapX, we might need to call the Reactor with the filled order
        (success, ) = params.targetReactor.call(params.reactorData);
        require(success, "Reactor Fill Failed");

        // 4. Repay Balancer
        IERC20(tokens[0]).transfer(address(vault), amounts[0] + feeAmounts[0]);

        // 5. Transfer remaining profit to owner
        uint256 profit = IERC20(params.buyToken).balanceOf(address(this));
        require(profit >= params.minBuyAmount, "Insufficient Profit");

        if (profit > 0) {
            IERC20(params.buyToken).transfer(owner(), profit);
        }
    }

    // Function to withdraw any stuck tokens
    function withdraw(address token) external onlyOwner {
        uint256 balance = IERC20(token).balanceOf(address(this));
        IERC20(token).transfer(owner(), balance);
    }

    receive() external payable {}
}
