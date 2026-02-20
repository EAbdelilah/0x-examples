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

interface ISkyFlashMint {
    function flashLoan(
        address receiver,
        address token,
        uint256 amount,
        bytes calldata data
    ) external returns (bool);
}

interface IMorphoBlue {
    function flashLoan(
        address token,
        uint256 assets,
        bytes calldata data
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
    ISkyFlashMint public skyFlash;
    IMorphoBlue public morpho;
    address public immutable zeroExProxy;

    constructor(address _vault, address _zeroExProxy) Ownable(msg.sender) {
        vault = IBalancerVault(_vault);
        zeroExProxy = _zeroExProxy;
    }

    function setProviders(address _sky, address _morpho) external onlyOwner {
        skyFlash = ISkyFlashMint(_sky);
        morpho = IMorphoBlue(_morpho);
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

    function executeBalancer(
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

    function executeSky(
        address tokenToBorrow,
        uint256 amountToBorrow,
        bytes calldata params
    ) external onlyOwner {
        skyFlash.flashLoan(address(this), tokenToBorrow, amountToBorrow, params);
    }

    function executeMorpho(
        address tokenToBorrow,
        uint256 amountToBorrow,
        bytes calldata params
    ) external onlyOwner {
        morpho.flashLoan(tokenToBorrow, amountToBorrow, params);
    }

    function receiveFlashLoan(
        address[] memory tokens,
        uint256[] memory amounts,
        uint256[] memory feeAmounts,
        bytes memory userData
    ) external {
        require(msg.sender == address(vault), "Only Vault");
        _executeStrategy(tokens[0], amounts[0], feeAmounts[0], userData);
    }

    function onFlashLoan(
        address initiator,
        address token,
        uint256 amount,
        uint256 fee,
        bytes calldata data
    ) external returns (bytes32) {
        require(msg.sender == address(skyFlash), "Only Sky");
        _executeStrategy(token, amount, fee, data);
        return keccak256("ERC3156FlashBorrower.onFlashLoan");
    }

    function onMorphoFlashLoan(uint256 assets, bytes calldata data) external {
        require(msg.sender == address(morpho), "Only Morpho");
        // For Morpho, the token is passed in data or we assume it's the one currently being handled
        FlashParams memory params = abi.decode(data, (FlashParams));
        _executeStrategy(params.sellToken, assets, 0, data);
    }

    function _executeStrategy(
        address token,
        uint256 amount,
        uint256 fee,
        bytes memory data
    ) internal {
        FlashParams memory params = abi.decode(data, (FlashParams));

        // 1. Approve 0x to spend the borrowed tokens
        IERC20(token).approve(zeroExProxy, amount);

        // 2. Execute 0x Swap
        (bool success, ) = zeroExProxy.call(params.zeroExData);
        require(success, "0x Swap Failed");

        // 3. Deliver to Aggregator (Reactor)
        (success, ) = params.targetReactor.call(params.reactorData);
        require(success, "Reactor Fill Failed");

        // 4. Repay Flash Loan
        IERC20(token).transfer(msg.sender, amount + fee);

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
