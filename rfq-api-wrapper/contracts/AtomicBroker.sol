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

interface IMorpho {
    function flashLoan(address token, uint256 assets, bytes calldata data) external;
}

interface IERC3156FlashBorrower {
    function onFlashLoan(
        address initiator,
        address token,
        uint256 amount,
        uint256 fee,
        bytes calldata data
    ) external returns (bytes32);
}

interface IERC3156FlashLender {
    function flashLoan(
        IERC3156FlashBorrower receiver,
        address token,
        uint256 amount,
        bytes calldata data
    ) external returns (bool);
}

contract AtomicBroker is Ownable, IERC3156FlashBorrower {
    enum Provider { BALANCER, MORPHO, SKY }

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

    // Mapping to track authorized providers to prevent callback spoofing
    mapping(address => bool) public authorizedProviders;

    constructor() Ownable(msg.sender) {}

    function setProviderAuthorization(address provider, bool authorized) external onlyOwner {
        authorizedProviders[provider] = authorized;
    }

    /**
     * @dev Start the arbitrage using a specific flashloan provider
     */
    function execute(
        Provider provider,
        address providerAddress,
        address tokenToBorrow,
        uint256 amountToBorrow,
        bytes calldata params
    ) external onlyOwner {
        require(authorizedProviders[providerAddress], "Unauthorized provider");

        if (provider == Provider.BALANCER) {
            address[] memory tokens = new address[](1);
            tokens[0] = tokenToBorrow;
            uint256[] memory amounts = new uint256[](1);
            amounts[0] = amountToBorrow;
            IBalancerVault(providerAddress).flashLoan(address(this), tokens, amounts, params);
        } else if (provider == Provider.MORPHO) {
            // We wrap the token address with the params so the callback knows what to repay
            bytes memory data = abi.encode(tokenToBorrow, params);
            IMorpho(providerAddress).flashLoan(tokenToBorrow, amountToBorrow, data);
        } else if (provider == Provider.SKY) {
            IERC3156FlashLender(providerAddress).flashLoan(this, tokenToBorrow, amountToBorrow, params);
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
        require(authorizedProviders[msg.sender], "Only Authorized Providers");
        _afterFlashLoan(userData, tokens[0], amounts[0] + feeAmounts[0]);
    }

    /**
     * @dev Morpho Callback
     */
    function onMorphoFlashLoan(uint256 assets, bytes calldata data) external {
        require(authorizedProviders[msg.sender], "Only Authorized Providers");
        (address tokenToRepay, bytes memory userData) = abi.decode(data, (address, bytes));
        _afterFlashLoan(userData, tokenToRepay, assets);
    }

    /**
     * @dev ERC3156 Callback (Sky/Maker)
     */
    function onFlashLoan(
        address initiator,
        address token,
        uint256 amount,
        uint256 fee,
        bytes calldata data
    ) external override returns (bytes32) {
        require(authorizedProviders[msg.sender], "Only Authorized Providers");
        require(initiator == address(this), "Only local initiator");

        _afterFlashLoan(data, token, amount + fee);

        return keccak256("ERC3156FlashBorrower.onFlashLoan");
    }

    /**
     * @dev Internal logic executed after receiving funds
     */
    function _afterFlashLoan(
        bytes memory userData,
        address tokenToRepay,
        uint256 amountToRepay
    ) internal {
        FlashParams memory params = abi.decode(userData, (FlashParams));

        // 1. Execute all actions (swaps, etc.)
        for (uint256 i = 0; i < params.actions.length; i++) {
            (bool success, bytes memory result) = params.actions[i].target.call{value: params.actions[i].value}(params.actions[i].callData);
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

        // 2. Repay Provider
        IERC20(tokenToRepay).transfer(msg.sender, amountToRepay);

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
