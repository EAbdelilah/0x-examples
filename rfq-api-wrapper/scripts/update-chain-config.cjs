
const fs = require('fs');
const path = require('path');

const DOCS_PATH = path.join(__dirname, '../docs/BALANCER_TOKENS_LIST.md');
const CONFIG_PATH = path.join(__dirname, '../src/config/chains.ts');

function parseMarkdownTable(markdown) {
    const lines = markdown.split('\n');
    const tokensByChain = {};
    let currentChain = null;

    for (const line of lines) {
        if (line.startsWith('## ')) {
            const match = line.match(/## (.*) \(/);
            if (match) {
                currentChain = match[1].trim();
                tokensByChain[currentChain] = [];
            }
        } else if (line.startsWith('| **')) {
            // | **Symbol** | Name | `Address` | Decimals |
            const parts = line.split('|').map(p => p.trim());
            if (parts.length >= 5) {
                const symbol = parts[1].replace(/\*\*/g, '').trim();
                const address = parts[3].replace(/`/g, '').trim();
                if (currentChain && symbol && address) {
                    // Basic validation to avoid junk
                    if (address.startsWith('0x') && address.length === 42) {
                        tokensByChain[currentChain].push({ symbol, address });
                    }
                }
            }
        }
    }
    return tokensByChain;
}

function updateConfig() {
    console.log('Reading token list from docs...');
    const markdown = fs.readFileSync(DOCS_PATH, 'utf8');
    const newTokens = parseMarkdownTable(markdown);

    console.log('Reading existing config...');
    let configContent = fs.readFileSync(CONFIG_PATH, 'utf8');

    // Mappings from Docs Chain Name to Chain ID in config
    const chainIdMap = {
        'Polygon': 137,
        'Arbitrum': 42161,
        'Base': 8453,
        'Optimism': 10,
        'Avalanche': 43114,
        'Mode': 34443,
        'Scroll': 534352,
        'Fantom': 250,
        'BSC': 56,
        'Ethereum': 1,
        'PolygonZkEVM': 1101,
        'Gnosis': 100
    };

    for (const [chainName, tokens] of Object.entries(newTokens)) {
        const chainId = chainIdMap[chainName];
        if (!chainId) continue;

        console.log(`Updating ${chainName} (Chain ID ${chainId}) with ${tokens.length} tokens...`);

        // Find the block for this chain
        // 137: { ... tokens: { ... } ... }
        const chainRegex = new RegExp(`${chainId}:\\s*{[\\s\\S]*?tokens:\\s*{([\\s\\S]*?)},`, 'g');
        const match = chainRegex.exec(configContent);

        if (match) {
            const currentTokensBlock = match[1];
            let newTokensBlock = currentTokensBlock.trimEnd(); // Keep existing
            if (!newTokensBlock.endsWith(',')) newTokensBlock += ',';
            newTokensBlock += '\n';

            for (const token of tokens) {
                // simple check to avoid duplicates if line already exists
                if (!currentTokensBlock.includes(`'${token.address}'`)) {
                    // sanitized symbol for key
                    const uniqueKey = token.symbol.replace(/[^a-zA-Z0-9]/g, '_');
                    newTokensBlock += `            ${uniqueKey}: '${token.address}',\n`;
                }
            }

            // Replace in file content
            // We need to be careful with replace, so we split the string
            const startIndex = match.index + match[0].indexOf(match[1]);
            const endIndex = startIndex + match[1].length;

            configContent = configContent.substring(0, startIndex) + newTokensBlock + configContent.substring(endIndex);
        } else {
            console.warn(`Could not find config block for Chain ID ${chainId}`);
        }
    }

    fs.writeFileSync(CONFIG_PATH, configContent);
    console.log('Updated src/config/chains.ts successfully.');
}

updateConfig();
