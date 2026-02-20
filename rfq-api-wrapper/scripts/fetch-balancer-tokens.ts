
import axios from 'axios';
import fs from 'fs';
import path from 'path';

const TOKEN_LIST_URL = 'https://raw.githubusercontent.com/balancer/tokenlists/main/generated/balancer.tokenlist.json';

const TARGET_CHAINS: Record<number, string> = {
    137: 'Polygon',
    42161: 'Arbitrum',
    8453: 'Base'
};

interface Token {
    chainId: number;
    address: string;
    name: string;
    symbol: string;
    decimals: number;
    logoURI?: string;
}

interface TokenList {
    name: string;
    timestamp: string;
    tokens: Token[];
}

async function fetchTokens() {
    console.log('Fetching Balancer Token List...');
    try {
        const response = await axios.get<TokenList>(TOKEN_LIST_URL);
        const tokenList = response.data;

        console.log(`Fetched ${tokenList.tokens.length} tokens.`);

        const groupedTokens: Record<string, Token[]> = {
            'Polygon': [],
            'Arbitrum': [],
            'Base': []
        };

        for (const token of tokenList.tokens) {
            const chainName = TARGET_CHAINS[token.chainId];
            if (chainName) {
                groupedTokens[chainName].push(token);
            }
        }

        let markdownContent = '# Balancer V2 Supported Tokens\n\n';
        markdownContent += `Generated from [Balancer Token List](${TOKEN_LIST_URL})\n\n`;

        for (const [chainName, tokens] of Object.entries(groupedTokens)) {
            console.log(`Found ${tokens.length} tokens for ${chainName}`);

            markdownContent += `## ${chainName} (${tokens.length} tokens)\n\n`;
            markdownContent += '| Symbol | Name | Address | Decimals |\n';
            markdownContent += '| :--- | :--- | :--- | :--- |\n';

            // Sort by symbol
            tokens.sort((a, b) => a.symbol.localeCompare(b.symbol));

            for (const token of tokens) {
                markdownContent += `| **${token.symbol}** | ${token.name} | \`${token.address}\` | ${token.decimals} |\n`;
            }
            markdownContent += '\n';
        }

        const outputPath = path.join(process.cwd(), 'docs', 'BALANCER_TOKENS_LIST.md');
        fs.writeFileSync(outputPath, markdownContent);
        console.log(`\nSuccessfully wrote token list to ${outputPath}`);

    } catch (error: any) {
        console.error('Error fetching token list:', error.message);
    }
}

fetchTokens();
