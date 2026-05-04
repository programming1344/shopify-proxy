const http = require('http');
const https = require('https');
const url = require('url');

const PORT = process.env.PORT || 3000;
const SHOPIFY_STORE = 'thevelvetveils.myshopify.com';
const SHOPIFY_TOKEN = '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';

console.log('🚀 Shopify API Proxy Server Starting...');
console.log('Port:', PORT);
console.log('Proxying to:', SHOPIFY_STORE);

const server = http.createServer((req, res) => {
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

    const options = {
        hostname: SHOPIFY_STORE,
        path: shopifyPath,
        method: req.method,
        headers: {
            'X-Shopify-Access-Token': SHOPIFY_TOKEN,
            'Content-Type': 'application/json'
        }
    };

    const shopifyReq = https.request(options, (shopifyRes) => {
        let data = '';
        shopifyRes.on('data', chunk => data += chunk);
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
        console.error('Proxy error:', error.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Proxy error', message: error.message }));
    });

    if (req.method === 'POST' || req.method === 'PUT') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            if (body) shopifyReq.write(body);
            shopifyReq.end();
        });
    } else {
        shopifyReq.end();
    }
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Proxy running on port ${PORT}`);
});
