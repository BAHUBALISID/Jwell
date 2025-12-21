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
            isIntraState: true,
            gstOnMetal: 3,
            gstOnMaking: 5
        };
        this.rates = {};
        this.metalPurities = {
            'Gold': ['22K', '18K', '14K', '24K', '916', '750', '585'],
            'Silver': ['925', '999', '830', '900'],
            'Diamond': ['SI1', 'VS1', 'VVS1', 'IF', 'FL', 'I1', 'I2', 'I3'],
            'Platinum': ['950', '900', '850', '999'],
            'Antique / Polki': ['Traditional', 'Polki', 'Kundan', 'Meenakari'],
            'Others': ['Standard']
        };
        this.init();
    }

    async init() {
        await this.loadRates();
        this.setupEventListeners();
        this.setupCustomerFormListeners();
        this.updateSummary();
    }

    showAlert(type, message) {
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type}`;
        alertDiv.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span>${message}</span>
                <button onclick="this.parentElement.parentElement.remove()" 
                        style="background: none; border: none; font-size: 20px; cursor: pointer; color: inherit;">
                    &times;
                </button>
            </div>
        `;
        
        const container = document.getElementById('alertContainer');
        container.appendChild(alertDiv);
        
        setTimeout(() => {
            if (alertDiv.parentElement) {
                alertDiv.remove();
            }
        }, 5000);
    }

    async loadRates() {
        try {
            const response = await fetch(`${this.apiBase}/rates`);
            const data = await response.json();
            
            if (data.success) {
                this.rates = data.rates.reduce((acc, rate) => {
                    acc[rate.metalType] = {
                        ...rate,
                        purityLevels: rate.purityLevels || this.metalPurities[rate.metalType] || ['Standard']
                    };
                    return acc;
                }, {});
                
                console.log('Rates loaded with purity levels:', this.rates);
            } else {
                // Use default rates with purity levels
                this.rates = {
                    'Gold': { 
                        rate: 600000, 
                        unit: 'kg', 
                        gstRate: 3, 
                        gstOnMaking: 5, 
                        purityLevels: this.metalPurities['Gold'] 
                    },
                    'Silver': { 
                        rate: 80000, 
                        unit: 'kg', 
                        gstRate: 3, 
                        gstOnMaking: 5, 
                        purityLevels: this.metalPurities['Silver'] 
                    },
                    'Diamond': { 
                        rate: 50000, 
                        unit: 'carat', 
                        gstRate: 3, 
                        gstOnMaking: 5, 
                        purityLevels: this.metalPurities['Diamond'] 
                    },
                    'Platinum': { 
                        rate: 400000, 
                        unit: 'kg', 
                        gstRate: 3, 
                        gstOnMaking: 5, 
                        purityLevels: this.metalPurities['Platinum'] 
                    },
                    'Antique / Polki': { 
                        rate: 300000, 
                        unit: 'kg', 
                        gstRate: 3, 
                        gstOnMaking: 5, 
                        purityLevels: this.metalPurities['Antique / Polki'] 
                    },
                    'Others': { 
                        rate: 100000, 
                        unit: 'kg', 
                        gstRate: 3, 
                        gstOnMaking: 5, 
                        purityLevels: this.metalPurities['Others'] 
                    }
                };
            }
        } catch (error) {
            console.error('Error loading rates:', error);
            // Fallback to default rates with purity levels
            this.rates = {
                'Gold': { 
                    rate: 600000, 
                    unit: 'kg', 
                    gstRate: 3, 
                    gstOnMaking: 5, 
                    purityLevels: this.metalPurities['Gold'] 
                },
                'Silver': { 
                    rate: 80000, 
                    unit: 'kg', 
                    gstRate: 3, 
                    gstOnMaking: 5, 
                    purityLevels: this.metalPurities['Silver'] 
                }
            };
        }
    }

    setupEventListeners() {
    // GST Type
    document.getElementById('gstType').addEventListener('change', (e) => {
        this.currentBill.isIntraState = e.target.value === 'intra';
        this.updateSummary();
    });

    // Payment Mode
    document.getElementById('paymentMode').addEventListener('change', (e) => {
        this.currentBill.paymentMode = e.target.value;
    });

    // Discount
    document.getElementById('discount').addEventListener('input', (e) => {
        this.currentBill.discount = parseFloat(e.target.value) || 0;
        this.updateSummary();
    });

    // Add Item Button - FIXED: Remove any existing listeners first
    const addItemBtn = document.getElementById('addItemBtn');
    addItemBtn.replaceWith(addItemBtn.cloneNode(true));
    document.getElementById('addItemBtn').addEventListener('click', () => {
        this.addItemRow(false);
    });

    // Add Exchange Button - FIXED: Remove any existing listeners first
    const addExchangeBtn = document.getElementById('addExchangeBtn');
    addExchangeBtn.replaceWith(addExchangeBtn.cloneNode(true));
    document.getElementById('addExchangeBtn').addEventListener('click', () => {
        this.addItemRow(true);
    });

    // Generate Bill Button
    const generateBillBtn = document.getElementById('generateBillBtn');
    generateBillBtn.replaceWith(generateBillBtn.cloneNode(true));
    document.getElementById('generateBillBtn').addEventListener('click', () => {
        this.generateBill();
    });

    // Print Bill Button
    const printBillBtn = document.getElementById('printBillBtn');
    printBillBtn.replaceWith(printBillBtn.cloneNode(true));
    document.getElementById('printBillBtn').addEventListener('click', () => {
        this.printBill();
    });

    // Make mobile dropdowns visible
    this.fixDropdowns();
    }

    setupCustomerFormListeners() {
        const customerFields = {
            'customerName': 'name',
            'customerMobile': 'mobile',
            'customerAddress': 'address',
            'customerDOB': 'dob',
            'customerPAN': 'pan',
            'customerAadhaar': 'aadhaar'
        };

        Object.entries(customerFields).forEach(([elementId, field]) => {
            const element = document.getElementById(elementId);
            if (element) {
                element.addEventListener('input', (e) => {
                    this.currentBill.customer[field] = e.target.value;
                    console.log(`Customer ${field} updated to:`, e.target.value);
                });
                
                element.addEventListener('change', (e) => {
                    this.currentBill.customer[field] = e.target.value;
                    console.log(`Customer ${field} changed to:`, e.target.value);
                });
            }
        });
    }

    fixDropdowns() {
        const style = document.createElement('style');
        style.textContent = `
            select {
                display: block !important;
                visibility: visible !important;
                opacity: 1 !important;
                position: relative !important;
                z-index: 1 !important;
                background-color: white !important;
            }
            
            @media screen and (-webkit-min-device-pixel-ratio:0) {
                select, input, textarea {
                    font-size: 16px !important;
                }
            }
            
            select, input, button {
                min-height: 44px !important;
            }
            
            .item-row select {
                width: 100% !important;
                margin: 5px 0 !important;
            }
        `;
        document.head.appendChild(style);
    }

    updateCustomer(field, value) {
        this.currentBill.customer[field] = value;
        console.log(`Customer ${field} updated to:`, value);
    }

    updateDiscount(value) {
        this.currentBill.discount = parseFloat(value) || 0;
        this.updateSummary();
    }

    addItemRow(isExchange = false) {
        const containerId = isExchange ? 'exchangeItems' : 'itemsContainer';
        const container = document.getElementById(containerId);
        const itemId = 'item-' + Date.now() + Math.floor(Math.random() * 1000);
        
        // Remove placeholder if it exists
        const placeholder = container.querySelector('.text-center.text-muted');
        if (placeholder) {
            placeholder.remove();
        }
        
        const itemRow = document.createElement('div');
        itemRow.className = 'item-row';
        if (isExchange) itemRow.classList.add('exchange-row');
        itemRow.id = itemId;
        
        const metalOptions = Object.keys(this.rates).map(metal => 
            `<option value="${metal}">${metal}</option>`
        ).join('');
        
        if (isExchange) {
            itemRow.innerHTML = `
                <div>
                    <input type="text" class="form-control" placeholder="Description (optional)" 
                           oninput="window.billingSystem.handleItemInput('${itemId}', 'description', this.value, true)">
                </div>
                <div>
                    <select class="form-control metal-type" 
                            onchange="window.billingSystem.handleMetalChange('${itemId}', this.value, true)">
                        <option value="">Select Metal *</option>
                        ${metalOptions}
                    </select>
                </div>
                <div>
                    <select class="form-control purity" 
                            onchange="window.billingSystem.handleItemInput('${itemId}', 'purity', this.value, true)">
                        <option value="">Select Purity *</option>
                    </select>
                </div>
                <div>
                    <input type="number" class="form-control" step="0.001" placeholder="Weight *" 
                           oninput="window.billingSystem.handleItemInput('${itemId}', 'weight', this.value, true)">
                </div>
                <div>
                    <input type="number" class="form-control" step="0.1" placeholder="Wastage % (optional)" 
                           oninput="window.billingSystem.handleItemInput('${itemId}', 'wastageDeduction', this.value, true)">
                </div>
                <div>
                    <input type="number" class="form-control" step="0.01" placeholder="Melting Charges (optional)" 
                           oninput="window.billingSystem.handleItemInput('${itemId}', 'meltingCharges', this.value, true)">
                </div>
                <div>
                    <button class="btn btn-danger btn-sm" type="button"
                            onclick="window.billingSystem.removeItem('${itemId}', true)">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
            
            this.currentBill.exchangeItems.push({
                id: itemId,
                description: '',
                metalType: '',
                purity: '',
                weight: 0,
                wastageDeduction: 0,
                meltingCharges: 0
            });
            
            document.getElementById('exchangeSection').style.display = 'block';
        } else {
            itemRow.innerHTML = `
                <div>
                    <input type="text" class="form-control" placeholder="Description (optional)" 
                           oninput="window.billingSystem.handleItemInput('${itemId}', 'description', this.value, false)">
                </div>
                <div>
                    <select class="form-control metal-type" 
                            onchange="window.billingSystem.handleMetalChange('${itemId}', this.value, false)">
                        <option value="">Select Metal *</option>
                        ${metalOptions}
                    </select>
                </div>
                <div>
                    <select class="form-control purity" 
                            onchange="window.billingSystem.handleItemInput('${itemId}', 'purity', this.value, false)">
                        <option value="">Select Purity *</option>
                    </select>
                </div>
                <div>
                    <input type="number" class="form-control" step="0.001" placeholder="Weight (g) *" 
                           oninput="window.billingSystem.handleItemInput('${itemId}', 'weight', this.value, false)">
                </div>
                <div>
                    <input type="number" class="form-control" step="0.01" placeholder="Making Charges *" 
                           oninput="window.billingSystem.handleItemInput('${itemId}', 'makingCharges', this.value, false)">
                </div>
                <div>
                    <select class="form-control making-charges-type" 
                            onchange="window.billingSystem.handleItemInput('${itemId}', 'makingChargesType', this.value, false)">
                        <option value="percentage">%</option>
                        <option value="fixed">₹ Fixed</option>
                    </select>
                </div>
                <div>
                    <button class="btn btn-danger btn-sm" type="button"
                            onclick="window.billingSystem.removeItem('${itemId}', false)">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
            
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
        
        container.appendChild(itemRow);
        this.updateResponsiveLayout();
    }

    handleMetalChange(itemId, metalType, isExchange) {
        console.log('Metal changed:', metalType, 'for item:', itemId);
        
        const item = isExchange ? 
            this.currentBill.exchangeItems.find(i => i.id === itemId) :
            this.currentBill.items.find(i => i.id === itemId);
        
        if (item) {
            item.metalType = metalType;
            
            // Update purity dropdown
            const puritySelect = document.querySelector(`#${itemId} .purity`);
            if (puritySelect) {
                let purities = [];
                if (this.rates[metalType] && this.rates[metalType].purityLevels) {
                    purities = this.rates[metalType].purityLevels;
                } else if (this.metalPurities[metalType]) {
                    purities = this.metalPurities[metalType];
                } else {
                    purities = ['Standard'];
                }
                
                console.log('Setting purity options:', purities);
                
                puritySelect.innerHTML = '<option value="">Select Purity *</option>' + 
                    purities.map(purity => `<option value="${purity}">${purity}</option>`).join('');
                
                if (purities.length > 0) {
                    item.purity = purities[0];
                    puritySelect.value = purities[0];
                }
            }
            
            this.updateSummary();
        }
    }

    handleItemInput(itemId, field, value, isExchange) {
        const item = isExchange ? 
            this.currentBill.exchangeItems.find(i => i.id === itemId) :
            this.currentBill.items.find(i => i.id === itemId);
        
        if (item) {
            if (['weight', 'makingCharges', 'wastageDeduction', 'meltingCharges'].includes(field)) {
                item[field] = parseFloat(value) || 0;
            } else {
                item[field] = value;
            }
            
            this.updateSummary();
        }
    }

    removeItem(itemId, isExchange) {
        if (isExchange) {
            this.currentBill.exchangeItems = this.currentBill.exchangeItems.filter(
                item => item.id !== itemId
            );
            
            if (this.currentBill.exchangeItems.length === 0) {
                document.getElementById('exchangeSection').style.display = 'none';
            }
        } else {
            this.currentBill.items = this.currentBill.items.filter(
                item => item.id !== itemId
            );
            
            const itemsContainer = document.getElementById('itemsContainer');
            if (this.currentBill.items.length === 0 && itemsContainer) {
                itemsContainer.innerHTML = `
                    <div class="text-center text-muted" style="padding: 20px;">
                        <i class="fas fa-plus-circle fa-2x" style="margin-bottom: 10px;"></i>
                        <p>Click "Add Item" to start adding jewellery items</p>
                    </div>
                `;
            }
        }
        
        const element = document.getElementById(itemId);
        if (element) element.remove();
        
        this.updateSummary();
    }

    updateResponsiveLayout() {
        const itemRows = document.querySelectorAll('.item-row');
        const screenWidth = window.innerWidth;
        
        itemRows.forEach(row => {
            if (screenWidth < 768) {
                row.style.gridTemplateColumns = '1fr';
            } else if (screenWidth < 1024) {
                if (row.classList.contains('exchange-row')) {
                    row.style.gridTemplateColumns = 'repeat(3, 1fr)';
                } else {
                    row.style.gridTemplateColumns = 'repeat(2, 1fr)';
                }
            } else {
                if (row.classList.contains('exchange-row')) {
                    row.style.gridTemplateColumns = '2fr 1fr 1fr 1fr 1fr 1fr 1fr auto';
                } else {
                    row.style.gridTemplateColumns = '2fr 1fr 1fr 1fr 1fr 1fr auto';
                }
            }
        });
    }

    async updateSummary() {
        try {
            let metalValue = 0;
            let makingCharges = 0;
            let gstOnMetal = 0;
            let gstOnMaking = 0;
            let subTotal = 0;
            let exchangeValue = 0;
            
            const itemsHtml = [];
            const exchangeHtml = [];
            
            // Calculate new items
            for (const item of this.currentBill.items) {
                if (item.metalType && item.weight > 0) {
                    const rate = this.rates[item.metalType];
                    if (!rate) continue;
                    
                    let perGramRate = rate.rate;
                    if (rate.unit === 'kg') {
                        perGramRate = rate.rate / 1000;
                    }
                    
                    let itemMetalValue = perGramRate * item.weight;
                    
                    let itemMakingCharges = 0;
                    if (item.makingChargesType === 'percentage') {
                        itemMakingCharges = (itemMetalValue * item.makingCharges) / 100;
                    } else {
                        itemMakingCharges = item.makingCharges;
                    }
                    
                    const itemGstOnMetal = (itemMetalValue * this.currentBill.gstOnMetal) / 100;
                    const itemGstOnMaking = (itemMakingCharges * this.currentBill.gstOnMaking) / 100;
                    
                    const itemTotal = itemMetalValue + itemMakingCharges + itemGstOnMetal + itemGstOnMaking;
                    
                    metalValue += itemMetalValue;
                    makingCharges += itemMakingCharges;
                    gstOnMetal += itemGstOnMetal;
                    gstOnMaking += itemGstOnMaking;
                    subTotal += itemTotal;
                    
                    itemsHtml.push(`
                        <tr>
                            <td>${item.description || 'Item'}</td>
                            <td>${item.metalType} ${item.purity || ''}</td>
                            <td>${item.weight.toFixed(3)} ${rate.unit === 'kg' ? 'g' : rate.unit === 'carat' ? 'ct' : ''}</td>
                            <td>₹${itemTotal.toFixed(2)}</td>
                        </tr>
                    `);
                }
            }
            
            // Calculate exchange items
            for (const item of this.currentBill.exchangeItems) {
                if (item.metalType && item.weight > 0) {
                    const rate = this.rates[item.metalType];
                    if (!rate) continue;
                    
                    let perGramRate = rate.rate;
                    if (rate.unit === 'kg') {
                        perGramRate = rate.rate / 1000;
                    }
                    
                    let itemValue = perGramRate * item.weight;
                    
                    if (item.wastageDeduction > 0) {
                        itemValue = itemValue * ((100 - item.wastageDeduction) / 100);
                    }
                    
                    if (item.meltingCharges > 0) {
                        itemValue -= item.meltingCharges;
                    }
                    
                    exchangeValue += Math.max(0, itemValue);
                    
                    exchangeHtml.push(`
                        <tr>
                            <td>${item.description || 'Old Item'}</td>
                            <td>${item.metalType} ${item.purity || ''}</td>
                            <td>${item.weight.toFixed(3)} ${rate.unit === 'kg' ? 'g' : rate.unit === 'carat' ? 'ct' : ''}</td>
                            <td>₹${itemValue.toFixed(2)}</td>
                        </tr>
                    `);
                }
            }
            
            // Calculate totals
            const discount = this.currentBill.discount || 0;
            const totalBeforeGST = metalValue + makingCharges - discount;
            const grandTotal = totalBeforeGST + gstOnMetal + gstOnMaking;
            
            // Update display
            document.getElementById('metalValue').textContent = `₹${metalValue.toFixed(2)}`;
            document.getElementById('makingCharges').textContent = `₹${makingCharges.toFixed(2)}`;
            document.getElementById('subTotal').textContent = `₹${(metalValue + makingCharges).toFixed(2)}`;
            document.getElementById('gstMetal').textContent = `₹${gstOnMetal.toFixed(2)}`;
            document.getElementById('gstMaking').textContent = `₹${gstOnMaking.toFixed(2)}`;
            document.getElementById('grandTotal').textContent = `₹${grandTotal.toFixed(2)}`;
            
            // Update items list
            const itemsList = document.getElementById('itemsList');
            if (itemsHtml.length > 0) {
                itemsList.innerHTML = itemsHtml.join('');
            } else {
                itemsList.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No items added</td></tr>';
            }
            
            // Update exchange section
            const exchangeSection = document.getElementById('exchangeItemsSection');
            const exchangeSummary = document.getElementById('exchangeSummary');
            
            if (exchangeValue > 0) {
                exchangeSection.style.display = 'block';
                exchangeSummary.style.display = 'block';
                
                document.getElementById('exchangeValue').textContent = `₹${exchangeValue.toFixed(2)}`;
                
                const exchangeList = document.getElementById('exchangeItemsList');
                exchangeList.innerHTML = exchangeHtml.join('');
                
                const balance = exchangeValue - grandTotal;
                if (balance >= 0) {
                    document.getElementById('balanceRefund').textContent = `₹${balance.toFixed(2)}`;
                    document.getElementById('balancePay').textContent = '₹0.00';
                } else {
                    document.getElementById('balancePay').textContent = `₹${Math.abs(balance).toFixed(2)}`;
                    document.getElementById('balanceRefund').textContent = '₹0.00';
                }
            } else {
                exchangeSection.style.display = 'none';
                exchangeSummary.style.display = 'none';
            }
            
            // Update amount in words
            const amountInWords = await this.getAmountInWords(grandTotal);
            document.getElementById('amountInWords').textContent = amountInWords;
            
        } catch (error) {
            console.error('Update summary error:', error);
        }
    }

    async getAmountInWords(amount) {
        try {
            const response = await fetch(`${this.apiBase}/utils/amount-words`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ amount })
            });
            
            if (response.ok) {
                const data = await response.json();
                return data.words || this.numberToWordsLocal(amount);
            }
            return this.numberToWordsLocal(amount);
        } catch (error) {
            return this.numberToWordsLocal(amount);
        }
    }

    numberToWordsLocal(num) {
        const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
        const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
        const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
        
        const rupees = Math.floor(num);
        const paise = Math.round((num - rupees) * 100);
        
        let words = '';
        
        if (rupees === 0) {
            words = 'Zero';
        } else if (rupees < 10) {
            words = units[rupees];
        } else if (rupees < 20) {
            words = teens[rupees - 10];
        } else if (rupees < 100) {
            words = tens[Math.floor(rupees / 10)] + (rupees % 10 ? ' ' + units[rupees % 10] : '');
        } else if (rupees < 1000) {
            words = units[Math.floor(rupees / 100)] + ' Hundred' + 
                   (rupees % 100 ? ' ' + this.numberToWordsLocal(rupees % 100) : '');
        } else if (rupees < 100000) {
            words = this.numberToWordsLocal(Math.floor(rupees / 1000)) + ' Thousand' + 
                   (rupees % 1000 ? ' ' + this.numberToWordsLocal(rupees % 1000) : '');
        } else if (rupees < 10000000) {
            words = this.numberToWordsLocal(Math.floor(rupees / 100000)) + ' Lakh' + 
                   (rupees % 100000 ? ' ' + this.numberToWordsLocal(rupees % 100000) : '');
        } else {
            words = this.numberToWordsLocal(Math.floor(rupees / 10000000)) + ' Crore' + 
                   (rupees % 10000000 ? ' ' + this.numberToWordsLocal(rupees % 10000000) : '');
        }
        
        words += ' Rupees';
        
        if (paise > 0) {
            words += ' and ';
            if (paise < 10) {
                words += units[paise];
            } else if (paise < 20) {
                words += teens[paise - 10];
            } else {
                words += tens[Math.floor(paise / 10)] + (paise % 10 ? ' ' + units[paise % 10] : '');
            }
            words += ' Paise';
        }
        
        return words + ' Only';
    }

    validateBill() {
        console.log('Validating bill...', this.currentBill.customer);
        
        // Check customer details
        const customerNameInput = document.getElementById('customerName');
        const customerMobileInput = document.getElementById('customerMobile');
        
        if (customerNameInput && !this.currentBill.customer.name?.trim()) {
            this.currentBill.customer.name = customerNameInput.value.trim();
        }
        
        if (customerMobileInput && !this.currentBill.customer.mobile?.trim()) {
            this.currentBill.customer.mobile = customerMobileInput.value.trim();
        }
        
        if (!this.currentBill.customer.name?.trim()) {
            this.showAlert('danger', 'Customer name is required');
            return false;
        }
        
        if (!this.currentBill.customer.mobile?.trim()) {
            this.showAlert('danger', 'Customer mobile number is required');
            return false;
        }
        
        if (this.currentBill.items.length === 0) {
            this.showAlert('danger', 'At least one item is required');
            return false;
        }
        
        // Check each item
        for (let i = 0; i < this.currentBill.items.length; i++) {
            const item = this.currentBill.items[i];
            const itemRow = document.getElementById(item.id);
            
            if (!itemRow) continue;
            
            // Get current values from form fields
            const metalTypeSelect = itemRow.querySelector('.metal-type');
            const puritySelect = itemRow.querySelector('.purity');
            const weightInput = itemRow.querySelector('input[type="number"]:nth-of-type(1)');
            const makingChargesInput = itemRow.querySelector('input[type="number"]:nth-of-type(2)');
            const makingChargesTypeSelect = itemRow.querySelector('.making-charges-type'); // Fixed: Added class
            
            // Update item data from form fields
            if (metalTypeSelect) {
                item.metalType = metalTypeSelect.value;
            }
            
            if (puritySelect) {
                item.purity = puritySelect.value;
            }
            
            if (weightInput) {
                item.weight = parseFloat(weightInput.value) || 0;
            }
            
            if (makingChargesInput) {
                item.makingCharges = parseFloat(makingChargesInput.value) || 0;
            }
            
            if (makingChargesTypeSelect) {
                item.makingChargesType = makingChargesTypeSelect.value;
            }
            
            // Now validate
            if (!item.metalType || item.metalType.trim() === '') {
                this.showAlert('danger', `Please select metal type for item ${i + 1}`);
                return false;
            }
            
            if (!item.purity || item.purity.trim() === '') {
                this.showAlert('danger', `Please select purity for item ${i + 1}`);
                return false;
            }
            
            if (!item.weight || item.weight <= 0) {
                this.showAlert('danger', `Please enter valid weight for item ${i + 1}`);
                return false;
            }
            
            if (item.makingCharges === undefined || item.makingCharges < 0) {
                this.showAlert('danger', `Please enter valid making charges for item ${i + 1}`);
                return false;
            }
            
            if (!item.makingChargesType || !['percentage', 'fixed'].includes(item.makingChargesType)) {
                item.makingChargesType = 'percentage'; // Default value
            }
        }
        
        return true;
    }

    async generateBill() {
        if (!this.validateBill()) {
            return;
        }
        
        const btn = document.getElementById('generateBillBtn');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<span class="spinner"></span> Generating...';
        btn.disabled = true;
        
        try {
            // Capture all customer data with fallbacks
            const customerName = document.getElementById('customerName').value.trim();
            const customerMobile = document.getElementById('customerMobile').value.trim();
            const customerAddress = document.getElementById('customerAddress').value.trim();
            const customerDOB = document.getElementById('customerDOB').value;
            const customerPAN = document.getElementById('customerPAN').value;
            const customerAadhaar = document.getElementById('customerAadhaar').value;
            
            if (!customerName || !customerMobile) {
                throw new Error('Customer name and mobile are required');
            }
            
            // Prepare customer data - ensure optional fields are empty strings if not provided
            const customerData = {
                name: customerName,
                mobile: customerMobile,
                address: customerAddress || '',
                dob: customerDOB || '',
                pan: customerPAN || '',
                aadhaar: customerAadhaar || ''
            };
            
            // Prepare items data - ensure all required fields are present
            const itemsData = [];
            for (let i = 0; i < this.currentBill.items.length; i++) {
                const item = this.currentBill.items[i];
                const itemRow = document.getElementById(item.id);
                
                if (!itemRow) continue;
                
                const metalTypeSelect = itemRow.querySelector('.metal-type');
                const puritySelect = itemRow.querySelector('.purity');
                const weightInput = itemRow.querySelector('input[type="number"]:nth-of-type(1)');
                const makingChargesInput = itemRow.querySelector('input[type="number"]:nth-of-type(2)');
                const makingChargesTypeSelect = itemRow.querySelector('.making-charges-type');
                
                const itemData = {
                    description: item.description || '',
                    metalType: metalTypeSelect ? metalTypeSelect.value : item.metalType,
                    purity: puritySelect ? puritySelect.value : item.purity,
                    weight: weightInput ? parseFloat(weightInput.value) || 0 : item.weight,
                    makingCharges: makingChargesInput ? parseFloat(makingChargesInput.value) || 0 : item.makingCharges,
                    makingChargesType: makingChargesTypeSelect ? makingChargesTypeSelect.value : item.makingChargesType || 'percentage'
                };
                
                // Validate makingChargesType
                if (!['percentage', 'fixed'].includes(itemData.makingChargesType)) {
                    itemData.makingChargesType = 'percentage';
                }
                
                itemsData.push(itemData);
            }
            
            // Prepare exchange items data
            const exchangeItemsData = this.currentBill.exchangeItems.map(item => ({
                description: item.description || '',
                metalType: item.metalType,
                purity: item.purity,
                weight: item.weight,
                wastageDeduction: item.wastageDeduction || 0,
                meltingCharges: item.meltingCharges || 0
            }));
            
            const billData = {
                customer: customerData,
                items: itemsData,
                exchangeItems: exchangeItemsData,
                discount: this.currentBill.discount,
                paymentMode: this.currentBill.paymentMode,
                isIntraState: this.currentBill.isIntraState,
                gstOnMetal: this.currentBill.gstOnMetal,
                gstOnMaking: this.currentBill.gstOnMaking
            };
            
            console.log('Sending bill data:', billData);
            
            const response = await fetch(`${this.apiBase}/bills/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify(billData)
            });
            
            const data = await response.json();
            
            console.log('Server response:', data);
            
            if (data.success) {
                this.showAlert('success', 'Bill generated successfully!');
                this.showBillPreview(data.bill);
                document.getElementById('printBillBtn').disabled = false;
            } else {
                // Show detailed error message from server
                let errorMessage = 'Failed to generate bill';
                if (data.message) {
                    errorMessage = data.message;
                }
                if (data.errors && Array.isArray(data.errors)) {
                    errorMessage = data.errors.map(err => err.msg || err.message).join(', ');
                }
                throw new Error(errorMessage);
            }
        } catch (error) {
            console.error('Generate bill error:', error);
            this.showAlert('danger', error.message || 'Failed to generate bill. Please check console for details.');
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }

    showBillPreview(bill) {
    window.currentBill = bill;
    
    document.getElementById('previewBillNumber').textContent = bill.billNumber;
    document.getElementById('previewBillDate').textContent = 
        new Date(bill.billDate).toLocaleDateString('en-IN');
    document.getElementById('previewCustomerName').textContent = bill.customer.name;
    document.getElementById('previewCustomerMobile').textContent = bill.customer.mobile;
    document.getElementById('previewCustomerAddress').textContent = bill.customer.address || 'Not provided';
    document.getElementById('previewPaymentMode').textContent = bill.paymentMode.toUpperCase();
    document.getElementById('previewGSTType').textContent = bill.isIntraState ? 'CGST+SGST' : 'IGST';
    document.getElementById('previewInvoiceType').textContent = 
        bill.exchangeDetails.hasExchange ? 'Sale with Exchange' : 'Sale';
    
    // FIXED: Use gstDetails from bill response with fallbacks
    const gstDetails = bill.gstDetails || {};
    const metalAmount = gstDetails.metalAmount || 0;
    const makingCharges = gstDetails.makingCharges || 0;
    const gstOnMetal = gstDetails.gstOnMetal || 0;
    const gstOnMaking = gstDetails.gstOnMaking || 0;
    
    // Calculate values if not directly available
    const metalValue = metalAmount || (bill.grandTotal - gstOnMetal - gstOnMaking - bill.discount - makingCharges);
    const makingChargesAmount = makingCharges || 0;
    
    document.getElementById('previewMetalValue').textContent = `₹${metalValue.toFixed(2)}`;
    document.getElementById('previewMakingCharges').textContent = `₹${makingChargesAmount.toFixed(2)}`;
    document.getElementById('previewSubTotal').textContent = `₹${(metalValue + makingChargesAmount).toFixed(2)}`;
    document.getElementById('previewDiscount').textContent = `₹${bill.discount.toFixed(2)}`;
    document.getElementById('previewGSTMetal').textContent = `₹${gstOnMetal.toFixed(2)}`;
    document.getElementById('previewGSTMaking').textContent = `₹${gstOnMaking.toFixed(2)}`;
    document.getElementById('previewGrandTotal').textContent = `₹${bill.grandTotal.toFixed(2)}`;
    document.getElementById('previewAmountWords').textContent = bill.amountInWords;
    
    const regularItems = bill.items.filter(item => !item.isExchangeItem);
    const exchangeItems = bill.items.filter(item => item.isExchangeItem);
    
    document.getElementById('previewItems').innerHTML = regularItems.map(item => `
        <tr>
            <td>${item.description || 'Item'}</td>
            <td>${item.metalType} ${item.purity}</td>
            <td>${item.weight.toFixed(3)} ${item.metalType === 'Diamond' ? 'ct' : 'g'}</td>
            <td>₹${item.amount.toFixed(2)}</td>
        </tr>
    `).join('');
    
    if (exchangeItems.length > 0) {
        document.getElementById('exchangePreviewSection').style.display = 'block';
        document.getElementById('previewExchangeDetails').style.display = 'block';
        
        document.getElementById('previewExchangeItems').innerHTML = exchangeItems.map(item => `
            <tr>
                <td>${item.description || 'Old Item'}</td>
                <td>${item.metalType} ${item.purity}</td>
                <td>${item.weight.toFixed(3)} ${item.metalType === 'Diamond' ? 'ct' : 'g'}</td>
                <td>₹${Math.abs(item.amount).toFixed(2)}</td>
            </tr>
        `).join('');
        
        document.getElementById('previewOldItemsTotal').textContent = 
            `₹${bill.exchangeDetails.oldItemsTotal.toFixed(2)}`;
        
        if (bill.exchangeDetails.balancePayable > 0) {
            document.getElementById('previewBalance').textContent = 
                `₹${bill.exchangeDetails.balancePayable.toFixed(2)} Payable`;
        } else {
            document.getElementById('previewBalance').textContent = 
                `₹${bill.exchangeDetails.balanceRefundable.toFixed(2)} Refundable`;
        }
    } else {
        document.getElementById('exchangePreviewSection').style.display = 'none';
        document.getElementById('previewExchangeDetails').style.display = 'none';
    }
    
    if (bill.qrCodes?.billQR) {
        document.getElementById('previewBillQR').src = 
            `data:image/png;base64,${bill.qrCodes.billQR}`;
    }
    
    document.getElementById('billPreviewModal').classList.add('show');
}
    printBill() {
    if (!window.currentBill) {
        this.showAlert('warning', 'Please generate a bill first');
        return;
    }
    
    const bill = window.currentBill;
    
    // Create print container if it doesn't exist
    let printContainer = document.getElementById('printContainer');
    if (!printContainer) {
        printContainer = document.createElement('div');
        printContainer.id = 'printContainer';
        printContainer.className = 'print-container';
        document.body.appendChild(printContainer);
    }
    
    // Generate print content
    const printContent = this.generatePrintHTML(bill);
    
    // Set the content
    printContainer.innerHTML = printContent;
    
    // Show print container
    printContainer.style.display = 'block';
    
    // Mobile detection
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile) {
        // Mobile: Show in same page, then print after rendering
        printContainer.scrollIntoView({ behavior: 'smooth' });
        
        // Wait for content to render
        setTimeout(() => {
            // Trigger print dialog
            window.print();
            
            // Hide container after printing
            setTimeout(() => {
                printContainer.style.display = 'none';
            }, 1000);
        }, 500);
    } else {
        // Desktop: Open new window for printing
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Bill ${bill.billNumber}</title>
                    <link rel="stylesheet" href="css/print.css">
                    <style>
                        body { margin: 0; padding: 0; }
                        @page { size: A4; margin: 15mm; }
                    </style>
                </head>
                <body>
                    ${printContent}
                    <script>
                        window.onload = function() {
                            setTimeout(function() {
                                window.print();
                                setTimeout(function() {
                                    window.close();
                                }, 100);
                            }, 100);
                        };
                    </script>
                </body>
                </html>
            `);
            printWindow.document.close();
        } else {
            // Fallback to same page if popup blocked
            window.print();
        }
    }
}
generatePrintHTML(bill) {
    const regularItems = bill.items.filter(item => !item.isExchangeItem);
    const exchangeItems = bill.items.filter(item => item.isExchangeItem);
    const gstDetails = bill.gstDetails || {};
    
    return `
        <div class="invoice-container keep-together">
            <div class="shop-name">Shri Mahakaleshwar Jewellers</div>
            <div class="shop-address">Anisabad, Patna, Bihar - 800002</div>
            <div class="shop-contact">Mobile: +91 9876543210 | GSTIN: 10ABCDE1234F1Z5</div>
            
            <div class="bill-info">
                <div>
                    <div class="bill-number"><strong>Bill No:</strong> ${bill.billNumber}</div>
                    <div class="bill-date"><strong>Date:</strong> ${new Date(bill.billDate).toLocaleDateString('en-IN')}</div>
                </div>
                <div>
                    <div><strong>Invoice Type:</strong> ${bill.exchangeDetails?.hasExchange ? 'Sale with Exchange' : 'Sale'}</div>
                    <div><strong>Payment Mode:</strong> ${bill.paymentMode?.toUpperCase() || 'CASH'}</div>
                    <div><strong>GST Type:</strong> ${bill.isIntraState ? 'CGST+SGST' : 'IGST'}</div>
                </div>
            </div>
            
            <div class="customer-info">
                <h3>Customer Details</h3>
                <p><strong>Name:</strong> ${bill.customer.name}</p>
                <p><strong>Mobile:</strong> ${bill.customer.mobile}</p>
                ${bill.customer.address ? `<p><strong>Address:</strong> ${bill.customer.address}</p>` : ''}
                ${bill.customer.pan ? `<p><strong>PAN:</strong> ${bill.customer.pan}</p>` : ''}
                ${bill.customer.aadhaar ? `<p><strong>Aadhaar:</strong> ${bill.customer.aadhaar}</p>` : ''}
                ${bill.customer.dob ? `<p><strong>Date of Birth:</strong> ${new Date(bill.customer.dob).toLocaleDateString('en-IN')}</p>` : ''}
            </div>
            
            <h3 style="margin: 5mm 0 2mm 0; color: #D4AF37;">Items</h3>
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
                    ${regularItems.map(item => `
                        <tr>
                            <td>${item.description || ''}</td>
                            <td>${item.metalType} ${item.purity}</td>
                            <td>${item.weight.toFixed(3)} ${item.metalType === 'Diamond' ? 'ct' : 'g'}</td>
                            <td>₹${item.amount.toFixed(2)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            
            ${exchangeItems.length > 0 ? `
                <h3 style="margin: 5mm 0 2mm 0; color: #D4AF37;">Exchange Items</h3>
                <table class="items-table">
                    <thead>
                        <tr>
                            <th>Description</th>
                            <th>Metal & Purity</th>
                            <th>Weight</th>
                            <th>Value (₹)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${exchangeItems.map(item => `
                            <tr>
                                <td>${item.description || 'Old Item'}</td>
                                <td>${item.metalType} ${item.purity}</td>
                                <td>${item.weight.toFixed(3)} ${item.metalType === 'Diamond' ? 'ct' : 'g'}</td>
                                <td>-₹${Math.abs(item.amount).toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            ` : ''}
            
            <div class="calculations">
                <div class="calc-row">
                    <span>Metal Value:</span>
                    <span>₹${(gstDetails.metalAmount || 0).toFixed(2)}</span>
                </div>
                <div class="calc-row">
                    <span>Making Charges:</span>
                    <span>₹${(gstDetails.makingCharges || 0).toFixed(2)}</span>
                </div>
                <div class="calc-row">
                    <span>Sub Total:</span>
                    <span>₹${((gstDetails.metalAmount || 0) + (gstDetails.makingCharges || 0)).toFixed(2)}</span>
                </div>
                <div class="calc-row">
                    <span>Discount:</span>
                    <span>-₹${(bill.discount || 0).toFixed(2)}</span>
                </div>
                <div class="calc-row">
                    <span>GST on Metal (${gstDetails.gstOnMetalRate || 3}%):</span>
                    <span>₹${(gstDetails.gstOnMetal || 0).toFixed(2)}</span>
                </div>
                <div class="calc-row">
                    <span>GST on Making (${gstDetails.gstOnMakingRate || 5}%):</span>
                    <span>₹${(gstDetails.gstOnMaking || 0).toFixed(2)}</span>
                </div>
                ${bill.exchangeDetails?.hasExchange ? `
                    <div class="calc-row">
                        <span>Old Items Value:</span>
                        <span>₹${(bill.exchangeDetails.oldItemsTotal || 0).toFixed(2)}</span>
                    </div>
                ` : ''}
                <div class="calc-row total">
                    <span>${bill.exchangeDetails?.hasExchange ? 'Balance ' : 'Grand '}Total:</span>
                    <span>₹${(bill.grandTotal || 0).toFixed(2)}</span>
                </div>
                ${bill.exchangeDetails?.hasExchange ? `
                    <div class="calc-row">
                        <span>${bill.exchangeDetails.balancePayable > 0 ? 'Amount Payable:' : 'Amount Refundable:'}</span>
                        <span>₹${Math.max(bill.exchangeDetails.balancePayable || 0, bill.exchangeDetails.balanceRefundable || 0).toFixed(2)}</span>
                    </div>
                ` : ''}
            </div>
            
            <div class="amount-words">
                <p><strong>Amount in Words:</strong> ${bill.amountInWords || 'Zero Rupees Only'}</p>
            </div>
            
            <div class="qr-codes">
                ${bill.qrCodes?.billQR ? `
                    <div class="qr-box">
                        <h4>Bill QR Code</h4>
                        <img src="data:image/png;base64,${bill.qrCodes.billQR}" alt="Bill QR Code">
                        <p>Scan for bill details</p>
                    </div>
                ` : ''}
            </div>
            
            <div class="invoice-footer">
                <div class="signature">
                    <div class="signature-box">
                        <div class="signature-line"></div>
                        <p>Customer Signature</p>
                    </div>
                    <div class="signature-box">
                        <div class="signature-line"></div>
                        <p>Authorized Signature</p>
                        <p>For Shri Mahakaleshwar Jewellers</p>
                    </div>
                </div>
                
                <div class="terms">
                    <p><strong>Terms & Conditions:</strong></p>
                    <p>1. Goods once sold will not be taken back or exchanged.</p>
                    <p>2. All disputes subject to Patna jurisdiction only.</p>
                    <p>3. Certification charges extra if any.</p>
                    <p>4. Making charges are non-refundable.</p>
                    <p style="text-align: center; margin-top: 5mm;">Thank you for your business! Visit again.</p>
                </div>
            </div>
        </div>
    `;
}             
    clearForm() {
        if (!confirm('Are you sure you want to clear the form? All data will be lost.')) {
            return;
        }
        
        this.currentBill.customer = {
            name: '',
            mobile: '',
            address: '',
            dob: '',
            pan: '',
            aadhaar: ''
        };
        
        document.getElementById('customerForm').reset();
        
        this.currentBill.items = [];
        this.currentBill.exchangeItems = [];
        this.currentBill.discount = 0;
        
        document.getElementById('itemsContainer').innerHTML = `
            <div class="text-center text-muted" style="padding: 20px;">
                <i class="fas fa-plus-circle fa-2x" style="margin-bottom: 10px;"></i>
                <p>Click "Add Item" to start adding jewellery items</p>
            </div>
        `;
        document.getElementById('exchangeItems').innerHTML = '';
        document.getElementById('discount').value = '0';
        document.getElementById('exchangeSection').style.display = 'none';
        
        this.currentBill.paymentMode = 'cash';
        this.currentBill.isIntraState = true;
        
        document.getElementById('paymentMode').value = 'cash';
        document.getElementById('gstType').value = 'intra';
        
        this.updateSummary();
        document.getElementById('printBillBtn').disabled = true;
        
        this.showAlert('info', 'Form cleared successfully');
    }
}

// Initialize on page load
if (typeof window !== 'undefined') {
    window.BillingSystem = BillingSystem;
    
    // Make functions globally accessible
    window.billingSystem = {
        handleMetalChange: (itemId, metalType, isExchange) => {
            if (window.BillingSystem && window.BillingSystem.instance) {
                window.BillingSystem.instance.handleMetalChange(itemId, metalType, isExchange);
            }
        },
        handleItemInput: (itemId, field, value, isExchange) => {
            if (window.BillingSystem && window.BillingSystem.instance) {
                window.BillingSystem.instance.handleItemInput(itemId, field, value, isExchange);
            }
        },
        removeItem: (itemId, isExchange) => {
            if (window.BillingSystem && window.BillingSystem.instance) {
                window.BillingSystem.instance.removeItem(itemId, isExchange);
            }
        },
        clearForm: () => {
            if (window.BillingSystem && window.BillingSystem.instance) {
                window.BillingSystem.instance.clearForm();
            }
        },
        printBill: () => {
            if (window.BillingSystem && window.BillingSystem.instance) {
                window.BillingSystem.instance.printBill();
            }
        },
        updateCustomer: (field, value) => {
            if (window.BillingSystem && window.BillingSystem.instance) {
                window.BillingSystem.instance.updateCustomer(field, value);
            }
        }
    };
}
if (typeof window !== 'undefined') {
    BillingSystem.instance = new BillingSystem();
}
