// Billing Module

class BillingSystem {
    constructor() {
        this.apiBase = 'http://localhost:5000/api';
        this.token = window.auth.getToken();
        this.currentBill = {
            customer: {
                name: '',
                mobile: '',
                address: '',
                dob: '',
                pan: '',
                aadhaar: ''
            },
            items: [],
            exchangeItems: [],
            discount: 0,
            paymentMode: 'cash',
            paymentStatus: 'paid'
        };
        this.rates = {};
        this.init();
    }

    async init() {
        await this.loadRates();
        this.setupEventListeners();
        this.updateSummary();
    }

    async loadRates() {
        try {
            const response = await fetch(`${this.apiBase}/rates`);
            const data = await response.json();
            
            if (data.success) {
                this.rates = data.rates.reduce((acc, rate) => {
                    acc[rate.metalType] = rate;
                    return acc;
                }, {});
                
                // Populate metal type dropdowns
                this.populateMetalTypes();
            }
        } catch (error) {
            console.error('Error loading rates:', error);
            showAlert('danger', 'Failed to load rates. Please refresh the page.');
        }
    }

    populateMetalTypes() {
        const metalSelects = document.querySelectorAll('.metal-type');
        metalSelects.forEach(select => {
            select.innerHTML = Object.keys(this.rates)
                .map(metal => `<option value="${metal}">${metal}</option>`)
                .join('');
        });
    }

    setupEventListeners() {
        // Customer form
        document.getElementById('customerForm').addEventListener('input', (e) => {
            const field = e.target.name.replace('customer.', '');
            this.currentBill.customer[field] = e.target.value;
        });

        // Add item button
        document.getElementById('addItemBtn').addEventListener('click', () => {
            this.addItemRow();
        });

        // Add exchange item button
        document.getElementById('addExchangeBtn').addEventListener('click', () => {
            this.addExchangeItemRow();
        });

        // Discount input
        document.getElementById('discount').addEventListener('input', (e) => {
            this.currentBill.discount = parseFloat(e.target.value) || 0;
            this.updateSummary();
        });

        // Payment mode
        document.getElementById('paymentMode').addEventListener('change', (e) => {
            this.currentBill.paymentMode = e.target.value;
        });

        // Generate bill button
        document.getElementById('generateBillBtn').addEventListener('click', () => {
            this.generateBill();
        });

        // Print button
        document.getElementById('printBillBtn').addEventListener('click', () => {
            this.printBill();
        });

        // Clear form button
        document.getElementById('clearFormBtn').addEventListener('click', () => {
            if (confirm('Are you sure you want to clear the form?')) {
                this.clearForm();
            }
        });
    }

    addItemRow(isExchange = false) {
        const itemsContainer = isExchange ? 
            document.getElementById('exchangeItems') : 
            document.getElementById('itemsContainer');
        
        const itemId = Date.now();
        const itemRow = document.createElement('div');
        itemRow.className = 'item-row';
        itemRow.id = `item-${itemId}`;
        
        itemRow.innerHTML = `
            <input type="text" class="form-control item-description" placeholder="Description" 
                   oninput="billingSystem.updateItem(${itemId}, 'description', this.value)">
            
            <select class="form-control metal-type" 
                    onchange="billingSystem.updateItem(${itemId}, 'metalType', this.value);
                             billingSystem.updatePurities(this.value, ${itemId})">
                <option value="">Select Metal</option>
                ${Object.keys(this.rates).map(metal => 
                    `<option value="${metal}">${metal}</option>`
                ).join('')}
            </select>
            
            <select class="form-control purity" 
                    onchange="billingSystem.updateItem(${itemId}, 'purity', this.value)">
                <option value="">Select Purity</option>
            </select>
            
            <input type="number" class="form-control weight" step="0.001" placeholder="Weight" 
                   oninput="billingSystem.updateItem(${itemId}, 'weight', this.value)">
            
            <input type="number" class="form-control making-charges" step="0.01" placeholder="Making Charges" 
                   oninput="billingSystem.updateItem(${itemId}, 'makingCharges', this.value)">
            
            <select class="form-control making-charges-type" 
                    onchange="billingSystem.updateItem(${itemId}, 'makingChargesType', this.value)">
                <option value="percentage">%</option>
                <option value="fixed">₹</option>
            </select>
            
            <button class="btn btn-danger btn-sm" 
                    onclick="billingSystem.removeItem(${itemId}, ${isExchange})">
                ×
            </button>
            
            ${isExchange ? `
                <input type="number" class="form-control wastage" step="0.1" placeholder="Wastage %" 
                       oninput="billingSystem.updateItem(${itemId}, 'wastageDeduction', this.value)">
                
                <input type="number" class="form-control melting" step="0.01" placeholder="Melting Charges" 
                       oninput="billingSystem.updateItem(${itemId}, 'meltingCharges', this.value)">
            ` : ''}
        `;
        
        itemsContainer.appendChild(itemRow);
        
        // Add to current bill
        if (isExchange) {
            this.currentBill.exchangeItems.push({
                id: itemId,
                description: '',
                metalType: '',
                purity: '',
                weight: 0,
                wastageDeduction: 0,
                meltingCharges: 0
            });
        } else {
            this.currentBill.items.push({
                id: itemId,
                description: '',
                metalType: '',
                purity: '',
                weight: 0,
                makingCharges: 0,
                makingChargesType: 'percentage'
            });
        }
    }

    updatePurities(metalType, itemId) {
        const rate = this.rates[metalType];
        if (!rate) return;
        
        const puritySelect = document.querySelector(`#item-${itemId} .purity`);
        puritySelect.innerHTML = rate.purityLevels
            .map(purity => `<option value="${purity}">${purity}</option>`)
            .join('');
        
        // Update item
        this.updateItem(itemId, 'purity', rate.purityLevels[0]);
    }

    updateItem(itemId, field, value) {
        // Find item in either items or exchangeItems
        let item = this.currentBill.items.find(item => item.id === itemId);
        let isExchange = false;
        
        if (!item) {
            item = this.currentBill.exchangeItems.find(item => item.id === itemId);
            isExchange = true;
        }
        
        if (item) {
            item[field] = field === 'weight' || field === 'makingCharges' || 
                         field === 'wastageDeduction' || field === 'meltingCharges' ?
                         parseFloat(value) || 0 : value;
            
            this.updateSummary();
        }
    }

    removeItem(itemId, isExchange) {
        // Remove from DOM
        const element = document.getElementById(`item-${itemId}`);
        if (element) element.remove();
        
        // Remove from current bill
        if (isExchange) {
            this.currentBill.exchangeItems = this.currentBill.exchangeItems.filter(
                item => item.id !== itemId
            );
        } else {
            this.currentBill.items = this.currentBill.items.filter(
                item => item.id !== itemId
            );
        }
        
        this.updateSummary();
    }

    async updateSummary() {
        // Calculate totals
        let subTotal = 0;
        let itemsHtml = '';
        
        // Calculate new items
        this.currentBill.items.forEach(item => {
            if (item.metalType && item.weight > 0) {
                const rate = this.rates[item.metalType];
                if (rate) {
                    let itemAmount = 0;
                    
                    if (rate.unit === 'kg') {
                        itemAmount = (rate.rate / 1000) * item.weight;
                    } else if (rate.unit === 'carat') {
                        itemAmount = rate.rate * item.weight;
                    }
                    
                    // Apply making charges
                    let makingChargesAmount = 0;
                    if (item.makingChargesType === 'percentage') {
                        makingChargesAmount = (itemAmount * item.makingCharges) / 100;
                    } else {
                        makingChargesAmount = item.makingCharges;
                    }
                    
                    const total = itemAmount + makingChargesAmount;
                    subTotal += total;
                    
                    itemsHtml += `
                        <tr>
                            <td>${item.description}</td>
                            <td>${item.metalType} ${item.purity}</td>
                            <td>${item.weight.toFixed(3)} ${rate.unit === 'kg' ? 'g' : rate.unit}</td>
                            <td>₹${total.toFixed(2)}</td>
                        </tr>
                    `;
                }
            }
        });
        
        // Calculate exchange items
        let exchangeTotal = 0;
        let exchangeHtml = '';
        
        this.currentBill.exchangeItems.forEach(item => {
            if (item.metalType && item.weight > 0) {
                const rate = this.rates[item.metalType];
                if (rate) {
                    let itemValue = 0;
                    
                    if (rate.unit === 'kg') {
                        itemValue = (rate.rate / 1000) * item.weight;
                    } else if (rate.unit === 'carat') {
                        itemValue = rate.rate * item.weight;
                    }
                    
                    // Apply wastage deduction
                    if (item.wastageDeduction > 0) {
                        itemValue = itemValue * ((100 - item.wastageDeduction) / 100);
                    }
                    
                    // Apply melting charges
                    if (item.meltingCharges > 0) {
                        itemValue -= item.meltingCharges;
                    }
                    
                    exchangeTotal += Math.max(0, itemValue);
                    
                    exchangeHtml += `
                        <tr>
                            <td>${item.description || 'Old Item'}</td>
                            <td>${item.metalType} ${item.purity}</td>
                            <td>${item.weight.toFixed(3)} ${rate.unit === 'kg' ? 'g' : rate.unit}</td>
                            <td>₹${itemValue.toFixed(2)}</td>
                        </tr>
                    `;
                }
            }
        });
        
        // Calculate totals
        const discount = this.currentBill.discount || 0;
        const totalAfterDiscount = subTotal - discount;
        const gst = totalAfterDiscount * 0.03; // 3% GST
        const grandTotal = totalAfterDiscount + gst;
        
        // Calculate balance
        const balance = exchangeTotal - grandTotal;
        
        // Update summary display
        document.getElementById('subTotal').textContent = `₹${subTotal.toFixed(2)}`;
        document.getElementById('discountDisplay').textContent = `₹${discount.toFixed(2)}`;
        document.getElementById('totalAfterDiscount').textContent = `₹${totalAfterDiscount.toFixed(2)}`;
        document.getElementById('gst').textContent = `₹${gst.toFixed(2)}`;
        document.getElementById('grandTotal').textContent = `₹${grandTotal.toFixed(2)}`;
        document.getElementById('exchangeValue').textContent = `₹${exchangeTotal.toFixed(2)}`;
        
        if (balance >= 0) {
            document.getElementById('balanceRefund').textContent = `₹${balance.toFixed(2)}`;
            document.getElementById('balancePay').textContent = '₹0.00';
        } else {
            document.getElementById('balancePay').textContent = `₹${Math.abs(balance).toFixed(2)}`;
            document.getElementById('balanceRefund').textContent = '₹0.00';
        }
        
        // Update items list in summary
        document.getElementById('itemsList').innerHTML = itemsHtml;
        document.getElementById('exchangeItemsList').innerHTML = exchangeHtml;
        
        // Update amount in words
        if (grandTotal > 0) {
            const amountInWords = await this.getAmountInWords(grandTotal);
            document.getElementById('amountInWords').textContent = amountInWords;
        }
    }

    async getAmountInWords(amount) {
        try {
            // This is a simplified version. In production, you might want to
            // implement this on the backend or use a proper library
            const response = await fetch(`${this.apiBase}/bills/calculate-words`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ amount })
            });
            
            const data = await response.json();
            return data.words || 'Amount in words will be generated';
        } catch (error) {
            console.error('Error getting amount in words:', error);
            return 'Amount in words calculation failed';
        }
    }

    validateBill() {
        // Validate customer details
        if (!this.currentBill.customer.name.trim()) {
            showAlert('danger', 'Customer name is required');
            return false;
        }
        
        if (!this.currentBill.customer.mobile.trim()) {
            showAlert('danger', 'Customer mobile number is required');
            return false;
        }
        
        if (!this.currentBill.customer.address.trim()) {
            showAlert('danger', 'Customer address is required');
            return false;
        }
        
        // Validate at least one item
        if (this.currentBill.items.length === 0) {
            showAlert('danger', 'At least one item is required');
            return false;
        }
        
        // Validate all items have required fields
        for (const item of this.currentBill.items) {
            if (!item.description || !item.metalType || !item.purity || item.weight <= 0) {
                showAlert('danger', 'Please fill all item details correctly');
                return false;
            }
        }
        
        return true;
    }

    async generateBill() {
        if (!this.validateBill()) return;
        
        const btn = document.getElementById('generateBillBtn');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<span class="spinner"></span> Generating...';
        btn.disabled = true;
        
        try {
            // Prepare data for API
            const billData = {
                customer: this.currentBill.customer,
                items: this.currentBill.items.map(item => ({
                    description: item.description,
                    metalType: item.metalType,
                    purity: item.purity,
                    weight: item.weight,
                    makingCharges: item.makingCharges,
                    makingChargesType: item.makingChargesType
                })),
                exchangeItems: this.currentBill.exchangeItems.map(item => ({
                    description: item.description,
                    metalType: item.metalType,
                    purity: item.purity,
                    weight: item.weight,
                    wastageDeduction: item.wastageDeduction,
                    meltingCharges: item.meltingCharges
                })),
                discount: this.currentBill.discount,
                paymentMode: this.currentBill.paymentMode,
                paymentStatus: this.currentBill.paymentStatus
            };
            
            const response = await fetch(`${this.apiBase}/bills/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify(billData)
            });
            
            const data = await response.json();
            
            if (data.success) {
                showAlert('success', 'Bill generated successfully!');
                
                // Show bill preview
                this.showBillPreview(data.bill);
                
                // Enable print button
                document.getElementById('printBillBtn').disabled = false;
            } else {
                showAlert('danger', data.message || 'Failed to generate bill');
            }
        } catch (error) {
            console.error('Generate bill error:', error);
            showAlert('danger', 'Network error. Please try again.');
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }

    showBillPreview(bill) {
        // Store current bill for printing
        window.currentBill = bill;
        
        // Update preview modal
        document.getElementById('previewBillNumber').textContent = bill.billNumber;
        document.getElementById('previewBillDate').textContent = 
            new Date(bill.billDate).toLocaleDateString();
        document.getElementById('previewCustomerName').textContent = bill.customer.name;
        document.getElementById('previewCustomerMobile').textContent = bill.customer.mobile;
        document.getElementById('previewCustomerAddress').textContent = bill.customer.address;
        
        // Update items in preview
        const itemsHtml = bill.items
            .filter(item => !item.isExchangeItem)
            .map(item => `
                <tr>
                    <td>${item.description}</td>
                    <td>${item.metalType} ${item.purity}</td>
                    <td>${item.weight.toFixed(3)} ${item.metalType === 'Diamond' ? 'ct' : 'g'}</td>
                    <td>₹${item.amount.toFixed(2)}</td>
                </tr>
            `).join('');
        
        document.getElementById('previewItems').innerHTML = itemsHtml;
        
        // Update exchange items if any
        if (bill.exchangeDetails.hasExchange) {
            const exchangeItems = bill.items.filter(item => item.isExchangeItem);
            const exchangeHtml = exchangeItems.map(item => `
                <tr>
                    <td>${item.description}</td>
                    <td>${item.metalType} ${item.purity}</td>
                    <td>${item.weight.toFixed(3)} ${item.metalType === 'Diamond' ? 'ct' : 'g'}</td>
                    <td>-₹${Math.abs(item.amount).toFixed(2)}</td>
                </tr>
            `).join('');
            
            document.getElementById('previewExchangeItems').innerHTML = exchangeHtml;
            document.getElementById('exchangeSection').style.display = 'block';
        } else {
            document.getElementById('exchangeSection').style.display = 'none';
        }
        
        // Update totals
        document.getElementById('previewSubTotal').textContent = `₹${bill.subTotal.toFixed(2)}`;
        document.getElementById('previewDiscount').textContent = `₹${bill.discount.toFixed(2)}`;
        document.getElementById('previewGST').textContent = `₹${bill.gst.toFixed(2)}`;
        document.getElementById('previewGrandTotal').textContent = `₹${bill.grandTotal.toFixed(2)}`;
        document.getElementById('previewAmountWords').textContent = bill.amountInWords;
        
        // Update exchange totals
        if (bill.exchangeDetails.hasExchange) {
            document.getElementById('previewOldItemsTotal').textContent = 
                `₹${bill.exchangeDetails.oldItemsTotal.toFixed(2)}`;
            document.getElementById('previewBalance').textContent = 
                bill.exchangeDetails.balancePayable > 0 ?
                `₹${bill.exchangeDetails.balancePayable.toFixed(2)} Payable` :
                `₹${bill.exchangeDetails.balanceRefundable.toFixed(2)} Refundable`;
        }
        
        // Show QR codes if available
        if (bill.qrCodes && bill.qrCodes.billQR) {
            document.getElementById('previewBillQR').src = 
                `data:image/png;base64,${bill.qrCodes.billQR}`;
        }
        
        // Show preview modal
        document.getElementById('billPreviewModal').classList.add('show');
    }

    printBill() {
        if (!window.currentBill) {
            showAlert('warning', 'Please generate a bill first');
            return;
        }
        
        // Open print window
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Bill ${window.currentBill.billNumber}</title>
                <link rel="stylesheet" href="css/print.css">
                <style>
                    ${document.querySelector('#printStyles').innerHTML}
                </style>
            </head>
            <body>
                ${this.generatePrintHTML(window.currentBill)}
            </body>
            </html>
        `);
        
        printWindow.document.close();
        printWindow.focus();
        
        // Wait for images to load
        printWindow.onload = () => {
            printWindow.print();
        };
    }

    generatePrintHTML(bill) {
        return `
            <div class="invoice-container">
                <div class="invoice-header">
                    <h1 class="shop-name">Shri Mahakaleshwar Jewellers</h1>
                    <p class="shop-address">Anisabad, Patna, Bihar - 800002</p>
                    <p class="shop-contact">Mobile: +91 XXXXX XXXXX | GSTIN: XXXXXXXX</p>
                </div>
                
                <div class="bill-info">
                    <div>
                        <div class="bill-number">Bill No: ${bill.billNumber}</div>
                        <div class="bill-date">Date: ${new Date(bill.billDate).toLocaleDateString()}</div>
                    </div>
                    <div>
                        <div>Invoice Type: ${bill.exchangeDetails.hasExchange ? 'Sale with Exchange' : 'Sale'}</div>
                        <div>Payment Mode: ${bill.paymentMode.toUpperCase()}</div>
                    </div>
                </div>
                
                <div class="customer-info">
                    <h3>Customer Details</h3>
                    <p><strong>Name:</strong> ${bill.customer.name}</p>
                    <p><strong>Mobile:</strong> ${bill.customer.mobile}</p>
                    <p><strong>Address:</strong> ${bill.customer.address}</p>
                </div>
                
                <table class="items-table">
                    <thead>
                        <tr>
                            <th>Description</th>
                            <th>Metal & Purity</th>
                            <th>Weight</th>
                            <th>Amount (₹)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${bill.items
                            .filter(item => !item.isExchangeItem)
                            .map(item => `
                                <tr>
                                    <td>${item.description}</td>
                                    <td>${item.metalType} ${item.purity}</td>
                                    <td>${item.weight.toFixed(3)} ${item.metalType === 'Diamond' ? 'ct' : 'g'}</td>
                                    <td>${item.amount.toFixed(2)}</td>
                                </tr>
                            `).join('')}
                    </tbody>
                </table>
                
                ${bill.exchangeDetails.hasExchange ? `
                    <div class="exchange-details">
                        <h3>Exchange Details</h3>
                        <table class="items-table">
                            <thead>
                                <tr>
                                    <th>Old Item Description</th>
                                    <th>Metal & Purity</th>
                                    <th>Weight</th>
                                    <th>Value (₹)</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${bill.items
                                    .filter(item => item.isExchangeItem)
                                    .map(item => `
                                        <tr>
                                            <td>${item.description}</td>
                                            <td>${item.metalType} ${item.purity}</td>
                                            <td>${item.weight.toFixed(3)} ${item.metalType === 'Diamond' ? 'ct' : 'g'}</td>
                                            <td>-${Math.abs(item.amount).toFixed(2)}</td>
                                        </tr>
                                    `).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : ''}
                
                <div class="calculations">
                    <div class="calc-row">
                        <span>Sub Total:</span>
                        <span>₹${bill.subTotal.toFixed(2)}</span>
                    </div>
                    <div class="calc-row">
                        <span>Discount:</span>
                        <span>-₹${bill.discount.toFixed(2)}</span>
                    </div>
                    <div class="calc-row">
                        <span>GST (3%):</span>
                        <span>₹${bill.gst.toFixed(2)}</span>
                    </div>
                    ${bill.exchangeDetails.hasExchange ? `
                        <div class="calc-row">
                            <span>Old Items Value:</span>
                            <span>₹${bill.exchangeDetails.oldItemsTotal.toFixed(2)}</span>
                        </div>
                        <div class="calc-row">
                            <span>New Items Value:</span>
                            <span>₹${bill.exchangeDetails.newItemsTotal.toFixed(2)}</span>
                        </div>
                    ` : ''}
                    <div class="calc-row total">
                        <span>${bill.exchangeDetails.hasExchange ? 'Balance ' : 'Grand '}Total:</span>
                        <span>₹${bill.grandTotal.toFixed(2)}</span>
                    </div>
                    ${bill.exchangeDetails.hasExchange ? `
                        <div class="calc-row">
                            <span>${bill.exchangeDetails.balancePayable > 0 ? 'Amount Payable:' : 'Amount Refundable:'}</span>
                            <span>₹${Math.max(
                                bill.exchangeDetails.balancePayable,
                                bill.exchangeDetails.balanceRefundable
                            ).toFixed(2)}</span>
                        </div>
                    ` : ''}
                </div>
                
                <div class="amount-words">
                    <strong>Amount in Words:</strong> ${bill.amountInWords}
                </div>
                
                <div class="qr-codes">
                    <div class="qr-box">
                        <h4>Bill QR Code</h4>
                        <img src="data:image/png;base64,${bill.qrCodes.billQR}" alt="Bill QR Code">
                        <p>Scan for bill details</p>
                    </div>
                    ${bill.qrCodes.itemProofQR ? `
                        <div class="qr-box">
                            <h4>Item Proof QR</h4>
                            <img src="data:image/png;base64,${bill.qrCodes.itemProofQR}" alt="Item Proof QR">
                            <p>Scan for item verification</p>
                        </div>
                    ` : ''}
                </div>
                
                <div class="invoice-footer">
                    <div class="terms">
                        <p><strong>Terms & Conditions:</strong></p>
                        <p>1. Goods once sold will not be taken back or exchanged.</p>
                        <p>2. All disputes subject to Patna jurisdiction only.</p>
                        <p>3. Certification charges extra if any.</p>
                        <p>4. Making charges are non-refundable.</p>
                    </div>
                    
                    <div class="signature">
                        <div class="signature-box">
                            <p>Customer Signature</p>
                            <div class="signature-line"></div>
                        </div>
                        <div class="signature-box">
                            <p>Authorized Signature</p>
                            <div class="signature-line"></div>
                            <p>For Shri Mahakaleshwar Jewellers</p>
                        </div>
                    </div>
                    
                    <p>Thank you for your business! Visit again.</p>
                </div>
            </div>
        `;
    }

    clearForm() {
        // Reset customer form
        document.getElementById('customerForm').reset();
        this.currentBill.customer = {
            name: '',
            mobile: '',
            address: '',
            dob: '',
            pan: '',
            aadhaar: ''
        };
        
        // Clear items
        document.getElementById('itemsContainer').innerHTML = '';
        document.getElementById('exchangeItems').innerHTML = '';
        this.currentBill.items = [];
        this.currentBill.exchangeItems = [];
        
        // Reset other fields
        this.currentBill.discount = 0;
        this.currentBill.paymentMode = 'cash';
        this.currentBill.paymentStatus = 'paid';
        
        document.getElementById('discount').value = '0';
        document.getElementById('paymentMode').value = 'cash';
        
        // Reset summary
        this.updateSummary();
        
        // Disable print button
        document.getElementById('printBillBtn').disabled = true;
        
        showAlert('info', 'Form cleared successfully');
    }
}

// Initialize billing system when page loads
document.addEventListener('DOMContentLoaded', () => {
    if (window.auth.isAuthenticated() && window.auth.isStaff()) {
        window.billingSystem = new BillingSystem();
        
        // Close modal handlers
        document.querySelectorAll('.modal .close').forEach(closeBtn => {
            closeBtn.addEventListener('click', function() {
                this.closest('.modal').classList.remove('show');
            });
        });
        
        // Close modal on outside click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', function(e) {
                if (e.target === this) {
                    this.classList.remove('show');
                }
            });
        });
    } else {
        window.location.href = 'login.html';
    }
});
