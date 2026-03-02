const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    fatherName: { type: String },
    dob: { type: String },
    gender: { type: String, enum: ['Male', 'Female', 'Other'] },
    maritalStatus: { type: String, enum: ['Single', 'Married'] },
    nationality: { type: String },

    email: { type: String, required: true, unique: true },
    mobileNumber: { type: String },
    altMobileNumber: { type: String },

    permanentAddress: {
        houseNo: String,
        city: String,
        state: String,
        pincode: String
    },
    communicationAddress: {
        sameAsPermanent: Boolean,
        houseNo: String,
        city: String,
        state: String,
        pincode: String
    },

    password: { type: String, required: true },
    accountNumber: { type: String, unique: true },
    balance: { type: Number, default: 1000 },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },

    accountType: { type: String, enum: ['Current', 'Savings', 'Salary Account', 'Fixed Deposit'], required: false },
    initialDeposit: { type: Number },
    modeOfOperation: { type: String, enum: ['Self', 'Joint Account', 'Either or Survivor'] },
    dailyLimit: { type: Number, default: null },

    nominee: {
        name: String,
        relationship: String,
        dob: String,
        address: String
    },

    kycDocuments: {
        aadhar: { type: String },
        pan: { type: String },
        voterId: { type: String }, // Document Number
        photo: { type: String } // File Path
    },
    cardDetails: {
        debitCard: {
            cardNumber: String,
            expiryDate: String,
            cvv: String,
            isActive: { type: Boolean, default: false },
            requestStatus: { type: String, enum: ['none', 'pending', 'approved', 'rejected'], default: 'none' }
        },
        creditCard: {
            cardNumber: String,
            expiryDate: String,
            cvv: String,
            isActive: { type: Boolean, default: false },
            requestStatus: { type: String, enum: ['none', 'pending', 'approved', 'rejected'], default: 'none' }
        }
    },
    passbookIssued: { type: Boolean, default: false },
    role: {
        type: String,
        enum: [
            'Customer', 'Admin', 'Bank Clerk', 'Cashier', 'Customer Service Executive',
            'Assistant Manager', 'General Manager'
        ],
        default: 'Customer'
    },
    createdAt: { type: Date, default: Date.now }
});

// Hash password before saving
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 10);
    if (!this.accountNumber) {
        this.accountNumber = Math.floor(1000000000 + Math.random() * 9000000000).toString();
    }
    next();
});

module.exports = mongoose.model('User', userSchema);
