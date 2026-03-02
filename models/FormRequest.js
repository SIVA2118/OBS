const mongoose = require('mongoose');

const formRequestSchema = new mongoose.Schema({
    clerk: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    formType: { type: String, required: true },
    formData: { type: Object, default: {} },
    status: {
        type: String,
        enum: ['sent_by_clerk', 'filled_by_customer', 'verified_by_manager', 'rejected'],
        default: 'sent_by_clerk'
    },
    managerComment: { type: String },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

formRequestSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('FormRequest', formRequestSchema);
