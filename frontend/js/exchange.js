// Exchange System Module
class ExchangeSystem {
    constructor() {
        this.apiBase = 'http://localhost:5000/api';
        this.token = window.auth.getToken();
        this.rates = {};
        this.oldItems = {};
        this.newItems = {};
        this.exchangeData = null;
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
        this.setupExchangeCalculator();
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
            } else {
                // Use default rates
                this.rates = {
                    'Gold': { rate: 600000, unit: 'kg', purityLevels: this.metalPurities['Gold'] },
                    'Silver': { rate: 80000, unit: 'kg', purityLevels: this.metalPurities['Silver'] },
                    'Diamond': { rate: 50000, unit: 'carat', purityLevels: this.metalPurities['Diamond'] },
                    'Platinum': { rate: 400000, unit: 'kg', purityLevels: this.metalPurities['Platinum'] },
                    'Antique / Polki': { rate: 300000, unit: 'kg', purityLevels: this.metalPurities['Antique / Polki'] },
                    'Others': { rate: 100000, unit: 'kg', purityLevels: this.metalPurities['Others'] }
                };
            }
        } catch (error) {
            console.error('Error loading rates:', error);
            showAlert('danger', 'Failed to load rates');
        }
    }

    setupEventListeners() {
        // Old item form
        document.getElementById('addOldItemBtn').addEventListener('click', () => {
            this.addOldItemRow();
        });

        // New item form
        document.getElementById('addNewItemBtn').addEventListener('click', () => {
            this.addNewItemRow();
        });

        // Calculate exchange button
        document.getElementById('calculateExchangeBtn').addEventListener('click', () => {
            this.calculateExchange();
        });

        // Print exchange bill button
        document.getElementById('printExchangeBtn').addEventListener('click', () => {
            this.previewExchangeBill();
        });

        // Proceed to billing button
        document.getElementById('proceedToBillingBtn').addEventListener('click', () => {
            this.proceedToBilling();
        });

        // Reset form button
        document.getElementById('resetExchangeBtn').addEventListener('click', () => {
            this.resetExchange();
        });
    }

    setupExchangeCalculator() {
        const calculator = document.getElementById('exchangeCalculator');
        if (calculator) {
            const metalOptions = Object.keys(this.rates).map(metal => 
                `<option value="${metal}">${metal}</option>`
            ).join('');
            
            calculator.innerHTML = `
                <div class="calculator-grid">
                    <div class="calculator-section">
                        <h4>Old Item Value Calculator</h4>
                        <div class="calc-form">
                            <div class="form-group">
                                <label>Metal Type</label>
                                <select class="form-control calc-metal" id="calcOldMetal">
                                    ${metalOptions}
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Purity</label>
                                <select class="form-control calc-purity" id="calcOldPurity"></select>
                            </div>
                            <div class="form-group">
                                <label>Weight (g/carat)</label>
                                <input type="number" class="form-control" id="calcOldWeight" step="0.001" min="0" placeholder="Enter weight">
                            </div>
                            <div class="form-group">
                                <label>Wastage Deduction (%)</label>
                                <input type="number" class="form-control" id="calcWastage" step="0.1" min="0" max="100" value="2">
                            </div>
                            <div class="form-group">
                                <label>Melting Charges (₹)</label>
                                <input type="number" class="form-control" id="calcMelting" step="0.01" min="0" value="0">
                            </div>
                            <button class="btn btn-primary" onclick="exchangeSystem.calculateItemValue()">
                                <i class="fas fa-calculator"></i> Calculate Value
                            </button>
                        </div>
                    </div>
                    
                    <div class="calculator-section">
                        <h4>Calculation Result</h4>
                        <div class="calc-result">
                            <div class="result-row">
                                <span>Metal Value:</span>
                                <span id="calcMetalValue">₹0.00</span>
                            </div>
                            <div class="result-row">
                                <span>After 3% Shop Deduction:</span>
                                <span id="calcAfterShopDeduction">₹0.00</span>
                            </div>
                            <div class="result-row">
                                <span>After Wastage Deduction:</span>
                                <span id="calcAfterWastage">₹0.00</span>
                            </div>
                            <div class="result-row">
                                <span>After Melting Charges:</span>
                                <span id="calcAfterMelting">₹0.00</span>
                            </div>
                            <div class="result-row total">
                                <span>Net Exchange Value:</span>
                                <span id="calcNetValue">₹0.00</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // Initialize purity dropdown
            const metalSelect = document.getElementById('calcOldMetal');
            this.updateCalculatorPurities(metalSelect.value);
            
            metalSelect.addEventListener('change', (e) => {
                this.updateCalculatorPurities(e.target.value);
            });
        }
    }

    updatePurities(metalType, rowId) {
        const rate = this.rates[metalType];
        if (!rate) return;
        
        const puritySelect = document.querySelector(`#${rowId} .exchange-purity`);
        if (puritySelect) {
            puritySelect.innerHTML = '<option value="">Select Purity</option>' + 
                (rate.purityLevels || this.metalPurities[metalType] || ['Standard'])
                    .map(purity => `<option value="${purity}">${purity}</option>`)
                    .join('');
        }
    }

    updateCalculatorPurities(metalType) {
        const rate = this.rates[metalType];
        if (!rate) return;
        
        const puritySelect = document.getElementById('calcOldPurity');
        puritySelect.innerHTML = '<option value="">Select Purity</option>' + 
            (rate.purityLevels || this.metalPurities[metalType] || ['Standard'])
                .map(purity => `<option value="${purity}">${purity}</option>`)
                .join('');
    }

    addOldItemRow() {
        const container = document.getElementById('oldItemsContainer');
        const itemId = `old-item-${Date.now()}`;
        
        const row = document.createElement('div');
        row.className = 'item-row old-item';
        row.id = itemId;
        
        const metalOptions = Object.keys(this.rates).map(metal => 
            `<option value="${metal}">${metal}</option>`
        ).join('');
        
        row.innerHTML = `
            <div data-label="Description">
                <input type="text" class="form-control item-description" placeholder="Description (optional)" 
                       oninput="exchangeSystem.handleItemInput('${itemId}', 'description', this.value, true)">
            </div>
            
            <div data-label="Metal Type">
                <select class="form-control exchange-metal-type" 
                        onchange="exchangeSystem.handleMetalChange('${itemId}', this.value, true)">
                    <option value="">Select Metal *</option>
                    ${metalOptions}
                </select>
            </div>
            
            <div data-label="Purity">
                <select class="form-control exchange-purity" 
                        onchange="exchangeSystem.handleItemInput('${itemId}', 'purity', this.value, true)">
                    <option value="">Select Purity *</option>
                </select>
            </div>
            
            <div data-label="Weight">
                <input type="number" class="form-control weight" step="0.001" placeholder="Weight *" 
                       oninput="exchangeSystem.handleItemInput('${itemId}', 'weight', this.value, true)">
            </div>
            
            <div data-label="Wastage %">
                <input type="number" class="form-control wastage" step="0.1" placeholder="Wastage %" value="2"
                       oninput="exchangeSystem.handleItemInput('${itemId}', 'wastageDeduction', this.value, true)">
            </div>
            
            <div data-label="Melting Charges">
                <input type="number" class="form-control melting" step="0.01" placeholder="Melting Charges" value="0"
                       oninput="exchangeSystem.handleItemInput('${itemId}', 'meltingCharges', this.value, true)">
            </div>
            
            <div>
                <button class="btn btn-danger btn-sm" onclick="exchangeSystem.removeItem('${itemId}', true)">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        this.oldItems[itemId] = {
            id: itemId,
            description: '',
            metalType: '',
            purity: '',
            weight: 0,
            wastageDeduction: 2,
            meltingCharges: 0
        };
        
        container.appendChild(row);
        this.updateExchangeSummary();
    }

    addNewItemRow() {
        const container = document.getElementById('newItemsContainer');
        const itemId = `new-item-${Date.now()}`;
        
        const row = document.createElement('div');
        row.className = 'item-row new-item';
        row.id = itemId;
        
        const metalOptions = Object.keys(this.rates).map(metal => 
            `<option value="${metal}">${metal}</option>`
        ).join('');
        
        row.innerHTML = `
            <div data-label="Description">
                <input type="text" class="form-control item-description" placeholder="Description (optional)" 
                       oninput="exchangeSystem.handleItemInput('${itemId}', 'description', this.value, false)">
            </div>
            
            <div data-label="Metal Type">
                <select class="form-control exchange-metal-type" 
                        onchange="exchangeSystem.handleMetalChange('${itemId}', this.value, false)">
                    <option value="">Select Metal *</option>
                    ${metalOptions}
                </select>
            </div>
            
            <div data-label="Purity">
                <select class="form-control exchange-purity" 
                        onchange="exchangeSystem.handleItemInput('${itemId}', 'purity', this.value, false)">
                    <option value="">Select Purity *</option>
                </select>
            </div>
            
            <div data-label="Unit">
                <select class="form-control unit" 
                        onchange="exchangeSystem.handleItemInput('${itemId}', 'unit', this.value, false)">
                    <option value="GM">GM</option>
                    <option value="PCS">PCS</option>
                </select>
            </div>
            
            <div data-label="Quantity">
                <input type="number" class="form-control quantity" step="1" placeholder="Qty" value="1"
                       oninput="exchangeSystem.handleItemInput('${itemId}', 'quantity', this.value, false)">
            </div>
            
            <div data-label="Gross Weight">
                <input type="number" class="form-control gross-weight" step="0.001" placeholder="Gross Wt (g)" 
                       oninput="exchangeSystem.handleWeightUpdate('${itemId}', this, 'grossWeight')">
            </div>
            
            <div data-label="Less Weight">
                <input type="number" class="form-control less-weight" step="0.001" placeholder="Less Wt (g)" 
                       oninput="exchangeSystem.handleWeightUpdate('${itemId}', this, 'lessWeight')">
            </div>
            
            <div data-label="Net Weight">
                <input type="number" class="form-control net-weight" step="0.001" placeholder="Net Wt (g) *" readonly
                       oninput="exchangeSystem.handleItemInput('${itemId}', 'weight', this.value, false)">
            </div>
            
            <div data-label="Rate">
                <input type="number" class="form-control rate" step="0.01" placeholder="Rate/g" 
                       oninput="exchangeSystem.handleItemInput('${itemId}', 'rate', this.value, false)">
            </div>
            
            <div data-label="Making Type">
                <select class="form-control making-charges-type" 
                        onchange="exchangeSystem.handleItemInput('${itemId}', 'makingChargesType', this.value, false)">
                    <option value="percentage">%</option>
                    <option value="fixed">₹ Fixed</option>
                    <option value="GRM">₹/GM</option>
                </select>
            </div>
            
            <div data-label="Making Charges">
                <input type="number" class="form-control making-charges" step="0.01" placeholder="Making Charges *" 
                       oninput="exchangeSystem.handleItemInput('${itemId}', 'makingCharges', this.value, false)">
            </div>
            
            <div data-label="Discount on Making">
                <input type="number" class="form-control making-discount" step="0.01" placeholder="Disc. on Making %" 
                       oninput="exchangeSystem.handleItemInput('${itemId}', 'makingChargesDiscount', this.value, false)">
            </div>
            
            <div data-label="HUID/Hallmark">
                <input type="text" class="form-control huid" placeholder="HUID/Hallmark" 
                       oninput="exchangeSystem.handleItemInput('${itemId}', 'huid', this.value, false)">
            </div>
            
            <div data-label="Tunch">
                <input type="text" class="form-control tunch" placeholder="Tunch" 
                       oninput="exchangeSystem.handleItemInput('${itemId}', 'tunch', this.value, false)">
            </div>
            
            <div>
                <button class="btn btn-danger btn-sm" onclick="exchangeSystem.removeItem('${itemId}', false)">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        this.newItems[itemId] = {
            id: itemId,
            description: '',
            metalType: '',
            purity: '',
            unit: 'GM',
            quantity: 1,
            grossWeight: 0,
            lessWeight: 0,
            weight: 0,
            rate: 0,
            makingCharges: 0,
            makingChargesType: 'percentage',
            makingChargesDiscount: 0,
            huid: '',
            tunch: ''
        };
        
        container.appendChild(row);
        this.updateExchangeSummary();
    }

    handleMetalChange(itemId, metalType, isOldItem) {
        if (isOldItem) {
            const item = this.oldItems[itemId];
            if (item) {
                item.metalType = metalType;
                this.updatePurities(metalType, itemId);
            }
        } else {
            const item = this.newItems[itemId];
            if (item) {
                item.metalType = metalType;
                this.updatePurities(metalType, itemId);
            }
        }
        
        this.updateExchangeSummary();
    }

    handleItemInput(itemId, field, value, isOldItem) {
        if (isOldItem) {
            const item = this.oldItems[itemId];
            if (item) {
                if (['weight', 'wastageDeduction', 'meltingCharges'].includes(field)) {
                    item[field] = parseFloat(value) || 0;
                } else {
                    item[field] = value;
                }
                this.updateExchangeSummary();
            }
        } else {
            const item = this.newItems[itemId];
            if (item) {
                if (['weight', 'makingCharges', 'makingChargesDiscount', 'quantity', 'grossWeight', 'lessWeight', 'rate'].includes(field)) {
                    item[field] = parseFloat(value) || 0;
                } else {
                    item[field] = value;
                }
                this.updateExchangeSummary();
            }
        }
    }

    handleWeightUpdate(itemId, element, field) {
        const item = this.newItems[itemId];
        if (!item) return;
        
        const value = parseFloat(element.value) || 0;
        item[field] = value;
        
        const grossWeight = item.grossWeight || 0;
        const lessWeight = item.lessWeight || 0;
        const netWeight = grossWeight - lessWeight;
        
        item.weight = Math.max(0, netWeight);
        
        const netWeightInput = document.querySelector(`#${itemId} .net-weight`);
        if (netWeightInput) {
            netWeightInput.value = netWeight.toFixed(3);
        }
        
        this.updateExchangeSummary();
    }

    removeItem(itemId, isOldItem) {
        if (isOldItem) {
            delete this.oldItems[itemId];
        } else {
            delete this.newItems[itemId];
        }
        
        const element = document.getElementById(itemId);
        if (element) element.remove();
        
        this.updateExchangeSummary();
    }

    async calculateItemValue() {
        const metalType = document.getElementById('calcOldMetal').value;
        const purity = document.getElementById('calcOldPurity').value;
        const weight = parseFloat(document.getElementById('calcOldWeight').value) || 0;
        const wastage = parseFloat(document.getElementById('calcWastage').value) || 0;
        const melting = parseFloat(document.getElementById('calcMelting').value) || 0;

        if (!metalType || !purity || weight <= 0) {
            showAlert('warning', 'Please fill all required fields');
            return;
        }

        const rate = this.rates[metalType];
        if (!rate) {
            showAlert('danger', 'Rate not found for selected metal');
            return;
        }

        let metalValue = 0;
        if (rate.unit === 'kg') {
            metalValue = (rate.rate / 1000) * weight;
        } else if (rate.unit === 'carat') {
            metalValue = rate.rate * weight;
        } else {
            metalValue = rate.rate * weight;
        }

        if (metalType === 'Gold') {
            if (purity === '22K') metalValue = metalValue * 0.9167;
            else if (purity === '18K') metalValue = metalValue * 0.75;
            else if (purity === '14K') metalValue = metalValue * 0.5833;
        }

        const afterShopDeduction = metalValue * 0.97;
        const afterWastage = afterShopDeduction * ((100 - wastage) / 100);
        const netValue = Math.max(0, afterWastage - melting);

        document.getElementById('calcMetalValue').textContent = `₹${metalValue.toFixed(2)}`;
        document.getElementById('calcAfterShopDeduction').textContent = `₹${afterShopDeduction.toFixed(2)}`;
        document.getElementById('calcAfterWastage').textContent = `₹${afterWastage.toFixed(2)}`;
        document.getElementById('calcAfterMelting').textContent = `₹${netValue.toFixed(2)}`;
        document.getElementById('calcNetValue').textContent = `₹${netValue.toFixed(2)}`;

        this.addToOldItems(metalType, purity, weight, wastage, melting, netValue);
    }

    addToOldItems(metalType, purity, weight, wastage, melting, netValue) {
        const container = document.getElementById('oldItemsContainer');
        const itemId = `calc-item-${Date.now()}`;
        
        const row = document.createElement('div');
        row.className = 'item-row old-item';
        row.id = itemId;
        
        row.innerHTML = `
            <div data-label="Description">
                <input type="text" class="form-control item-description" value="Calculated ${metalType} Item" readonly>
            </div>
            
            <div data-label="Metal Type">
                <select class="form-control exchange-metal-type" disabled>
                    <option value="${metalType}" selected>${metalType}</option>
                </select>
            </div>
            
            <div data-label="Purity">
                <select class="form-control exchange-purity" disabled>
                    <option value="${purity}" selected>${purity}</option>
                </select>
            </div>
            
            <div data-label="Weight">
                <input type="number" class="form-control weight" value="${weight}" readonly>
            </div>
            
            <div data-label="Wastage %">
                <input type="number" class="form-control wastage" value="${wastage}" readonly>
            </div>
            
            <div data-label="Melting Charges">
                <input type="number" class="form-control melting" value="${melting}" readonly>
            </div>
            
            <div class="item-value">₹${netValue.toFixed(2)}</div>
            
            <div>
                <button class="btn btn-danger btn-sm" onclick="exchangeSystem.removeItem('${itemId}', true)">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        this.oldItems[itemId] = {
            id: itemId,
            description: `Calculated ${metalType} Item`,
            metalType: metalType,
            purity: purity,
            weight: weight,
            wastageDeduction: wastage,
            meltingCharges: melting
        };
        
        container.appendChild(row);
        this.updateExchangeSummary();
    }

    updateExchangeSummary() {
        let oldItemsTotal = 0;
        const oldItemsArray = [];
        
        Object.values(this.oldItems).forEach(item => {
            if (item.metalType && item.weight > 0) {
                const rate = this.rates[item.metalType];
                if (rate) {
                    let value = 0;
                    if (rate.unit === 'kg') {
                        value = (rate.rate / 1000) * item.weight;
                    } else if (rate.unit === 'carat') {
                        value = rate.rate * item.weight;
                    } else {
                        value = rate.rate * item.weight;
                    }
                    
                    if (item.metalType === 'Gold') {
                        if (item.purity === '22K') value = value * 0.9167;
                        else if (item.purity === '18K') value = value * 0.75;
                        else if (item.purity === '14K') value = value * 0.5833;
                    }
                    
                    value = value * 0.97;
                    value = value * ((100 - (item.wastageDeduction || 0)) / 100);
                    value = Math.max(0, value - (item.meltingCharges || 0));
                    
                    oldItemsTotal += value;
                    oldItemsArray.push({
                        ...item,
                        calculatedValue: value
                    });
                }
            }
        });
        
        let newItemsTotal = 0;
        const newItemsArray = [];
        
        Object.values(this.newItems).forEach(item => {
            if (item.metalType && item.weight > 0) {
                const rate = this.rates[item.metalType];
                if (rate) {
                    let itemValue = 0;
                    if (rate.unit === 'kg') {
                        itemValue = (rate.rate / 1000) * item.weight;
                    } else if (rate.unit === 'carat') {
                        itemValue = rate.rate * item.weight;
                    } else {
                        itemValue = (rate.rate || 0) * item.weight;
                    }
                    
                    if (item.metalType === 'Gold') {
                        if (item.purity === '22K') itemValue = itemValue * 0.9167;
                        else if (item.purity === '18K') itemValue = itemValue * 0.75;
                        else if (item.purity === '14K') itemValue = itemValue * 0.5833;
                    }
                    
                    let makingAmount = 0;
                    if (item.makingChargesType === 'percentage') {
                        makingAmount = (itemValue * (item.makingCharges || 0)) / 100;
                    } else if (item.makingChargesType === 'GRM') {
                        makingAmount = (item.makingCharges || 0) * item.weight;
                    } else {
                        makingAmount = item.makingCharges || 0;
                    }
                    
                    if (item.makingChargesDiscount && item.makingChargesDiscount > 0) {
                        makingAmount = makingAmount - (makingAmount * item.makingChargesDiscount / 100);
                    }
                    
                    newItemsTotal += itemValue + makingAmount;
                    newItemsArray.push({
                        ...item,
                        calculatedValue: itemValue + makingAmount
                    });
                }
            }
        });
        
        const balance = oldItemsTotal - newItemsTotal;
        
        document.getElementById('oldItemsTotal').textContent = `₹${oldItemsTotal.toFixed(2)}`;
        document.getElementById('newItemsTotal').textContent = `₹${newItemsTotal.toFixed(2)}`;
        
        if (balance >= 0) {
            document.getElementById('balanceRefundable').textContent = `₹${balance.toFixed(2)}`;
            document.getElementById('balancePayable').textContent = '₹0.00';
        } else {
            document.getElementById('balancePayable').textContent = `₹${Math.abs(balance).toFixed(2)}`;
            document.getElementById('balanceRefundable').textContent = '₹0.00';
        }
        
        const proceedBtn = document.getElementById('proceedToBillingBtn');
        const printBtn = document.getElementById('printExchangeBtn');
        const hasOldItems = Object.keys(this.oldItems).length > 0;
        const hasNewItems = Object.keys(this.newItems).length > 0;
        proceedBtn.disabled = !(hasOldItems && hasNewItems);
        printBtn.disabled = !(hasOldItems && hasNewItems);
        
        this.exchangeData = {
            oldItems: oldItemsArray,
            newItems: newItemsArray,
            oldItemsTotal,
            newItemsTotal,
            balance,
            balancePayable: balance < 0 ? Math.abs(balance) : 0,
            balanceRefundable: balance >= 0 ? balance : 0,
            timestamp: Date.now(),
            exchangeNumber: 'EXC-' + Date.now().toString().slice(-8)
        };
    }

    calculateExchange() {
        this.updateExchangeSummary();
        showAlert('success', 'Exchange calculated successfully');
    }

    previewExchangeBill() {
        if (!this.exchangeData || !this.exchangeData.oldItems || this.exchangeData.oldItems.length === 0) {
            showAlert('warning', 'Please add at least one old item and one new item before printing');
            return;
        }

        const previewContent = document.getElementById('exchangePreviewContent');
        if (!previewContent) return;

        const exchangeNumber = this.exchangeData.exchangeNumber;
        const date = new Date().toLocaleDateString('en-IN');
        const time = new Date().toLocaleTimeString('en-IN');
        
        let oldItemsHtml = '';
        this.exchangeData.oldItems.forEach((item, index) => {
            oldItemsHtml += `
                <tr>
                    <td>${index + 1}</td>
                    <td>${item.description || item.metalType + ' Item'}</td>
                    <td>${item.metalType}</td>
                    <td>${item.purity || 'N/A'}</td>
                    <td>${item.weight.toFixed(3)} ${this.rates[item.metalType]?.unit === 'carat' ? 'ct' : 'g'}</td>
                    <td>${item.wastageDeduction || 0}%</td>
                    <td>₹${item.meltingCharges || 0}</td>
                    <td>₹${item.calculatedValue?.toFixed(2) || '0.00'}</td>
                </tr>
            `;
        });

        let newItemsHtml = '';
        this.exchangeData.newItems.forEach((item, index) => {
            newItemsHtml += `
                <tr>
                    <td>${index + 1}</td>
                    <td>${item.description || 'New Item'}</td>
                    <td>${item.metalType}</td>
                    <td>${item.purity || 'N/A'}</td>
                    <td>${item.weight.toFixed(3)} ${this.rates[item.metalType]?.unit === 'carat' ? 'ct' : 'g'}</td>
                    <td>₹${(item.rate || 0).toFixed(2)}</td>
                    <td>${item.makingChargesType === 'percentage' ? item.makingCharges + '%' : '₹' + item.makingCharges}</td>
                    <td>₹${item.calculatedValue?.toFixed(2) || '0.00'}</td>
                </tr>
            `;
        });

        previewContent.innerHTML = `
            <div class="invoice-preview">
                <div class="shop-header">
                    <h2>Shri Mahakaleshwar Jewellers</h2>
                    <p>Anisabad, Patna, Bihar - 800002</p>
                    <p>Mobile: +91 9876543210 | GSTIN: 10ABCDE1234F1Z5</p>
                </div>
                
                <div class="invoice-info">
                    <div class="customer-details">
                        <h4><i class="fas fa-exchange-alt"></i> Exchange Summary</h4>
                        <p><strong>Exchange No:</strong> ${exchangeNumber}</p>
                        <p><strong>Date:</strong> ${date}</p>
                        <p><strong>Time:</strong> ${time}</p>
                    </div>
                    
                    <div class="invoice-meta">
                        <h4><i class="fas fa-info-circle"></i> Exchange Details</h4>
                        <p><strong>Old Items:</strong> ${this.exchangeData.oldItems.length}</p>
                        <p><strong>New Items:</strong> ${this.exchangeData.newItems.length}</p>
                        <p><strong>Status:</strong> Calculated</p>
                    </div>
                </div>
                
                <h4><i class="fas fa-box-open"></i> Old Items for Exchange (3% deduction applied)</h4>
                <table class="items-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Description</th>
                            <th>Metal</th>
                            <th>Purity</th>
                            <th>Weight</th>
                            <th>Wastage</th>
                            <th>Melting Charges</th>
                            <th>Value (₹)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${oldItemsHtml}
                    </tbody>
                </table>
                
                <h4><i class="fas fa-gem"></i> New Items for Purchase</h4>
                <table class="items-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Description</th>
                            <th>Metal</th>
                            <th>Purity</th>
                            <th>Net Weight</th>
                            <th>Rate</th>
                            <th>Making Charges</th>
                            <th>Value (₹)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${newItemsHtml}
                    </tbody>
                </table>
                
                <div class="qr-section">
                    <h4><i class="fas fa-qrcode"></i> Exchange Summary QR Code</h4>
                    <div class="qr-code" id="exchangeQRCode"></div>
                    <p>Scan QR code for exchange details</p>
                </div>
                
                <table class="totals-table">
                    <tr>
                        <td><strong>Old Items Total:</strong></td>
                        <td><strong>₹${this.exchangeData.oldItemsTotal.toFixed(2)}</strong></td>
                    </tr>
                    <tr>
                        <td><strong>New Items Total:</strong></td>
                        <td><strong>₹${this.exchangeData.newItemsTotal.toFixed(2)}</strong></td>
                    </tr>
                    <tr>
                        <td><strong>${this.exchangeData.balance >= 0 ? 'Balance Refundable:' : 'Balance Payable:'}</strong></td>
                        <td><strong>₹${Math.abs(this.exchangeData.balance).toFixed(2)}</strong></td>
                    </tr>
                </table>
                
                <div class="terms-conditions">
                    <h5><i class="fas fa-file-contract"></i> Exchange Terms & Conditions</h5>
                    <ol>
                        <li>This is an exchange calculation summary only, not a final bill.</li>
                        <li>3% shop policy deduction has been applied on all old items.</li>
                        <li>Final bill will include GST and other applicable charges.</li>
                        <li>Exchange value is based on current metal rates at time of calculation.</li>
                        <li>Making charges are non-refundable on new items.</li>
                        <li>All disputes subject to Patna jurisdiction only.</li>
                    </ol>
                </div>
            </div>
        `;

        // Generate QR code
        const qrData = {
            shop: 'Shri Mahakaleshwar Jewellers',
            exchangeNumber: exchangeNumber,
            date: date,
            time: time,
            oldItemsTotal: this.exchangeData.oldItemsTotal,
            newItemsTotal: this.exchangeData.newItemsTotal,
            balance: this.exchangeData.balance,
            status: 'Exchange Calculation',
            address: 'Anisabad, Patna, Bihar'
        };

        try {
            // Clear previous QR code
            const qrContainer = document.getElementById('exchangeQRCode');
            qrContainer.innerHTML = '';
            
            // Generate new QR code
            QRCode.toCanvas(qrContainer, JSON.stringify(qrData), {
                width: 150,
                height: 150,
                margin: 1,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                }
            }, function (error) {
                if (error) {
                    console.error('QR Code generation error:', error);
                    qrContainer.innerHTML = '<p>QR Code generation failed</p>';
                }
            });
        } catch (error) {
            console.error('QR Code error:', error);
        }

        showExchangePreview();
    }

    printExchangeBill() {
        if (!this.exchangeData) {
            showAlert('warning', 'No exchange data to print');
            return;
        }

        const exchangeNumber = this.exchangeData.exchangeNumber;
        const date = new Date().toLocaleDateString('en-IN');
        const time = new Date().toLocaleTimeString('en-IN');
        
        // Create print container
        let printContainer = document.getElementById('printContainer');
        if (!printContainer) {
            printContainer = document.createElement('div');
            printContainer.id = 'printContainer';
            printContainer.className = 'print-container';
            document.body.appendChild(printContainer);
        }

        let oldItemsHtml = '';
        this.exchangeData.oldItems.forEach((item, index) => {
            oldItemsHtml += `
                <tr>
                    <td>${index + 1}</td>
                    <td>${item.description || item.metalType + ' Item'}</td>
                    <td>${item.metalType}</td>
                    <td>${item.purity || 'N/A'}</td>
                    <td>${item.weight.toFixed(3)} ${this.rates[item.metalType]?.unit === 'carat' ? 'ct' : 'g'}</td>
                    <td>${item.wastageDeduction || 0}%</td>
                    <td>₹${item.meltingCharges || 0}</td>
                    <td>₹${item.calculatedValue?.toFixed(2) || '0.00'}</td>
                </tr>
            `;
        });

        let newItemsHtml = '';
        this.exchangeData.newItems.forEach((item, index) => {
            newItemsHtml += `
                <tr>
                    <td>${index + 1}</td>
                    <td>${item.description || 'New Item'}</td>
                    <td>${item.metalType}</td>
                    <td>${item.purity || 'N/A'}</td>
                    <td>${item.weight.toFixed(3)} ${this.rates[item.metalType]?.unit === 'carat' ? 'ct' : 'g'}</td>
                    <td>₹${(item.rate || 0).toFixed(2)}</td>
                    <td>${item.makingChargesType === 'percentage' ? item.makingCharges + '%' : '₹' + item.makingCharges}</td>
                    <td>₹${item.calculatedValue?.toFixed(2) || '0.00'}</td>
                </tr>
            `;
        });

        const printHTML = `
            <div class="invoice-container">
                <div class="shop-name">Shri Mahakaleshwar Jewellers</div>
                <div class="shop-address">Anisabad, Patna, Bihar - 800002</div>
                <div class="shop-contact">Mobile: +91 9876543210 | GSTIN: 10ABCDE1234F1Z5</div>
                
                <div class="bill-info">
                    <div>
                        <div class="bill-number"><strong>Exchange No:</strong> ${exchangeNumber}</div>
                        <div class="bill-date"><strong>Date:</strong> ${date}</div>
                        <div class="bill-time"><strong>Time:</strong> ${time}</div>
                    </div>
                    <div>
                        <div><strong>Type:</strong> Jewellery Exchange Calculation</div>
                        <div><strong>Status:</strong> Calculated (Not Final)</div>
                        <div><strong>Shop Policy:</strong> 3% deduction on old items</div>
                    </div>
                </div>
                
                <h3 style="color: #D4AF37; border-bottom: 2px solid #D4AF37; padding-bottom: 5px;">
                    <i class="fas fa-exchange-alt"></i> EXCHANGE CALCULATION SUMMARY
                </h3>
                
                <h4 style="margin: 15mm 0 5mm 0; color: #ff9900;">Old Items for Exchange (3% deduction applied)</h4>
                <table class="items-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Description</th>
                            <th>Metal</th>
                            <th>Purity</th>
                            <th>Weight</th>
                            <th>Wastage</th>
                            <th>Melting</th>
                            <th>Value (₹)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${oldItemsHtml}
                    </tbody>
                </table>
                
                <h4 style="margin: 15mm 0 5mm 0; color: #28a745;">New Items for Purchase</h4>
                <table class="items-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Description</th>
                            <th>Metal</th>
                            <th>Purity</th>
                            <th>Net Weight</th>
                            <th>Rate</th>
                            <th>Making</th>
                            <th>Value (₹)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${newItemsHtml}
                    </tbody>
                </table>
                
                <div class="calculations">
                    <div class="calc-row">
                        <span>Total Old Items Value (After 3% deduction):</span>
                        <span>₹${this.exchangeData.oldItemsTotal.toFixed(2)}</span>
                    </div>
                    <div class="calc-row">
                        <span>Total New Items Value:</span>
                        <span>₹${this.exchangeData.newItemsTotal.toFixed(2)}</span>
                    </div>
                    <div class="calc-row total">
                        <span>${this.exchangeData.balance >= 0 ? 'Balance Refundable:' : 'Balance Payable:'}</span>
                        <span>₹${Math.abs(this.exchangeData.balance).toFixed(2)}</span>
                    </div>
                </div>
                
                <div class="qr-codes">
                    <div class="qr-box">
                        <h4>Exchange QR Code</h4>
                        <div id="printQRCode" style="width: 150px; height: 150px; margin: 0 auto;"></div>
                        <p>Scan for exchange details</p>
                    </div>
                </div>
                
                <div class="amount-words">
                    <p><strong>Note:</strong> This is an exchange calculation summary. Final bill will be generated in billing section with GST and all applicable charges.</p>
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
                        <p><strong>Exchange Terms & Conditions:</strong></p>
                        <p>1. This is an exchange calculation summary only, not a final bill.</p>
                        <p>2. 3% shop policy deduction applied on all old items.</p>
                        <p>3. Final bill will include GST and other applicable charges.</p>
                        <p>4. Exchange value based on current metal rates at time of calculation.</p>
                        <p>5. Making charges are non-refundable on new items.</p>
                        <p>6. Goods once exchanged will not be taken back.</p>
                        <p>7. All disputes subject to Patna jurisdiction only.</p>
                        <p style="text-align: center; margin-top: 10mm; font-weight: bold;">
                            Thank you for visiting Shri Mahakaleshwar Jewellers
                        </p>
                    </div>
                </div>
            </div>
        `;

        printContainer.innerHTML = printHTML;
        
        // Generate QR code for print
        const qrData = {
            shop: 'Shri Mahakaleshwar Jewellers',
            exchangeNumber: exchangeNumber,
            date: date,
            oldItemsTotal: this.exchangeData.oldItemsTotal,
            newItemsTotal: this.exchangeData.newItemsTotal,
            balance: this.exchangeData.balance,
            type: 'Exchange Calculation',
            address: 'Anisabad, Patna, Bihar'
        };

        // Show print container
        printContainer.style.display = 'block';
        
        // Generate QR code after DOM is ready
        setTimeout(() => {
            const qrContainer = document.getElementById('printQRCode');
            if (qrContainer) {
                qrContainer.innerHTML = '';
                
                QRCode.toCanvas(qrContainer, JSON.stringify(qrData), {
                    width: 150,
                    height: 150,
                    margin: 1,
                    color: {
                        dark: '#000000',
                        light: '#FFFFFF'
                    }
                }, function (error) {
                    if (error) {
                        console.error('Print QR Code error:', error);
                        qrContainer.innerHTML = '<p>QR Code</p>';
                    } else {
                        // Print after QR code is generated
                        setTimeout(() => {
                            window.print();
                            setTimeout(() => {
                                printContainer.style.display = 'none';
                                printContainer.innerHTML = '';
                            }, 1000);
                        }, 500);
                    }
                });
            } else {
                // If QR fails, still print
                setTimeout(() => {
                    window.print();
                    setTimeout(() => {
                        printContainer.style.display = 'none';
                        printContainer.innerHTML = '';
                    }, 1000);
                }, 500);
            }
        }, 100);
    }

    proceedToBilling() {
        const oldItems = Object.values(this.oldItems).map(item => ({
            description: item.description || 'Old Item Exchange',
            metalType: item.metalType,
            purity: item.purity,
            weight: item.weight,
            wastageDeduction: item.wastageDeduction || 0,
            meltingCharges: item.meltingCharges || 0
        }));
        
        const newItems = Object.values(this.newItems).map(item => ({
            description: item.description || '',
            metalType: item.metalType,
            purity: item.purity,
            unit: item.unit || 'GM',
            quantity: item.quantity || 1,
            grossWeight: item.grossWeight || 0,
            lessWeight: item.lessWeight || 0,
            weight: item.weight,
            rate: item.rate || 0,
            makingChargesType: item.makingChargesType || 'percentage',
            makingCharges: item.makingCharges || 0,
            makingChargesDiscount: item.makingChargesDiscount || 0,
            huid: item.huid || '',
            tunch: item.tunch || ''
        }));
        
        if (oldItems.length === 0 || newItems.length === 0) {
            showAlert('warning', 'Please add at least one old item and one new item');
            return;
        }
        
        const invalidItems = newItems.filter(item => !item.metalType || !item.weight || item.weight <= 0);
        if (invalidItems.length > 0) {
            showAlert('warning', 'Please complete all required fields for new items (Metal, Weight)');
            return;
        }
        
        localStorage.setItem('exchangeData', JSON.stringify({
            oldItems,
            newItems,
            timestamp: Date.now(),
            oldItemsTotal: parseFloat(document.getElementById('oldItemsTotal').textContent.replace('₹', '')),
            newItemsTotal: parseFloat(document.getElementById('newItemsTotal').textContent.replace('₹', ''))
        }));
        
        window.location.href = 'billing.html?exchange=true';
    }

    resetExchange() {
        if (confirm('Are you sure you want to reset the exchange form? All data will be lost.')) {
            this.oldItems = {};
            this.newItems = {};
            this.exchangeData = null;
            
            document.getElementById('oldItemsContainer').innerHTML = '';
            document.getElementById('newItemsContainer').innerHTML = '';
            
            document.getElementById('calcOldWeight').value = '';
            document.getElementById('calcMetalValue').textContent = '₹0.00';
            document.getElementById('calcAfterShopDeduction').textContent = '₹0.00';
            document.getElementById('calcAfterWastage').textContent = '₹0.00';
            document.getElementById('calcAfterMelting').textContent = '₹0.00';
            document.getElementById('calcNetValue').textContent = '₹0.00';
            
            document.getElementById('oldItemsTotal').textContent = '₹0.00';
            document.getElementById('newItemsTotal').textContent = '₹0.00';
            document.getElementById('balanceRefundable').textContent = '₹0.00';
            document.getElementById('balancePayable').textContent = '₹0.00';
            
            document.getElementById('proceedToBillingBtn').disabled = true;
            document.getElementById('printExchangeBtn').disabled = true;
            
            showAlert('info', 'Exchange form reset successfully');
        }
    }
}

// Initialize exchange system
document.addEventListener('DOMContentLoaded', () => {
    if (window.auth && window.auth.isAuthenticated && window.auth.isAuthenticated()) {
        if (window.auth.isStaff && window.auth.isStaff()) {
            window.exchangeSystem = new ExchangeSystem();
        } else {
            window.location.href = 'login.html';
        }
    } else {
        window.location.href = 'login.html';
    }
});
