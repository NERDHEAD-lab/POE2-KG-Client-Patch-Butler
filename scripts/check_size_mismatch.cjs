const axios = require('axios');

const url = 'https://patch.poe2.kakaogames.com/production/patch/4.4.0.1.3/PathOfExile_KG.exe';

async function testEncoding(encoding) {
    console.log(`\nTesting with Accept-Encoding: ${encoding}`);
    try {
        const response = await axios({
            url,
            method: 'GET',
            responseType: 'stream',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept-Encoding': encoding
            }
        });

        const len = response.headers['content-length'];
        console.log(`Content-Length Header: ${len}`);

        let received = 0;
        return new Promise((resolve) => {
            response.data.on('data', (chunk) => {
                received += chunk.length;
                // Just read a bit or all? Reading all takes time for 46MB. 
                // Let's read all to be sure about bytes mismatch unless it's huge. 
                // 46MB is fine.
            });
            response.data.on('end', () => {
                console.log(`Total Bytes Received: ${received}`);
                if (len) {
                    console.log(`Match: ${received == len}`);
                    console.log(`Ratio: ${(received / len * 100).toFixed(2)}%`);
                }
                resolve();
            });
            response.data.on('error', (err) => {
                console.error('Stream error', err);
                resolve();
            });
        });

    } catch (e) {
        console.error('Request failed', e.message);
    }
}

async function run() {
    // 1. Default (Axios sends 'gzip, compress, deflate, br')
    await testEncoding('gzip, deflate, br');

    // 2. Identity
    await testEncoding('identity');
}

run();
