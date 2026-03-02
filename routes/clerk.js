const express = require('express');
const Appointment = require('../models/Appointment');
const FormRequest = require('../models/FormRequest');
const User = require('../models/User');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/role');
const router = express.Router();

router.use(authenticate);

// --- Appointment Management ---

// Get all appointments for clerks
router.get('/appointments', authorize(['Admin', 'Bank Clerk', 'General Manager']), async (req, res) => {
    try {
        const appointments = await Appointment.find()
            .populate('customer', 'name email mobileNumber')
            .sort({ createdAt: -1 });
        res.json(appointments);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Issue/Update appointment link
router.post('/appointments/:id/issue', authorize(['Admin', 'Bank Clerk', 'General Manager']), async (req, res) => {
    try {
        const { appointmentLink, status } = req.body;
        const appointment = await Appointment.findByIdAndUpdate(
            req.params.id,
            { appointmentLink, status: status || 'scheduled', clerk: req.user.id },
            { new: true }
        );
        res.json({ message: 'Appointment updated successfully', appointment });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Form Management ---

// Send form to customer
router.post('/forms/send', authorize(['Admin', 'Bank Clerk', 'General Manager']), async (req, res) => {
    try {
        const { customerId, formType } = req.body;
        const formRequest = new FormRequest({
            clerk: req.user.id,
            customer: customerId,
            formType: formType,
            status: 'sent_by_clerk'
        });
        await formRequest.save();
        res.status(201).json({ message: 'Form protocol initiated and sent to customer', formRequest });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get all form requests for clerk
router.get('/forms', authorize(['Admin', 'Bank Clerk', 'General Manager']), async (req, res) => {
    try {
        const forms = await FormRequest.find()
            .populate('customer', 'name email mobileNumber')
            .populate('clerk', 'name')
            .sort({ updatedAt: -1 });
        res.json(forms);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Manager/Admin verify form
router.post('/forms/:id/verify', authorize(['Admin', 'General Manager']), async (req, res) => {
    try {
        const { status, managerComment } = req.body; // approved/rejected
        const form = await FormRequest.findByIdAndUpdate(
            req.params.id,
            {
                status: status === 'approved' ? 'verified_by_manager' : 'rejected',
                managerComment,
                verifiedBy: req.user.id
            },
            { new: true }
        );
        res.json({ message: 'Form verification synchronized', form });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Customer Specific Routes (Moved from auth if needed, but here for clerk access) ---

// Get active form requests for customer
router.get('/customer/forms', authorize(['Customer']), async (req, res) => {
    try {
        const forms = await FormRequest.find({ customer: req.user.id })
            .populate('clerk', 'name')
            .sort({ updatedAt: -1 });
        res.json(forms);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Customer fills form
router.put('/forms/:id/fill', authorize(['Customer']), async (req, res) => {
    try {
        const { formData } = req.body;
        const form = await FormRequest.findOneAndUpdate(
            { _id: req.params.id, customer: req.user.id },
            { formData, status: 'filled_by_customer' },
            { new: true }
        );
        res.json({ message: 'Form data synchronized to terminal', form });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Customer requests appointment
router.post('/appointments/request', authorize(['Customer']), async (req, res) => {
    try {
        const { date, time, reason } = req.body;
        const appointment = new Appointment({
            customer: req.user.id,
            date,
            time,
            reason,
            status: 'pending'
        });
        await appointment.save();
        res.status(201).json({ message: 'Appointment request logged in Sovereign Network', appointment });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get appointments for customer
router.get('/customer/appointments', authorize(['Customer']), async (req, res) => {
    try {
        const appointments = await Appointment.find({ customer: req.user.id })
            .sort({ createdAt: -1 });
        res.json(appointments);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
