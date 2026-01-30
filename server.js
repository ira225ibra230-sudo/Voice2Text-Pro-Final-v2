// Force disable SSL verification globally for this process
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 3000;
const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
    // Enable CORS for all responses
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle OPTIONS for preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const parsedUrl = url.parse(req.url, true);

    // 1. Proxy Endpoint
    if (parsedUrl.pathname === '/proxy' && req.method === 'POST') {
        const targetUrl = parsedUrl.query.url;

        if (!targetUrl) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Target URL required' }));
            return;
        }

        console.log(`[Proxy] Forwarding to: ${targetUrl}`);

        const targetUrlParsed = url.parse(targetUrl);
        const lib = targetUrl.startsWith('https') ? require('https') : require('http');

        // Copy and clean headers
        const proxyHeaders = { ...req.headers };
        delete proxyHeaders['host'];
        delete proxyHeaders['connection'];
        delete proxyHeaders['origin'];
        delete proxyHeaders['referer'];

        const proxyReq = lib.request({
            hostname: targetUrlParsed.hostname,
            port: targetUrlParsed.port || (targetUrl.startsWith('https') ? 443 : 80),
            path: targetUrlParsed.path,
            method: 'POST',
            headers: proxyHeaders,
            rejectUnauthorized: false
        }, (proxyRes) => {
            // Forward status and headers from target
            res.writeHead(proxyRes.statusCode, proxyRes.headers);
            proxyRes.pipe(res);
        });

        proxyReq.on('error', (e) => {
            console.error(`[Proxy Error] ${e.message}`);
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Bad Gateway: ' + e.message }));
        });

        req.pipe(proxyReq);
        return;
    }

    // 2. Static File Serving
    let filePath = '.' + req.url;
    if (filePath === './') filePath = './index.html';

    filePath = filePath.split('?')[0];

    const extname = path.extname(filePath);
    const contentType = MIME_TYPES[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code == 'ENOENT') {
                res.writeHead(404);
                res.end('File not found');
            } else {
                res.writeHead(500);
                res.end('Server Error: ' + error.code);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

console.log(`Server running at http://localhost:${PORT}/`);
console.log('Use this address to open the app (SSL bypass active).');
server.listen(PORT);
