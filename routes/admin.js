const express = require('express');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const jwt = require('jsonwebtoken');
const authorize = require('../middleware/role');
const authenticate = require('../middleware/auth');
const router = express.Router();


router.use(authenticate);

// List pending applications
router.get('/applications/pending', authorize(['Admin', 'Branch Manager', 'Bank Clerk', 'Operations Manager', 'General Manager']), async (req, res) => {
    try {
        const pending = await User.find({ status: 'pending', role: { $ne: 'Admin' } }).select('-password');
        res.json(pending);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// List all approved customers
router.get('/customers', authorize(['Admin', 'Branch Manager', 'Bank Clerk', 'Operations Manager', 'General Manager', 'Cashier']), async (req, res) => {
    try {
        const customers = await User.find({ role: 'Customer', status: 'approved' }).select('-password');
        res.json(customers);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get all transactions (Unified Ledger)
router.get('/transactions', authorize(['Admin', 'Branch Manager', 'Bank Clerk', 'Operations Manager', 'General Manager', 'Cashier']), async (req, res) => {
    try {
        const transactions = await Transaction.find()
            .sort({ date: -1 })
            .populate('sender receiver', 'name email accountNumber role');
        res.json(transactions);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get customer transactions
router.get('/customers/:id/transactions', authorize(['Admin', 'Branch Manager', 'Bank Clerk', 'Operations Manager', 'General Manager', 'Cashier']), async (req, res) => {
    try {
        const transactions = await Transaction.find({
            $or: [{ sender: req.params.id }, { receiver: req.params.id }]
        }).sort({ date: -1 }).populate('sender receiver', 'name email accountNumber');
        res.json(transactions);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Generate ATM/Debit Card
router.post('/customers/:id/generate-debit-card', authorize(['Admin', 'Branch Manager', 'Operations Manager', 'Bank Clerk', 'General Manager']), async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ error: 'User not found' });

        const cardNumber = Array.from({ length: 4 }, () => Math.floor(1000 + Math.random() * 9000).toString()).join(' ');
        const expiryDate = `${(new Date().getMonth() + 1).toString().padStart(2, '0')}/${(new Date().getFullYear() + 5).toString().slice(-2)}`;
        const cvv = Math.floor(100 + Math.random() * 899).toString();

        user.cardDetails = user.cardDetails || {};
        user.cardDetails.debitCard = { cardNumber, expiryDate, cvv, isActive: true, requestStatus: 'approved' };
        await user.save();

        res.json({ message: 'Debit Card generated successfully', debitCard: user.cardDetails.debitCard });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Generate Credit Card
router.post('/customers/:id/generate-credit-card', authorize(['Admin', 'Branch Manager', 'Operations Manager', 'Bank Clerk', 'General Manager']), async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ error: 'User not found' });

        const cardNumber = Array.from({ length: 4 }, () => Math.floor(1000 + Math.random() * 9000).toString()).join(' ');
        const expiryDate = `${(new Date().getMonth() + 1).toString().padStart(2, '0')}/${(new Date().getFullYear() + 3).toString().slice(-2)}`;
        const cvv = Math.floor(100 + Math.random() * 899).toString();

        user.cardDetails = user.cardDetails || {};
        user.cardDetails.creditCard = { cardNumber, expiryDate, cvv, isActive: true, requestStatus: 'approved' };
        await user.save();

        res.json({ message: 'Credit Card generated successfully', creditCard: user.cardDetails.creditCard });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Issue Passbook
router.post('/customers/:id/issue-passbook', authorize(['Admin', 'Branch Manager', 'Operations Manager', 'Bank Clerk', 'General Manager']), async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ error: 'User not found' });

        user.passbookIssued = true;
        await user.save();

        res.json({ message: 'E-Passbook issued successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Approve application
router.post('/applications/:id/approve', authorize(['Admin', 'Branch Manager', 'Operations Manager', 'General Manager']), async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ error: 'User not found' });
        user.status = 'approved';
        await user.save();
        res.json({ message: 'Application approved', user });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Reject application
router.post('/applications/:id/reject', authorize(['Admin', 'Branch Manager', 'Operations Manager', 'General Manager']), async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ error: 'User not found' });
        user.status = 'rejected';
        await user.save();
        res.json({ message: 'Application rejected', user });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// List staff
router.get('/staff', authorize(['Admin', 'Branch Manager', 'General Manager']), async (req, res) => {
    try {
        const staff = await User.find({ role: { $ne: 'Customer' } }).select('-password');
        res.json(staff);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update staff role (Admin Only)
router.put('/staff/:id/role', authorize(['Admin']), async (req, res) => {
    try {
        const { role } = req.body;
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ error: 'User not found' });
        user.role = role;
        await user.save();
        res.json({ message: `Role updated to ${role}`, user });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Serve uploads statically for admins
const path = require('path');
const expressStatic = express.static(path.join(__dirname, '../uploads'));
router.use('/uploads', authorize(['Admin', 'Branch Manager', 'Bank Clerk', 'Operations Manager']), expressStatic);

// Deposit Sync Protocol
router.post('/customers/:id/deposit', authorize(['Admin', 'Branch Manager', 'Operations Manager', 'Bank Clerk', 'Cashier', 'General Manager']), async (req, res) => {
    try {
        const { amount, description } = req.body;
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ error: 'Target node record not found' });
        if (user.status !== 'approved') return res.status(400).json({ error: 'Node protocol not active (Pending Approval)' });

        user.balance += Number(amount);
        await user.save();

        const transaction = new Transaction({
            sender: req.user.id, // The staff member performing the deposit
            receiver: user._id,
            amount,
            type: 'deposit',
            description: description || 'Counter Deposit Sync'
        });
        await transaction.save();

        res.json({ message: 'Asset sync successful', balance: user.balance });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Withdrawal Sync Protocol
router.post('/customers/:id/withdraw', authorize(['Admin', 'Branch Manager', 'Operations Manager', 'Bank Clerk', 'Cashier', 'General Manager']), async (req, res) => {
    try {
        const { amount, description } = req.body;
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ error: 'Target node record not found' });
        if (user.status !== 'approved') return res.status(400).json({ error: 'Node protocol not active' });
        if (user.balance < amount) return res.status(400).json({ error: 'Insufficient parity for withdrawal' });

        user.balance -= Number(amount);
        await user.save();

        const transaction = new Transaction({
            sender: user._id, // The user from whose account money is withdrawn
            receiver: req.user.id, // The staff member performing the withdrawal
            amount,
            type: 'withdraw',
            description: description || 'Counter Withdrawal Sync'
        });
        await transaction.save();

        res.json({ message: 'Asset withdrawal successful', balance: user.balance });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
