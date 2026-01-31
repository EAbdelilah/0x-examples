import dotenv from 'dotenv';
import { ZeroExService } from './services/zeroExService';
import logger from './utils/logger';
import { privateKeyToAccount } from 'viem/accounts';
import { Hex } from 'viem';

dotenv.config();

async function verify() {
    logger.info('--- Setup Verification ---');

    const { ZERO_EX_API_KEY, PRIVATE_KEY, MM_ADDRESS } = process.env;

    // 1. Check Env Vars
    if (!ZERO_EX_API_KEY) logger.error('❌ ZERO_EX_API_KEY is missing');
    else logger.info('✅ ZERO_EX_API_KEY is present');

    if (!PRIVATE_KEY) logger.error('❌ PRIVATE_KEY is missing');
    else {
        try {
            const account = privateKeyToAccount(`0x${PRIVATE_KEY.replace('0x', '')}` as Hex);
            logger.info(`✅ PRIVATE_KEY is valid. Derived Address: ${account.address}`);

            if (MM_ADDRESS && MM_ADDRESS.toLowerCase() !== account.address.toLowerCase()) {
                logger.warn(`⚠️ MM_ADDRESS in .env (${MM_ADDRESS}) does not match derived address (${account.address})`);
            }
        } catch (e) {
            logger.error('❌ PRIVATE_KEY is invalid');
        }
    }

    // 2. Test 0x API Connectivity
    if (ZERO_EX_API_KEY) {
        const zeroEx = new ZeroExService(ZERO_EX_API_KEY);
        try {
            // Test with a simple price request on Ethereum (Chain 1)
            await zeroEx.getPrice({
                sellToken: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', // WETH
                buyToken: '0xdac17f958d2ee523a2206206994597c13d831ec7', // USDT
                sellAmount: '1000000000000000000', // 1 WETH
                taker: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045', // vitalik.eth
                chainId: 1
            });
            logger.info('✅ 0x API connectivity successful (Mainnet)');
        } catch (e: any) {
            logger.error(`❌ 0x API connectivity failed (Mainnet): ${e.message}`);
        }

        try {
            // Test with a simple price request on Base (Chain 8453)
            await zeroEx.getPrice({
                sellToken: '0x4200000000000000000000000000000000000006', // WETH (Base)
                buyToken: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA', // USDbC (Base bridged)
                sellAmount: '10000000000000000', // 0.01 WETH
                chainId: 8453
            });
            logger.info('✅ 0x API connectivity successful (Base)');
        } catch (e: any) {
            logger.error(`❌ 0x API connectivity failed (Base): ${e.message}`);
        }

        try {
            // Test with a simple price request on Polygon (Chain 137)
            await zeroEx.getPrice({
                sellToken: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', // WETH
                buyToken: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063', // DAI
                sellAmount: '10000000000000000', // 0.01 WETH
                chainId: 137
            });
            logger.info('✅ 0x API connectivity successful (Polygon WETH/DAI)');
        } catch (e: any) {
            logger.error(`❌ 0x API connectivity failed (Polygon): ${e.message}`);
        }

        try {
            // Test Monad (Chain 143) [Mainnet Addresses]
            await zeroEx.getPrice({
                sellToken: '0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A', // WMON
                buyToken: '0x754704Bc059F8C67012fEd69BC8A327a5aafb603', // USDC
                sellAmount: '100000000000000000', // 0.1 WMON
                chainId: 143
            });
            logger.info('✅ 0x API connectivity successful (Monad)');
        } catch (e: any) {
            logger.warn(`⚠️ 0x API connectivity warning (Monad): ${e.message} (Is Monad Mainnet live and liquid?)`);
        }

        try {
            // Test Sonic (Chain 146)
            // WS: 0x039e2fB66102314Ce7b64Ce5Ce3E5183bc94aD38
            // USDC: 0x29219dd400f2Bf60E5a23d13Be72B486D4038894
            await zeroEx.getPrice({
                sellToken: '0x039e2fB66102314Ce7b64Ce5Ce3E5183bc94aD38', // WS
                buyToken: '0x29219dd400f2Bf60E5a23d13Be72B486D4038894', // USDC
                sellAmount: '100000000000000000', // 0.1 WS
                chainId: 146
            });
            logger.info('✅ 0x API connectivity successful (Sonic)');
        } catch (e: any) {
            logger.warn(`⚠️ 0x API connectivity warning (Sonic): ${e.message}`);
        }

        try {
            // Test Zora (Chain 7777777)
            // WETH: 0x4200000000000000000000000000000000000006
            // USDC: 0xcccccccc7021b32ebb4e8c08314bd62f7c653ec4
            await zeroEx.getPrice({
                sellToken: '0x4200000000000000000000000000000000000006', // WETH
                buyToken: '0xcccccccc7021b32ebb4e8c08314bd62f7c653ec4', // USDC
                sellAmount: '100000000000000000', // 0.1 WETH
                chainId: 7777777
            });
            logger.info('✅ 0x API connectivity successful (Zora)');
        } catch (e: any) {
            logger.warn(`⚠️ 0x API connectivity warning (Zora): ${e.message}`);
        }

        try {
            // Test Unichain (Chain 130)
            // WETH: 0x4200000000000000000000000000000000000006
            // USDC: 0x078D782b760474a361dDA0AF3839290b0EF57AD6
            await zeroEx.getPrice({
                sellToken: '0x4200000000000000000000000000000000000006', // WETH
                buyToken: '0x078D782b760474a361dDA0AF3839290b0EF57AD6', // USDC
                sellAmount: '100000000000000000', // 0.1 WETH
                chainId: 130
            });
            logger.info('✅ 0x API connectivity successful (Unichain)');
        } catch (e: any) {
            logger.warn(`⚠️ 0x API connectivity warning (Unichain): ${e.message}`);
        }
    }

    logger.info('--- Verification Complete ---');
}

verify();
