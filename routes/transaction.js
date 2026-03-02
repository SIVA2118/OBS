const express = require('express');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Middleware to verify token
const authenticate = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Access denied' });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        res.status(400).json({ error: 'Invalid token' });
    }
};

router.post('/transfer', authenticate, async (req, res) => {
    try {
        const { receiverAccount, amount, description } = req.body;
        const sender = await User.findById(req.user.id);
        const receiver = await User.findOne({ accountNumber: receiverAccount });

        if (!receiver) return res.status(404).json({ error: 'Receiver not found' });
        if (sender._id.equals(receiver._id)) return res.status(400).json({ error: 'Cannot sync to self-node' });
        if (amount <= 0) return res.status(400).json({ error: 'Invalid asset quantity' });
        if (sender.balance < amount) return res.status(400).json({ error: 'Insufficient balance' });

        if (sender.accountType === 'Savings' && sender.dailyLimit) {
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);

            const todaysTransactions = await Transaction.find({
                sender: sender._id,
                type: 'transfer',
                date: { $gte: startOfDay }
            });

            const totalTransferredToday = todaysTransactions.reduce((sum, tx) => sum + tx.amount, 0);

            if (totalTransferredToday + Number(amount) > sender.dailyLimit) {
                return res.status(400).json({ error: `Daily transfer limit of ₹${sender.dailyLimit} exceeded for Savings account.` });
            }
        }

        sender.balance -= Number(amount);
        receiver.balance += Number(amount);

        await sender.save();
        await receiver.save();

        const transaction = new Transaction({
            sender: sender._id,
            receiver: receiver._id,
            amount,
            type: 'transfer',
            description
        });
        await transaction.save();

        res.json({ message: 'Transfer successful', balance: sender.balance });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/history', authenticate, async (req, res) => {
    try {
        const history = await Transaction.find({
            $or: [{ sender: req.user.id }, { receiver: req.user.id }]
        }).populate('sender receiver', 'name email').sort({ date: -1 });
        res.send(history);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
