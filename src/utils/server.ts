
import http from 'http';
import { logger } from './logger.js';

let server: http.Server | null = null;
const START_PORT = 19999;
const MAX_PORT_ATTEMPTS = 10;

/**
 * Starts a local HTTP server to listen for extension verification requests.
 * Scans for an available port starting from START_PORT.
 * @returns The port number the server is listening on.
 */
export const startServer = async (): Promise<number> => {
    for (let offset = 0; offset < MAX_PORT_ATTEMPTS; offset++) {
        const port = START_PORT + offset;
        try {
            await new Promise<void>((resolve, reject) => {
                const s = http.createServer((req, res) => {
                    // Set CORS headers to allow requests from the extension
                    res.setHeader('Access-Control-Allow-Origin', '*');
                    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
                    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

                    if (req.method === 'OPTIONS') {
                        res.writeHead(204);
                        res.end();
                        return;
                    }

                    if (req.url === '/verify' && req.method === 'GET') {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ 
                            status: 'ok', 
                            version: process.env.APP_VERSION || 'unknown' 
                        }));
                        
                        onVerifyCallbacks.forEach(cb => cb());
                        return;
                    }

                    // [New] Auto Launch Enable Verification
                    if (req.url === '/enable_auto_launch' && req.method === 'GET') {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ status: 'enabled' }));
                        
                        onEnableAutoLaunchCallbacks.forEach(cb => cb());
                        return;
                    }

                    // [New] Game Execution ACK
                    if (req.url === '/ack' && req.method === 'GET') {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ status: 'ack_received' }));
                        
                        onAckCallbacks.forEach(cb => cb());
                        return;
                    }

                    res.writeHead(404);
                    res.end();
                });

                s.on('error', (err: any) => {
                    if (err.code === 'EADDRINUSE') {
                        s.close();
                        reject(err);
                    } else {
                        reject(err);
                    }
                });

                s.listen(port, '127.0.0.1', () => {
                    server = s;
                    resolve();
                });
            });

            logger.info(`Local server started on port ${port}`);
            return port;
        } catch (e) {
            // Port in use, try next one
            continue;
        }
    }
    throw new Error(`Could not find an available port starting from ${START_PORT}`);
};

type VerifyCallback = () => void;
let onVerifyCallbacks: VerifyCallback[] = [];
let onAckCallbacks: VerifyCallback[] = [];
let onEnableAutoLaunchCallbacks: VerifyCallback[] = [];

export const onExtensionVerified = (callback: VerifyCallback) => {
    onVerifyCallbacks.push(callback);
};

export const onExtensionAck = (callback: VerifyCallback) => {
    onAckCallbacks.push(callback);
};

export const onExtensionEnableAutoLaunch = (callback: VerifyCallback) => {
    onEnableAutoLaunchCallbacks.push(callback);
};

export const stopServer = () => {
    if (server) {
        server.close();
        server = null;
    }
    onVerifyCallbacks = [];
    onAckCallbacks = [];
    onEnableAutoLaunchCallbacks = [];
};
