const axios = require('axios');

const url = 'https://patch.poe2.kakaogames.com/production/patch/4.4.0.1.3/PathOfExile_KG.exe';

async function testConfig(name, config) {
    console.log(`\n--- Testing ${name} ---`);
    try {
        const response = await axios({
            url,
            method: 'GET',
            timeout: 10000,
            validateStatus: () => true, // Don't throw on status code
            ...config
        });
        console.log(`Status: ${response.status} ${response.statusText}`);
        console.log('Headers:', response.headers);
        return response.status === 200;
    } catch (err) {
        console.log(`Error: ${err.message}`);
        if (err.code) console.log(`Code: ${err.code}`);
        return false;
    }
}

async function runDiagnostics() {
    console.log(`Target URL: ${url}`);

    // 1. Current Configuration
    await testConfig('Current Config', {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Connection': 'keep-alive'
        },
        responseType: 'stream'
    });

    // 2. Minimal Headers (Axios default)
    await testConfig('Minimal Headers', {
        responseType: 'stream'
    });

    // 3. With Referer
    await testConfig('With Referer', {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': 'https://poe2.kakaogames.com/',
            'Origin': 'https://poe2.kakaogames.com'
        },
        responseType: 'stream'
    });

    // 4. Accept-Encoding: identity (No compression)
    await testConfig('Identity Encoding', {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Encoding': 'identity'
        },
        responseType: 'stream'
    });
}

runDiagnostics();
