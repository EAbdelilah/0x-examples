import fs from 'fs';
import path from 'path';

const filePath = path.resolve('src/config/chains.ts');
const content = fs.readFileSync(filePath, 'utf8');

// Regex to find unquoted keys starting with digits inside objects
// We look for patterns like:   123ABC: '0x...'
// It should handle different indentation.
const fixedContent = content.replace(/^(\s+)(\d\w+):/gm, (match, indent, key) => {
    return `${indent}'${key}':`;
});

fs.writeFileSync(filePath, fixedContent);
console.log('Successfully fixed syntax errors in chains.ts');
