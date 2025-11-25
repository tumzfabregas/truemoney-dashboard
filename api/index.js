import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Database Connection ---
const MONGODB_URI = process.env.MONGODB_URI;
let isConnected = false;

// Connect to MongoDB if URI is available
if (MONGODB_URI) {
    mongoose.connect(MONGODB_URI)
        .then(() => {
            console.log('✅ Connected to MongoDB');
            isConnected = true;
        })
        .catch(err => console.error('❌ MongoDB Connection Error:', err));
} else {
    console.warn('⚠️ No MONGODB_URI found. Using in-memory storage (Data will be lost on restart).');
}

// --- Schemas & Models ---
const TransactionSchema = new mongoose.Schema({
    id: String,
    sender: String,
    amount: Number,
    date: Date,
    message: String,
    type: String,
    rawPayload: Object // Store original payload for debugging
}, { timestamps: true });

const UserSchema = new mongoose.Schema({
    id: String,
    username: { type: String, unique: true },
    password: String,
    role: String
});

const TransactionModel = mongoose.model('Transaction', TransactionSchema);
const UserModel = mongoose.model('User', UserSchema);

// Fallback In-memory data
let memoryTransactions = [];
let memoryUsers = [
    { id: '1', username: 'admin', password: 'admin', role: 'admin' },
    { id: '2', username: 'staff', password: '1234', role: 'member' }
];

// --- Helper Functions ---
const getTransactions = async () => {
    if (isConnected) {
        // Sort by date descending, limit 100
        return await TransactionModel.find().sort({ date: -1 }).limit(100);
    }
    return memoryTransactions;
};

const saveTransaction = async (data) => {
    if (isConnected) {
        return await TransactionModel.create(data);
    }
    memoryTransactions.unshift(data);
    if (memoryTransactions.length > 50) memoryTransactions = memoryTransactions.slice(0, 50);
    return data;
};

const getUsers = async () => {
    if (isConnected) {
        // Seed default users if empty
        const count = await UserModel.countDocuments();
        if (count === 0) {
            await UserModel.insertMany(memoryUsers);
        }
        return await UserModel.find();
    }
    return memoryUsers;
};

// --- Routes ---

app.get('/api/test', (req, res) => {
  res.send(`API is working. DB Connected: ${isConnected}`);
});

// Webhook Endpoint - GET Handler
app.get('/api/webhook/truemoney', (req, res) => {
    res.status(200).json({
        status: 'online',
        db_status: isConnected ? 'connected' : 'disconnected (using memory)',
        message: 'Webhook Endpoint is ready.',
        timestamp: new Date().toISOString()
    });
});

// Webhook Endpoint - POST Handler
app.post('/api/webhook/truemoney', async (req, res) => {
    try {
        const token = req.body.message || req.body.token || req.body;
        let transactionData = {};

        // Decode logic
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

        let amount = Number(transactionData.amount || 0);
        amount = amount / 100; // Satang to Baht

        const newTransaction = {
            id: `TXN-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            sender: transactionData.sender_mobile || transactionData.payer_mobile || 'Unknown',
            amount: amount,
            date: transactionData.received_time || new Date().toISOString(),
            message: transactionData.message || 'Webhook P2P',
            type: 'INCOME',
            rawPayload: transactionData
        };

        await saveTransaction(newTransaction);
        
        console.log('New Transaction Saved:', newTransaction.id);
        res.status(200).send({ status: 'success', data: newTransaction });
    } catch (error) {
        console.error('Webhook Error:', error);
        res.status(500).send({ status: 'error', message: error.message });
    }
});

// Get Transactions
app.get('/api/transactions', async (req, res) => {
    try {
        const data = await getTransactions();
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Clear Data
app.delete('/api/transactions', async (req, res) => {
    if (isConnected) {
        await TransactionModel.deleteMany({});
    } else {
        memoryTransactions = [];
    }
    res.json({ status: 'cleared' });
});

// --- User Management ---

// Login Endpoint
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        let user = null;
        if (isConnected) {
            user = await UserModel.findOne({ username, password });
        } else {
            user = memoryUsers.find(u => u.username === username && u.password === password);
        }

        if (user) {
            // Return user without sensitive mongo fields if needed, but ID is important
            return res.json({
                id: user.id || user._id.toString(),
                username: user.username,
                role: user.role,
                password: user.password // sending back for simple logic, usually don't do this
            });
        }
        res.status(401).json({ error: 'Invalid credentials' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/users', async (req, res) => {
    const users = await getUsers();
    res.json(users);
});

app.post('/api/users', async (req, res) => {
    const { username, password, role } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Missing fields' });

    try {
        if (isConnected) {
            const exists = await UserModel.findOne({ username });
            if (exists) return res.status(400).json({ error: 'Username taken' });
            
            const newUser = await UserModel.create({
                id: Date.now().toString(),
                username, password, role: role || 'member'
            });
            return res.json(newUser);
        } else {
            if (memoryUsers.find(u => u.username === username)) return res.status(400).json({ error: 'Username taken' });
            const newUser = { id: Date.now().toString(), username, password, role: role || 'member' };
            memoryUsers.push(newUser);
            res.json(newUser);
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/users/:id', async (req, res) => {
    const id = req.params.id;
    try {
        if (isConnected) {
            const update = { ...req.body };
            // Allow update by custom ID or Mongo _id
            let updated = await UserModel.findOneAndUpdate({ id: id }, update, { new: true });
            if (!updated) {
                 // Try by _id if id string search failed
                 if (mongoose.Types.ObjectId.isValid(id)) {
                    updated = await UserModel.findByIdAndUpdate(id, update, { new: true });
                 }
            }
            
            if (!updated) return res.status(404).json({ error: 'User not found' });
            return res.json(updated);
        } else {
            const idx = memoryUsers.findIndex(u => u.id === id);
            if (idx === -1) return res.status(404).json({ error: 'User not found' });
            memoryUsers[idx] = { ...memoryUsers[idx], ...req.body };
            res.json(memoryUsers[idx]);
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/users/:id', async (req, res) => {
    const id = req.params.id;
    try {
        if (isConnected) {
            // Check admin protection
            const userToCheck = await UserModel.findOne({ id: id }) || (mongoose.Types.ObjectId.isValid(id) ? await UserModel.findById(id) : null);
            if (userToCheck && userToCheck.username === 'admin') return res.status(400).json({ error: 'Cannot delete admin' });

            await UserModel.deleteOne({ _id: userToCheck?._id });
        } else {
            const user = memoryUsers.find(u => u.id === id);
            if (user && user.username === 'admin') return res.status(400).json({ error: 'Cannot delete admin' });
            memoryUsers = memoryUsers.filter(u => u.id !== id);
        }
        res.json({ status: 'deleted' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

export default app;