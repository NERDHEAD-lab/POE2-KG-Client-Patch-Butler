import axios from 'axios';

const testUrl = 'https://patch.poe2.kakaogames.com/production/patch/4.4.0.1.2/PathOfExile_KG.exe';

async function test() {
    console.log('Testing connection to:', testUrl);

    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    };

    try {
        const resp = await axios.head(testUrl, { headers });
        console.log('HEAD Success! Status:', resp.status);
    } catch (e: any) {
        console.error('HEAD Failed:', e.message);
        if (e.response) {
            console.error('Status:', e.response.status);
            console.error('Data:', e.response.data);
        }
    }

    // Try GET with stream
    /*
    try {
        const resp = await axios.get(testUrl, { headers, responseType: 'stream' });
        console.log('GET Stream Success! Status:', resp.status);
    } catch (e: any) {
        console.error('GET Stream Failed:', e.message);
    }
    */
}

test();
