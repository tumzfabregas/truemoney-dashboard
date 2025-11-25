import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// In-memory database (Note: On Vercel, this resets on cold starts. For production, use MongoDB/Postgres)
let globalTransactions = [];
// Default Users for Mock/Demo
let users = [
    { id: '1', username: 'admin', password: 'admin', role: 'admin' },
    { id: '2', username: 'staff', password: '1234', role: 'member' }
];

app.get('/api/test', (req, res) => {
  res.send('API is working correctly!');
});

// Webhook Endpoint - GET Handler (For Verification in Browser)
app.get('/api/webhook/truemoney', (req, res) => {
    res.status(200).json({
        status: 'online',
        message: 'Webhook Endpoint is ready. Use POST method to send data.',
        timestamp: new Date().toISOString()
    });
});

// Webhook Endpoint - POST Handler (For Actual Data)
app.post('/api/webhook/truemoney', (req, res) => {
    try {
        const token = req.body.message || req.body.token || req.body;
        let transactionData = {};

        // Check if JWT or JSON
        if (typeof token === 'string' && token.split('.').length === 3) {
            try {
                transactionData = jwt.decode(token);
            } catch (e) {
                console.error("JWT Decode Error", e);
                transactionData = {};
            }
        } else {
            transactionData = token;
        }

        const newTransaction = {
            id: `TXN-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            sender: transactionData.sender_mobile || transactionData.payer_mobile || 'Unknown',
            amount: Number(transactionData.amount || 0),
            date: transactionData.received_time || new Date().toISOString(),
            message: transactionData.message || 'Webhook P2P',
            type: 'INCOME'
        };

        // Add to "Database"
        globalTransactions.unshift(newTransaction);
        
        // Keep only last 50 to prevent memory overflow in lambda
        if (globalTransactions.length > 50) {
            globalTransactions = globalTransactions.slice(0, 50);
        }

        console.log('New Transaction:', newTransaction);
        res.status(200).send({ status: 'success', data: newTransaction });
    } catch (error) {
        console.error('Webhook Error:', error);
        res.status(500).send({ status: 'error', message: error.message });
    }
});

// Get Transactions Endpoint
app.get('/api/transactions', (req, res) => {
    res.json(globalTransactions);
});

// Clear Data Endpoint (For testing)
app.delete('/api/transactions', (req, res) => {
    globalTransactions = [];
    res.json({ status: 'cleared' });
});

// --- User Management API (Example) ---
app.get('/api/users', (req, res) => {
    res.json(users);
});

app.post('/api/users', (req, res) => {
    const { username, password, role } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Missing fields' });
    if (users.find(u => u.username === username)) return res.status(400).json({ error: 'Username taken' });

    const newUser = { id: Date.now().toString(), username, password, role: role || 'member' };
    users.push(newUser);
    res.json(newUser);
});

app.put('/api/users/:id', (req, res) => {
    const id = req.params.id;
    const idx = users.findIndex(u => u.id === id);
    if (idx === -1) return res.status(404).json({ error: 'User not found' });
    
    // Prevent changing username to existing one
    if (req.body.username && users.some(u => u.username === req.body.username && u.id !== id)) {
        return res.status(400).json({ error: 'Username taken' });
    }

    users[idx] = { ...users[idx], ...req.body };
    res.json(users[idx]);
});

app.delete('/api/users/:id', (req, res) => {
    const id = req.params.id;
    const user = users.find(u => u.id === id);
    if (user && user.username === 'admin') return res.status(400).json({ error: 'Cannot delete admin' });
    
    users = users.filter(u => u.id !== id);
    res.json({ status: 'deleted' });
});


export default app;