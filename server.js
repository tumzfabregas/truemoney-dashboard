/**
 * TrueMoney Webhook Backend Server
 * 
 * วิธีการใช้งาน (How to run):
 * 1. ติดตั้ง Node.js
 * 2. สร้างโฟลเดอร์ใหม่ และนำไฟล์นี้ไปวางชื่อ server.js
 * 3. รันคำสั่งใน Terminal:
 *    npm init -y
 *    npm install express cors jsonwebtoken
 * 4. แก้ไข package.json ให้เป็น "type": "module"
 * 5. รัน Server:
 *    node server.js
 */

import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database จำลอง
let transactions = [];

app.post('/api/webhook/truemoney', (req, res) => {
    try {
        console.log('--- Received Webhook ---');
        const token = req.body.message || req.body.token || req.body;
        let transactionData = {};

        if (typeof token === 'string' && token.split('.').length === 3) {
            console.log('Type: JWT Token');
            transactionData = jwt.decode(token);
        } else {
            console.log('Type: JSON Object');
            transactionData = token;
        }

        console.log('Payload:', transactionData);

        const newTransaction = {
            id: `TXN-${Date.now()}`,
            sender: transactionData.sender_mobile || transactionData.payer_mobile || 'Unknown',
            amount: Number(transactionData.amount || 0),
            date: transactionData.received_time || new Date().toISOString(),
            message: transactionData.message || 'Webhook P2P',
            type: 'INCOME'
        };

        transactions.unshift(newTransaction);
        console.log('Transaction Saved:', newTransaction);

        res.status(200).send({ status: 'success', message: 'Received' });

    } catch (error) {
        console.error('Error processing webhook:', error);
        res.status(500).send({ status: 'error', message: 'Internal Server Error' });
    }
});

app.get('/api/transactions', (req, res) => {
    res.json(transactions);
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Webhook Endpoint: http://localhost:${PORT}/api/webhook/truemoney`);
});