import dotenv from 'dotenv';
import { ArbitrageService } from './services/arbitrageService';
import { ZeroExService } from './services/zeroExService';
import { CHAINS } from './config/chains';
import { parseUnits } from 'viem';

dotenv.config();

async function testLiquidity() {
    const zeroEx = new ZeroExService();
    const arbService = new ArbitrageService(zeroEx);

    // Test USDC on Base (Chain 8453)
    const chainId = 8453;
    const usdc = CHAINS[chainId].tokens.USDC;
    const amount = parseUnits('1000', 6); // 1000 USDC

    console.log(`Testing ArbitrageService.checkProviderLiquidity for USDC on Base...`);

    const balancerProvider = {
        name: 'Balancer',
        type: 'balancer',
        target: CHAINS[chainId].balancerVault
    };

    // This calls the internal method via any cast or we check it via findBestFlashLoanProvider
    const provider = await arbService.findBestFlashLoanProvider(chainId, usdc, amount);

    if (provider) {
        console.log(`✅ Success: Found provider ${provider.name} for ${amount} USDC`);
    } else {
        console.log(`❌ Failed: No provider found for USDC (This would happen if balanceOf failed or was missing)`);
    }
}

testLiquidity().catch(console.error);
