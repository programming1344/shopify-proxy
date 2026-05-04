const http = require('http');
const https = require('https');
const url = require('url');
const { URLSearchParams } = require('url');

const PORT = process.env.PORT || 8080;
const SHOPIFY_SHOP = 'thevelvetveils';
const CLIENT_ID = 'f6c1d8fa99af1786c3f2166bd7a1ea52';
const CLIENT_SECRET = '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';

console.log('🚀 Shopify API Proxy Server Starting...');
console.log('Port:', PORT);
console.log('Shop:', SHOPIFY_SHOP);

let token = null;
let tokenExpiresAt = 0;

// Get OAuth access token using client_credentials flow
async function getToken() {
    if (token && Date.now() < tokenExpiresAt - 60000) {
        return token;
    }

    console.log('🔑 Fetching new access token...');

    return new Promise((resolve, reject) => {
        const postData = new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
        }).toString();

        const options = {
            hostname: `${SHOPIFY_SHOP}.myshopify.com`,
            path: '/admin/oauth/access_token',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    const { access_token, expires_in } = JSON.parse(data);
                    token = access_token;
                    tokenExpiresAt = Date.now() + (expires_in * 1000);
                    console.log('✅ Got new access token, expires in', expires_in, 'seconds');
                    resolve(token);
                } else {
                    console.error('❌ Token request failed:', res.statusCode, data);
                    reject(new Error(`Token request failed: ${res.statusCode}`));
                }
            });
        });

        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    const parsedUrl = url.parse(req.url, true);
    let shopifyPath = parsedUrl.path;

    if (shopifyPath === '/' || shopifyPath === '') {
        shopifyPath = '/admin/api/2024-01/products.json?limit=50';
    }

    console.log(`${new Date().toISOString()} - ${req.method} ${shopifyPath}`);

    try {
        const accessToken = await getToken();

        const options = {
            hostname: `${SHOPIFY_SHOP}.myshopify.com`,
            path: shopifyPath,
            method: req.method,
            headers: {
                'X-Shopify-Access-Token': accessToken,
                'Content-Type': 'application/json',
                'User-Agent': 'Shopify-Proxy/2.0'
            }
        };

        const shopifyReq = https.request(options, (shopifyRes) => {
            let data = '';

            shopifyRes.on('data', chunk => {
                data += chunk;
            });

            shopifyRes.on('end', () => {
                console.log(`  → Shopify: ${shopifyRes.statusCode}`);
                
                res.writeHead(shopifyRes.statusCode, {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                });
                res.end(data);
            });
        });

        shopifyReq.on('error', (error) => {
            console.error('  ✗ Proxy error:', error.message);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                error: 'Proxy error',
                message: error.message
            }));
        });

        if (req.method === 'POST' || req.method === 'PUT') {
            let body = '';
            req.on('data', chunk => {
                body += chunk;
            });
            req.on('end', () => {
                if (body) {
                    shopifyReq.write(body);
                }
                shopifyReq.end();
            });
        } else {
            shopifyReq.end();
        }

    } catch (error) {
        console.error('  ✗ Auth error:', error.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            error: 'Authentication error',
            message: error.message
        }));
    }
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Shopify Proxy Server running on port ${PORT}`);
    console.log('Ready to proxy requests with OAuth authentication');
});

process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});
