const express = require('express');
const fs = require('fs');
const path = require('path');
const auth = require('basic-auth');

const app = express();
const PORT = 3000;
const DATA_DIR = path.join(__dirname, 'data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
}

app.use(express.json({ limit: '50mb' }));

// Basic Auth Middleware
const basicAuth = (req, res, next) => {
    const user = auth(req);
    const apiUser = process.env.API_USER;
    const apiPass = process.env.API_PASS;

    if (!apiUser || !apiPass) {
        console.error('FATAL: API_USER or API_PASS not set. Exiting.');
        process.exit(1);
    }

    if (!user || user.name !== apiUser || user.pass !== apiPass) {
        res.set('WWW-Authenticate', 'Basic realm="Utility Splitter"');
        return res.status(401).send('Authentication required');
    }
    next();
};

const tenantMiddleware = (req, res, next) => {
    const tenantId = req.headers['x-tenant-id'];
    if (!tenantId) {
        return res.status(400).json({ error: 'X-Tenant-ID header required' });
    }
    // Validate tenantId (alphanumeric and dashes only)
    if (!/^[a-zA-Z0-9-]+$/.test(tenantId)) {
        return res.status(400).json({ error: 'Invalid Tenant ID' });
    }
    req.tenantId = tenantId;
    next();
};

app.use('/api', basicAuth);
app.use('/api', tenantMiddleware);

// KV Store Endpoints
app.get('/api/kv/:key', (req, res) => {
    const key = req.params.key;
    const tenantId = req.tenantId;

    // Sanitize key to prevent directory traversal
    const safeKey = path.basename(key);
    const tenantDir = path.join(DATA_DIR, tenantId);
    const filePath = path.join(tenantDir, `${safeKey}.json`);

    if (fs.existsSync(filePath)) {
        try {
            const data = fs.readFileSync(filePath, 'utf8');
            res.json(JSON.parse(data));
        } catch (e) {
            console.error('Read error:', e);
            res.status(500).json({ error: 'Failed to read data' });
        }
    } else {
        res.status(404).json({ error: 'Key not found' });
    }
});

app.put('/api/kv/:key', (req, res) => {
    const key = req.params.key;
    const tenantId = req.tenantId;

    const safeKey = path.basename(key);
    const tenantDir = path.join(DATA_DIR, tenantId);
    const filePath = path.join(tenantDir, `${safeKey}.json`);

    // Ensure tenant directory exists
    if (!fs.existsSync(tenantDir)) {
        fs.mkdirSync(tenantDir, { recursive: true });
    }

    try {
        fs.writeFileSync(filePath, JSON.stringify(req.body, null, 2));
        res.json({ success: true });
    } catch (e) {
        console.error('Write error:', e);
        res.status(500).json({ error: 'Failed to write data' });
    }
});

// Serve static files from the React frontend app
const distPath = path.join(__dirname, '../dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));

    // The "catchall" handler: for any request that doesn't
    // match one above, send back React's index.html file.
    app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
    });
} else {
    console.warn('Frontend build not found at', distPath);
}

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
