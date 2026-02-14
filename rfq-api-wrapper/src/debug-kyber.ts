
import axios from 'axios';
async function debug() {
    const url = `https://limit-order.kyberswap.com/read-ks/api/v1/configs/contract-address?chainId=137`; // Polygon
    console.log(`Fetching ${url}`);
    const r = await axios.get(url);
    console.log(JSON.stringify(r.data, null, 2));
}
debug();
