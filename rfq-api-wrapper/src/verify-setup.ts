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
              taker: '0x0000000000000000000000000000000000000000',
              chainId: 1
          });
          logger.info('✅ 0x API connectivity successful (Mainnet)');
      } catch (e: any) {
          logger.error(`❌ 0x API connectivity failed: ${e.message}`);
      }
  }

  logger.info('--- Verification Complete ---');
}

verify();
