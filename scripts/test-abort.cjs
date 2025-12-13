const axios = require('axios');

async function test() {
    const url = 'https://patch.poe2.kakaogames.com/production/patch/4.4.0.1.3/PathOfExile_KG.exe';
    console.log(`Testing URL: ${url}`);

    try {
        const response = await axios({
            url,
            method: 'GET',
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        console.log(`Status: ${response.status}`);
        console.log(`Headers:`, response.headers);
    } catch (error) {
        if (error.response) {
            console.error(`Error Status: ${error.response.status}`);
        } else {
            console.error(`Error: ${error.message}`);
            if (error.code) console.error(`Code: ${error.code}`);
        }
    }
}

test();
