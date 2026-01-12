const mongoose = require('mongoose');

const exchangeSchema = new mongoose.Schema({
    exchangeNumber: {
        type: String,
        required: true,
        unique: true
    },
    date: {
        type: Date,
        default: Date.now
    },
    customer: {
        name: String,
        mobile: String,
        address: String,
        dob: Date,
        pan: String,
        aadhaar: String
    },
    oldItems: [{
        description: String,
        metalType: {
            type: String,
            required: true
        },
        purity: String,
        weight: Number,
        wastageDeduction: Number,
        meltingCharges: Number,
        exchangeValue: Number
    }],
    newItems: [{
        description: String,
        metalType: {
            type: String,
            required: true
        },
        purity: String,
        unit: String,
        quantity: Number,
        grossWeight: Number,
        lessWeight: Number,
        weight: Number,
        rate: Number,
        makingChargesType: String,
        makingCharges: Number,
        makingChargesDiscount: Number,
        huid: String,
        tunch: String,
        itemValue: Number
    }],
    totals: {
        oldItemsTotal: Number,
        newItemsTotal: Number,
        balancePayable: Number,
        balanceRefundable: Number
    },
    qrCode: String,
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    status: {
        type: String,
        enum: ['calculated', 'converted_to_bill', 'cancelled'],
        default: 'calculated'
    },
    billNumber: String,
    notes: String,
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Exchange', exchangeSchema);
