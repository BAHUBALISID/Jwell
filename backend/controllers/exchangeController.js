const Exchange = require('../models/Exchange');
const QRCode = require('qrcode');
const { validationResult } = require('express-validator');

exports.createExchange = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                success: false,
                errors: errors.array() 
            });
        }

        const {
            customer,
            oldItems,
            newItems,
            totals,
            notes
        } = req.body;

        // Generate exchange number
        const today = new Date();
        const year = today.getFullYear().toString().slice(-2);
        const month = (today.getMonth() + 1).toString().padStart(2, '0');
        const day = today.getDate().toString().padStart(2, '0');
        const count = await Exchange.countDocuments({
            createdAt: {
                $gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
                $lt: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
            }
        });
        
        const exchangeNumber = `EXC-${year}${month}${day}-${(count + 1).toString().padStart(3, '0')}`;

        // Generate QR code data
        const qrData = {
            shop: 'Shri Mahakaleshwar Jewellers',
            exchangeNumber,
            date: today.toISOString().split('T')[0],
            customerName: customer?.name || 'Walk-in Customer',
            oldItemsTotal: totals.oldItemsTotal,
            newItemsTotal: totals.newItemsTotal,
            balance: totals.balancePayable > 0 ? 
                { payable: totals.balancePayable } : 
                { refundable: totals.balanceRefundable },
            status: 'Exchange Calculation',
            address: 'Anisabad, Patna, Bihar'
        };

        // Generate QR code
        let qrCode = '';
        try {
            qrCode = await QRCode.toDataURL(JSON.stringify(qrData));
        } catch (error) {
            console.error('QR Code generation error:', error);
        }

        // Create exchange record
        const exchange = new Exchange({
            exchangeNumber,
            customer,
            oldItems,
            newItems,
            totals,
            qrCode,
            notes,
            createdBy: req.user._id,
            status: 'calculated'
        });

        await exchange.save();

        res.status(201).json({
            success: true,
            exchange,
            message: 'Exchange calculation saved successfully'
        });

    } catch (error) {
        console.error('Create exchange error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error: ' + error.message
        });
    }
};

exports.getAllExchanges = async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 10,
            startDate,
            endDate,
            search,
            status
        } = req.query;

        const query = { isActive: true };

        // Date filter
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate);
            if (endDate) query.createdAt.$lte = new Date(endDate);
        }

        // Search filter
        if (search) {
            query.$or = [
                { exchangeNumber: { $regex: search, $options: 'i' } },
                { 'customer.name': { $regex: search, $options: 'i' } },
                { 'customer.mobile': { $regex: search, $options: 'i' } }
            ];
        }

        // Status filter
        if (status) {
            query.status = status;
        }

        const exchanges = await Exchange.find(query)
            .populate('createdBy', 'name')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
            .lean();

        const total = await Exchange.countDocuments(query);

        res.json({
            success: true,
            exchanges,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('Get all exchanges error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

exports.getExchangeByNumber = async (req, res) => {
    try {
        const { exchangeNumber } = req.params;
        
        const exchange = await Exchange.findOne({ exchangeNumber })
            .populate('createdBy', 'name')
            .lean();

        if (!exchange) {
            return res.status(404).json({
                success: false,
                message: 'Exchange not found'
            });
        }

        res.json({
            success: true,
            exchange
        });

    } catch (error) {
        console.error('Get exchange by number error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

exports.convertToBill = async (req, res) => {
    try {
        const { id } = req.params;
        const { billNumber } = req.body;

        const exchange = await Exchange.findById(id);
        if (!exchange) {
            return res.status(404).json({
                success: false,
                message: 'Exchange not found'
            });
        }

        exchange.status = 'converted_to_bill';
        exchange.billNumber = billNumber;
        
        await exchange.save();

        res.json({
            success: true,
            exchange,
            message: 'Exchange converted to bill successfully'
        });

    } catch (error) {
        console.error('Convert to bill error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

exports.deleteExchange = async (req, res) => {
    try {
        const { id } = req.params;

        const exchange = await Exchange.findById(id);
        if (!exchange) {
            return res.status(404).json({
                success: false,
                message: 'Exchange not found'
            });
        }

        exchange.isActive = false;
        await exchange.save();

        res.json({
            success: true,
            message: 'Exchange deleted successfully'
        });

    } catch (error) {
        console.error('Delete exchange error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

exports.getExchangeStats = async (req, res) => {
    try {
        const today = new Date();
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);

        const totalExchanges = await Exchange.countDocuments({ isActive: true });
        const monthExchanges = await Exchange.countDocuments({
            createdAt: { $gte: startOfMonth, $lte: endOfMonth },
            isActive: true
        });

        const totalValue = await Exchange.aggregate([
            { $match: { isActive: true } },
            { $group: { _id: null, total: { $sum: "$totals.newItemsTotal" } } }
        ]);

        const monthlyValue = await Exchange.aggregate([
            { 
                $match: { 
                    createdAt: { $gte: startOfMonth, $lte: endOfMonth },
                    isActive: true 
                } 
            },
            { $group: { _id: null, total: { $sum: "$totals.newItemsTotal" } } }
        ]);

        res.json({
            success: true,
            stats: {
                totalExchanges,
                monthExchanges,
                totalValue: totalValue.length > 0 ? totalValue[0].total : 0,
                monthlyValue: monthlyValue.length > 0 ? monthlyValue[0].total : 0
            }
        });

    } catch (error) {
        console.error('Get exchange stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};
