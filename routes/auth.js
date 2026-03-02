const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const upload = require('../middleware/upload');
const router = express.Router();

router.post('/register', upload.fields([
    { name: 'aadhar', maxCount: 1 },
    { name: 'pan', maxCount: 1 },
    { name: 'photo', maxCount: 1 }
]), async (req, res) => {
    try {
        const {
            name, fatherName, dob, gender, maritalStatus, nationality,
            email, mobileNumber, altMobileNumber,
            permanentAddress, communicationAddress,
            password, accountType, initialDeposit, modeOfOperation,
            voterId, role,
            nomineeName, nomineeRelationship, nomineeDob, nomineeAddress
        } = req.body;

        let kycDocuments = { voterId };
        if (req.files) {
            if (req.files['aadhar']) kycDocuments.aadhar = req.files['aadhar'][0].path;
            if (req.files['pan']) kycDocuments.pan = req.files['pan'][0].path;
            if (req.files['photo']) kycDocuments.photo = req.files['photo'][0].path;
        }

        const dailyLimit = accountType === 'Savings' ? 100000 : null;

        // Helper to parse JSON strings from FormData if needed
        const parseJsonFallback = (str) => {
            try { return typeof str === 'string' ? JSON.parse(str) : str; }
            catch { return str || {}; }
        };

        const user = new User({
            name, fatherName, dob, gender, maritalStatus, nationality,
            email, mobileNumber, altMobileNumber,
            permanentAddress: parseJsonFallback(permanentAddress),
            communicationAddress: parseJsonFallback(communicationAddress),
            password,
            accountType,
            initialDeposit: initialDeposit ? Number(initialDeposit) : undefined,
            modeOfOperation,
            kycDocuments,
            dailyLimit,
            role: role || 'Customer',
            nominee: {
                name: nomineeName,
                relationship: nomineeRelationship,
                dob: nomineeDob,
                address: nomineeAddress
            },
            status: role !== 'Customer' ? 'approved' : 'pending'
        });

        await user.save();
        res.status(201).json({ message: 'User registered successfully. Application is pending approval.' });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

const authenticate = require('../middleware/auth'); // Assuming auth middleware exists

router.get('/me', authenticate, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/request-card', authenticate, async (req, res) => {
    try {
        const { type } = req.body; // 'debit' or 'credit'
        if (!['debit', 'credit'].includes(type)) {
            return res.status(400).json({ error: 'Invalid card type' });
        }

        const cardKey = type === 'debit' ? 'cardDetails.debitCard.requestStatus' : 'cardDetails.creditCard.requestStatus';
        const user = await User.findById(req.user.id);

        // Check if already active or pending
        const currentStatus = type === 'debit' ? user.cardDetails?.debitCard?.requestStatus : user.cardDetails?.creditCard?.requestStatus;
        if (currentStatus === 'pending' || currentStatus === 'approved') {
            return res.status(400).json({ error: 'Request already in progress or approved' });
        }

        await User.findByIdAndUpdate(req.user.id, { [cardKey]: 'pending' });
        res.json({ message: 'Card access requested successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/update', authenticate, async (req, res) => {
    try {
        const updates = { ...req.body };
        // Prevent customers from editing sensitive fields or bypassing approval
        delete updates.cardDetails;
        delete updates.status;
        delete updates.role;
        delete updates.accountNumber;
        delete updates.balance;

        const user = await User.findByIdAndUpdate(req.user.id, updates, { new: true }).select('-password');
        res.json({ message: 'Profile updated successfully', user });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
        res.json({ token, user: { id: user._id, name: user.name, email: user.email, accountNumber: user.accountNumber, balance: user.balance, status: user.status, role: user.role } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
