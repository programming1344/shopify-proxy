const http = require('http');
const https = require('https');
const url = require('url');

const PORT = process.env.PORT || 8080;
const SHOPIFY_SHOP = 'da572a-b5';
const SHOPIFY_TOKEN = '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';

console.log('🚀 Shopify API Proxy Server Starting...');
console.log('Port:', PORT);
console.log('Shop:', SHOPIFY_SHOP);

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
        hostname: `${SHOPIFY_SHOP}.myshopify.com`,
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
        console.error('  ✗ Error:', error.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
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
