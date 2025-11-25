import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- MongoDB Cached Connection Pattern (Best for Vercel) ---
// Updated: Force Redeploy Timestamp v1.0.2
const MONGODB_URI = process.env.MONGODB_URI;

// Global cache to prevent multiple connections in Serverless
let cached = global.mongoose;
if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function dbConnect() {
    if (!MONGODB_URI) return null;

    if (cached.conn) {
        return cached.conn;
    }

    if (!cached.promise) {
        const opts = {
            bufferCommands: false, // Disable mongoose buffering
        };

        cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
            console.log('✅ New MongoDB Connection Established');
            return mongoose;
        });
    }

    try {
        cached.conn = await cached.promise;
    } catch (e) {
        cached.promise = null;
        throw e;
    }

    return cached.conn;
}

// --- Schemas & Models ---
const TransactionSchema = new mongoose.Schema({
    id: String,
    sender: String,
    amount: Number,
    date: Date,
    message: String,
    type: String,
    rawPayload: Object
}, { timestamps: true });

const UserSchema = new mongoose.Schema({
    id: String,
    username: { type: String, unique: true },
    password: String,
    role: String
});

// Prevent model recompilation error in serverless
const TransactionModel = mongoose.models.Transaction || mongoose.model('Transaction', TransactionSchema);
const UserModel = mongoose.models.User || mongoose.model('User', UserSchema);

// --- Fallback Memory Data (Only used if no MongoDB) ---
let memoryTransactions = [];
// Clean start: Only admin, no staff
let memoryUsers = [
    { id: '1', username: 'admin', password: 'admin', role: 'admin' }
];

// --- Helpers ---
const isDbConnected = () => mongoose.connection.readyState === 1;

// Seed Admin if DB is empty
const ensureAdminExists = async () => {
    if (isDbConnected()) {
        const count = await UserModel.countDocuments();
        if (count === 0) {
            console.log('🌱 Seeding default Admin user...');
            await UserModel.create({
                id: Date.now().toString(),
                username: 'admin',
                password: 'admin',
                role: 'admin'
            });
        }
    }
};

// --- Routes ---

app.use(async (req, res, next) => {
    // Ensure DB is connected on every request
    await dbConnect();
    next();
});

// Webhook GET - Check Status
app.get('/api/webhook/truemoney', (req, res) => {
    res.status(200).json({
        status: 'online',
        db_status: isDbConnected() ? 'connected' : 'disconnected (using memory)',
        message: 'Webhook Endpoint is ready.',
        timestamp: new Date().toISOString()
    });
});

// Webhook POST - Receive Data
app.post('/api/webhook/truemoney', async (req, res) => {
    try {
        const token = req.body.message || req.body.token || req.body;
        let transactionData = {};

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
        amount = amount / 100; // Convert Satang to Baht

        const newTransaction = {
            id: `TXN-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            sender: transactionData.sender_mobile || transactionData.payer_mobile || 'Unknown',
            amount: amount,
            date: transactionData.received_time || new Date().toISOString(),
            message: transactionData.message || 'Webhook P2P',
            type: 'INCOME',
            rawPayload: transactionData
        };

        if (isDbConnected()) {
            await TransactionModel.create(newTransaction);
        } else {
            memoryTransactions.unshift(newTransaction);
            if (memoryTransactions.length > 50) memoryTransactions = memoryTransactions.slice(0, 50);
        }
        
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
        if (isDbConnected()) {
            const data = await TransactionModel.find().sort({ date: -1 }).limit(100);
            res.json(data);
        } else {
            res.json(memoryTransactions);
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Clear Data
app.delete('/api/transactions', async (req, res) => {
    if (isDbConnected()) {
        await TransactionModel.deleteMany({});
    } else {
        memoryTransactions = [];
    }
    res.json({ status: 'cleared' });
});

// --- User Management ---

// Login
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        // Ensure Admin Exists before login check
        await ensureAdminExists();

        let user = null;
        if (isDbConnected()) {
            user = await UserModel.findOne({ username, password });
        } else {
            user = memoryUsers.find(u => u.username === username && u.password === password);
        }

        if (user) {
            return res.json({
                id: user.id || user._id.toString(),
                username: user.username,
                role: user.role,
                password: user.password
            });
        }
        res.status(401).json({ error: 'Invalid credentials' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Get Users
app.get('/api/users', async (req, res) => {
    await ensureAdminExists();
    if (isDbConnected()) {
        const users = await UserModel.find();
        res.json(users);
    } else {
        res.json(memoryUsers);
    }
});

// Add User
app.post('/api/users', async (req, res) => {
    const { username, password, role } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Missing fields' });

    try {
        if (isDbConnected()) {
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

// Update User
app.put('/api/users/:id', async (req, res) => {
    const id = req.params.id;
    try {
        if (isDbConnected()) {
            const update = { ...req.body };
            let updated = await UserModel.findOneAndUpdate({ id: id }, update, { new: true });
            // Fallback for ObjectId
            if (!updated && mongoose.Types.ObjectId.isValid(id)) {
                 updated = await UserModel.findByIdAndUpdate(id, update, { new: true });
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

// Delete User
app.delete('/api/users/:id', async (req, res) => {
    const id = req.params.id;
    try {
        if (isDbConnected()) {
            const userToCheck = await UserModel.findOne({ id: id }) || (mongoose.Types.ObjectId.isValid(id) ? await UserModel.findById(id) : null);
            if (userToCheck && userToCheck.username === 'admin') return res.status(400).json({ error: 'Cannot delete admin' });
            
            if (userToCheck) await UserModel.deleteOne({ _id: userToCheck._id });
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