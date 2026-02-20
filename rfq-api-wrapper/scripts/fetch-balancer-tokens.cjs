
const https = require('https');
const fs = require('fs');
const path = require('path');

const TOKEN_LIST_URL = 'https://raw.githubusercontent.com/balancer/tokenlists/main/generated/balancer.tokenlist.json';

const TARGET_CHAINS = {
    137: 'Polygon',
    42161: 'Arbitrum',
    8453: 'Base',
    10: 'Optimism',
    43114: 'Avalanche',
    34443: 'Mode',
    534352: 'Scroll',
    250: 'Fantom',
    56: 'BSC',
    1: 'Ethereum',
    1101: 'PolygonZkEVM',
    100: 'Gnosis'
};

function fetchTokens() {
    console.log('Fetching Balancer Token List...');

    https.get(TOKEN_LIST_URL, (res) => {
        let data = '';

        res.on('data', (chunk) => {
            data += chunk;
        });

        res.on('end', () => {
            try {
                const tokenList = JSON.parse(data);
                console.log(`Fetched ${tokenList.tokens.length} tokens.`);

                const groupedTokens = {
                    'Polygon': [],
                    'Arbitrum': [],
                    'Base': [],
                    'Optimism': [],
                    'Avalanche': [],
                    'Mode': [],
                    'Scroll': [],
                    'Fantom': [],
                    'BSC': [],
                    'Ethereum': [],
                    'PolygonZkEVM': [],
                    'Gnosis': []
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

                    if (tokens.length > 0) {
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
                }

                // Ensure docs directory exists
                const docsDir = path.join(process.cwd(), 'docs');
                if (!fs.existsSync(docsDir)) {
                    fs.mkdirSync(docsDir);
                }

                const outputPath = path.join(docsDir, 'BALANCER_TOKENS_LIST.md');
                fs.writeFileSync(outputPath, markdownContent);
                console.log(`\nSuccessfully wrote token list to ${outputPath}`);

            } catch (error) {
                console.error('Error parsing JSON:', error.message);
            }
        });

    }).on('error', (err) => {
        console.error('Error fetching token list:', err.message);
    });
}

fetchTokens();
