[console]::InputEncoding = [console]::OutputEncoding = New-Object System.Text.UTF8Encoding
$path = 'c:\Users\faar_\ESWAP\0x-examples\rfq-api-wrapper\src\config\chains.ts'
$content = Get-Content $path
$newContent = @()

foreach ($line in $content) {
    $newContent += $line
    if ($line -match 'ensoRouter\?: string;') {
        $newContent += "    dexs?: {"
        $newContent += "        uniswapV3?: { quoter: string; router: string };"
        $newContent += "        sushiSwapV3?: { quoter?: string; router: string };"
        $newContent += "        pancakeSwapV3?: { quoter: string; router: string };"
        $newContent += "        quickSwapV3?: { quoter?: string; router: string };"
        $newContent += "        velodromeV2?: { router: string };"
        $newContent += "        aerodrome?: { router: string };"
        $newContent += "        dodoV2?: { proxy: string };"
        $newContent += "        idexV3?: { exchange: string };"
        $newContent += "    };"
    }
    
    # Optimism
    if ($line -match "name: 'Optimism',") {
        # $newContent already added the name line. Let's add the dexs object.
        $newContent += "        dexs: {"
        $newContent += "            uniswapV3: { quoter: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e', router: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45' },"
        $newContent += "            velodromeV2: { router: '0xa062ae8a9C5E11Aaa026Fc2670B0D65ccc8B2858' }"
        $newContent += "        },"
    }
    
    # BSC
    if ($line -match "name: 'BSC',") {
        $newContent += "        dexs: {"
        $newContent += "            uniswapV3: { quoter: '0xB216168972Ea4b3A23386e8A84358fBe3df98A2c', router: '0x13f4EA83D0bd40E75C8222255bc855a974568Dd4' },"
        $newContent += "            pancakeSwapV3: { quoter: '0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997', router: '0x13f4EA83D0bd40E75C8222255bc855a974568Dd4' }"
        $newContent += "        },"
    }
    
    # Polygon
    if ($line -match "name: 'Polygon',") {
        $newContent += "        dexs: {"
        $newContent += "            uniswapV3: { quoter: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e', router: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45' },"
        $newContent += "            quickSwapV3: { quoter: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e', router: '0xf5b509bb0907A47A701919191919191919168e12' },"
        $newContent += "            sushiSwapV3: { router: '0x1b02dA8Cb0d097eb8D57A175b88c7D8b47997506' },"
        $newContent += "            dodoV2: { proxy: '0x2fA4334cfD7c56a0E7Ca02BD81455205FcBDc5E9' },"
        $newContent += "            idexV3: { exchange: '0x3253a7e75539edaeb1db608ce6ef9aa1ac9126b6' }"
        $newContent += "        },"
    }
    
    # Base
    if ($line -match "name: 'Base',") {
        $newContent += "        dexs: {"
        $newContent += "            uniswapV3: { quoter: '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a', router: '0x2626664c2603336E57B271c5C0b26F421741e481' },"
        $newContent += "            aerodrome: { router: '0xcf77a3ba9A5CA399B7c97c74d54e5b1Beb874E43' },"
        $newContent += "            sushiSwapV3: { router: '0xc35dadb65012ec5796536bd9864ed8773abc74c4' },"
        $newContent += "            pancakeSwapV3: { quoter: '0xFE6508f0015C778Bdcc1fB5465bA5ebE224C9912', router: '0x678Aa4bF4E210cf2166753e054d5b7c31cc7fa86' },"
        $newContent += "            dodoV2: { proxy: '0x4CAD0052524648A7Fa2cfE279997b00239295F33' }"
        $newContent += "        },"
    }
    
    # Arbitrum
    if ($line -match "name: 'Arbitrum',") {
        $newContent += "        dexs: {"
        $newContent += "            uniswapV3: { quoter: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e', router: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45' },"
        $newContent += "            sushiSwapV3: { router: '0xf2614A233c7C3e7f08b1F887Ba133a13f1eb2c55' },"
        $newContent += "            pancakeSwapV3: { quoter: '0xFE6508f0015C778Bdcc1fB5465bA5ebE224C9912', router: '0x32226588378236Fd0c7c4053999F88aC0e5cAc77' },"
        $newContent += "            dodoV2: { proxy: '0x3B6067D4CAa8A14c63fdBE6318F27A0bBc9F9237' }"
        $newContent += "        },"
    }
}

$newContent | Set-Content $path -Encoding UTF8
