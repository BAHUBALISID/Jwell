// Admin Dashboard Module

class AdminDashboard {
    constructor() {
        this.apiBase = 'http://localhost:5000/api';
        this.token = window.auth.getToken();
        this.charts = {};
        this.init();
    }

    async init() {
        await this.loadDashboardData();
        this.setupEventListeners();
        this.initCharts();
        this.setupDateFilters();
    }

    async loadDashboardData() {
        try {
            // Load all data in parallel
            const [salesData, aiAnalysis, customerReport] = await Promise.all([
                this.fetchSalesData(),
                this.fetchAIAnalysis(),
                this.fetchCustomerReport()
            ]);

            this.updateStats(salesData);
            this.updateAIInsights(aiAnalysis);
            this.updateCustomerInsights(customerReport);
            this.updateRecentBills();
            
        } catch (error) {
            console.error('Error loading dashboard data:', error);
            showAlert('danger', 'Failed to load dashboard data');
        }
    }

    async fetchSalesData(timeFilter = 'current_month') {
        try {
            const response = await fetch(
                `${this.apiBase}/reports/sales?timeFilter=${timeFilter}`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            
            const data = await response.json();
            return data.success ? data.report : null;
        } catch (error) {
            console.error('Fetch sales data error:', error);
            return null;
        }
    }

    async fetchAIAnalysis(timeFilter = 'current_month') {
        try {
            const response = await fetch(
                `${this.apiBase}/reports/ai-analysis?timeFilter=${timeFilter}`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            
            const data = await response.json();
            return data.success ? data.analysis : null;
        } catch (error) {
            console.error('Fetch AI analysis error:', error);
            return null;
        }
    }

    async fetchCustomerReport() {
        try {
            const response = await fetch(`${this.apiBase}/reports/customer?limit=10`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            
            const data = await response.json();
            return data.success ? data : null;
        } catch (error) {
            console.error('Fetch customer report error:', error);
            return null;
        }
    }

    updateStats(salesData) {
        if (!salesData) return;
        
        // Update stat cards
        document.getElementById('totalSales').textContent = 
            `₹${salesData.summary.totalPeriodSales.toLocaleString()}`;
        
        document.getElementById('totalBills').textContent = 
            salesData.summary.totalPeriodBills.toLocaleString();
        
        document.getElementById('averageBill').textContent = 
            `₹${salesData.summary.averageDailySales.toFixed(2)}`;
        
        // Calculate growth (simplified)
        const growth = 12.5; // This would be calculated from previous period
        document.getElementById('salesGrowth').innerHTML = 
            `<span class="stat-change">+${growth}%</span> vs last month`;
        
        // Update metal distribution
        this.updateMetalDistribution(salesData.summary.metalWiseTotal);
    }

    updateMetalDistribution(metalData) {
        const container = document.getElementById('metalDistribution');
        if (!container || !metalData) return;
        
        const total = Object.values(metalData).reduce((sum, metal) => sum + metal.amount, 0);
        
        container.innerHTML = Object.entries(metalData)
            .map(([metal, data]) => {
                const percentage = total > 0 ? (data.amount / total * 100).toFixed(1) : 0;
                return `
                    <div class="metal-item">
                        <div class="metal-name">${metal}</div>
                        <div class="metal-bar">
                            <div class="metal-fill" style="width: ${percentage}%"></div>
                        </div>
                        <div class="metal-value">
                            ₹${data.amount.toLocaleString()} (${percentage}%)
                        </div>
                    </div>
                `;
            }).join('');
    }

    updateAIInsights(analysis) {
        const container = document.getElementById('aiInsights');
        if (!container || !analysis) {
            container.innerHTML = '<div class="alert alert-warning">AI insights not available</div>';
            return;
        }
        
        // Parse AI response and format for display
        const insights = this.parseAIResponse(analysis.insights || analysis);
        
        container.innerHTML = `
            <div class="insight-section">
                <h4><i class="fas fa-chart-line"></i> Executive Summary</h4>
                <p>${insights.summary || 'No summary available'}</p>
            </div>
            
            <div class="insight-section">
                <h4><i class="fas fa-gem"></i> Top Performing Metals</h4>
                <p>${insights.topMetals || 'No metal analysis available'}</p>
            </div>
            
            <div class="insight-section">
                <h4><i class="fas fa-lightbulb"></i> Recommendations</h4>
                <ul>
                    ${insights.recommendations ? insights.recommendations
                        .map(rec => `<li>${rec}</li>`).join('') : 
                        '<li>No specific recommendations at this time</li>'}
                </ul>
            </div>
            
            <div class="insight-section">
                <h4><i class="fas fa-exclamation-triangle"></i> Risk Alerts</h4>
                <p>${insights.risks || 'No risk alerts at this time'}</p>
            </div>
        `;
    }

    parseAIResponse(aiText) {
        // Simple parsing of AI response
        // In production, you might want to structure the AI response better
        const insights = {
            summary: '',
            topMetals: '',
            recommendations: [],
            risks: ''
        };
        
        if (typeof aiText === 'string') {
            // Try to extract sections
            const sections = aiText.split('\n\n');
            
            sections.forEach(section => {
                if (section.includes('EXECUTIVE SUMMARY')) {
                    insights.summary = section.replace('EXECUTIVE SUMMARY', '').trim();
                } else if (section.includes('METAL-WISE PERFORMANCE')) {
                    insights.topMetals = section.replace('METAL-WISE PERFORMANCE', '').trim();
                } else if (section.includes('RECOMMENDATIONS')) {
                    const recs = section.replace('RECOMMENDATIONS', '').trim().split('\n');
                    insights.recommendations = recs.filter(rec => rec.trim());
                } else if (section.includes('RISK ALERTS')) {
                    insights.risks = section.replace('RISK ALERTS', '').trim();
                }
            });
            
            // If parsing failed, use first 500 characters as summary
            if (!insights.summary && aiText.length > 0) {
                insights.summary = aiText.substring(0, 500) + '...';
            }
        }
        
        return insights;
    }

    updateCustomerInsights(customerReport) {
        const container = document.getElementById('customerInsights');
        if (!container || !customerReport) return;
        
        const { customers, segments } = customerReport;
        
        container.innerHTML = `
            <div class="customer-stats">
                <div class="stat-box">
                    <div class="stat-label">Premium Customers</div>
                    <div class="stat-value">${segments.premium.count}</div>
                    <div class="stat-sub">₹${segments.premium.total.toLocaleString()}</div>
                </div>
                <div class="stat-box">
                    <div class="stat-label">Regular Customers</div>
                    <div class="stat-value">${segments.regular.count}</div>
                    <div class="stat-sub">₹${segments.regular.total.toLocaleString()}</div>
                </div>
                <div class="stat-box">
                    <div class="stat-label">New Customers</div>
                    <div class="stat-value">${segments.new.count}</div>
                    <div class="stat-sub">₹${segments.new.total.toLocaleString()}</div>
                </div>
            </div>
            
            <div class="top-customers">
                <h5>Top Customers</h5>
                <table class="table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Total Purchase</th>
                            <th>Visits</th>
                            <th>Last Visit</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${customers.slice(0, 5).map(customer => `
                            <tr>
                                <td>${customer.name}</td>
                                <td>₹${customer.totalPurchase.toLocaleString()}</td>
                                <td>${customer.totalBills}</td>
                                <td>${new Date(customer.lastPurchase).toLocaleDateString()}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    async updateRecentBills() {
        try {
            const response = await fetch(`${this.apiBase}/bills?limit=10`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            
            const data = await response.json();
            
            if (data.success) {
                const container = document.getElementById('recentBills');
                container.innerHTML = `
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Bill No</th>
                                <th>Customer</th>
                                <th>Amount</th>
                                <th>Date</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.bills.map(bill => `
                                <tr>
                                    <td>
                                        <a href="#" onclick="adminDashboard.viewBill('${bill._id}')">
                                            ${bill.billNumber}
                                        </a>
                                    </td>
                                    <td>${bill.customer.name}</td>
                                    <td>₹${bill.grandTotal.toFixed(2)}</td>
                                    <td>${new Date(bill.billDate).toLocaleDateString()}</td>
                                    <td>
                                        <span class="status-badge status-${bill.paymentStatus}">
                                            ${bill.paymentStatus}
                                        </span>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `;
            }
        } catch (error) {
            console.error('Error loading recent bills:', error);
        }
    }

    initCharts() {
        // Initialize sales trend chart
        this.initSalesTrendChart();
        
        // Initialize metal distribution chart
        this.initMetalDistributionChart();
        
        // Initialize payment mode chart
        this.initPaymentModeChart();
    }

    initSalesTrendChart() {
        const ctx = document.getElementById('salesTrendChart');
        if (!ctx) return;
        
        // Sample data - in production, fetch from API
        const data = {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            datasets: [{
                label: 'Daily Sales (₹)',
                data: [125000, 189000, 95000, 210000, 175000, 285000, 165000],
                borderColor: '#D4AF37',
                backgroundColor: 'rgba(212, 175, 55, 0.1)',
                fill: true,
                tension: 0.4
            }]
        };
        
        this.charts.salesTrend = new Chart(ctx, {
            type: 'line',
            data: data,
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    title: {
                        display: true,
                        text: 'Sales Trend - Last 7 Days'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return '₹' + value.toLocaleString();
                            }
                        }
                    }
                }
            }
        });
    }

    initMetalDistributionChart() {
        const ctx = document.getElementById('metalDistributionChart');
        if (!ctx) return;
        
        const data = {
            labels: ['Gold', 'Silver', 'Diamond', 'Platinum', 'Others'],
            datasets: [{
                data: [45, 25, 20, 5, 5],
                backgroundColor: [
                    '#FFD700', // Gold
                    '#C0C0C0', // Silver
                    '#B9F2FF', // Diamond
                    '#E5E4E2', // Platinum
                    '#6C757D'  // Others
                ]
            }]
        };
        
        this.charts.metalDistribution = new Chart(ctx, {
            type: 'doughnut',
            data: data,
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                    },
                    title: {
                        display: true,
                        text: 'Sales by Metal Type'
                    }
                }
            }
        });
    }

    initPaymentModeChart() {
        const ctx = document.getElementById('paymentModeChart');
        if (!ctx) return;
        
        const data = {
            labels: ['Cash', 'Card', 'UPI', 'Bank Transfer'],
            datasets: [{
                label: 'Payment Distribution',
                data: [60, 20, 15, 5],
                backgroundColor: [
                    '#28a745', // Cash - green
                    '#007bff', // Card - blue
                    '#6f42c1', // UPI - purple
                    '#fd7e14'  // Bank - orange
                ]
            }]
        };
        
        this.charts.paymentMode = new Chart(ctx, {
            type: 'bar',
            data: data,
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: false
                    },
                    title: {
                        display: true,
                        text: 'Payment Mode Distribution'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            }
                        }
                    }
                }
            }
        });
    }

    setupEventListeners() {
        // Time filter buttons
        document.querySelectorAll('.time-filter-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const timeFilter = e.target.dataset.filter;
                
                // Update active button
                document.querySelectorAll('.time-filter-btn').forEach(b => {
                    b.classList.remove('active');
                });
                e.target.classList.add('active');
                
                // Reload data for selected period
                await this.reloadDashboardData(timeFilter);
            });
        });
        
        // Refresh button
        document.getElementById('refreshDashboardBtn').addEventListener('click', () => {
            this.refreshDashboard();
        });
        
        // Export buttons
        document.getElementById('exportSalesBtn').addEventListener('click', () => {
            this.exportSalesReport();
        });
        
        document.getElementById('exportCustomersBtn').addEventListener('click', () => {
            this.exportCustomerReport();
        });
        
        // Manage rates button
        document.getElementById('manageRatesBtn').addEventListener('click', () => {
            this.showRatesModal();
        });
        
        // Manage users button
        document.getElementById('manageUsersBtn').addEventListener('click', () => {
            this.showUsersModal();
        });
    }

    setupDateFilters() {
        // Setup date range picker for custom filter
        const startDate = document.getElementById('startDate');
        const endDate = document.getElementById('endDate');
        const applyDateFilterBtn = document.getElementById('applyDateFilter');
        
        if (startDate && endDate && applyDateFilterBtn) {
            // Set default dates (current month)
            const now = new Date();
            const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
            const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            
            startDate.value = firstDay.toISOString().split('T')[0];
            endDate.value = lastDay.toISOString().split('T')[0];
            
            applyDateFilterBtn.addEventListener('click', async () => {
                const customFilter = {
                    startDate: startDate.value,
                    endDate: endDate.value
                };
                
                await this.reloadDashboardData('custom', customFilter);
            });
        }
    }

    async reloadDashboardData(timeFilter, customFilter = null) {
        // Show loading state
        const dashboardContent = document.getElementById('dashboardContent');
        const originalContent = dashboardContent.innerHTML;
        dashboardContent.innerHTML = `
            <div class="loading-overlay">
                <div class="spinner"></div>
                <p>Loading dashboard data...</p>
            </div>
        `;
        
        try {
            let salesData, aiAnalysis;
            
            if (customFilter) {
                // Fetch data with custom date range
                const query = new URLSearchParams(customFilter).toString();
                salesData = await this.fetchSalesDataWithQuery(`?${query}`);
                aiAnalysis = await this.fetchAIAnalysisWithQuery(`?${query}`);
            } else {
                // Fetch data with time filter
                salesData = await this.fetchSalesData(timeFilter);
                aiAnalysis = await this.fetchAIAnalysis(timeFilter);
            }
            
            this.updateStats(salesData);
            this.updateAIInsights(aiAnalysis);
            
            // Update charts with new data
            this.updateCharts(salesData);
            
        } catch (error) {
            console.error('Error reloading dashboard:', error);
            showAlert('danger', 'Failed to reload dashboard data');
        } finally {
            // Restore content
            dashboardContent.innerHTML = originalContent;
        }
    }

    async fetchSalesDataWithQuery(query) {
        try {
            const response = await fetch(`${this.apiBase}/reports/sales${query}`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            
            const data = await response.json();
            return data.success ? data.report : null;
        } catch (error) {
            console.error('Fetch sales data error:', error);
            return null;
        }
    }

    async fetchAIAnalysisWithQuery(query) {
        try {
            const response = await fetch(`${this.apiBase}/reports/ai-analysis${query}`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            
            const data = await response.json();
            return data.success ? data.analysis : null;
        } catch (error) {
            console.error('Fetch AI analysis error:', error);
            return null;
        }
    }

    updateCharts(salesData) {
        if (!salesData || !salesData.dailyData) return;
        
        // Update sales trend chart
        if (this.charts.salesTrend) {
            const labels = salesData.dailyData.map(day => day.date);
            const data = salesData.dailyData.map(day => day.totalSales);
            
            this.charts.salesTrend.data.labels = labels;
            this.charts.salesTrend.data.datasets[0].data = data;
            this.charts.salesTrend.update();
        }
        
        // Update metal distribution chart
        if (this.charts.metalDistribution && salesData.summary.metalWiseTotal) {
            const metals = Object.keys(salesData.summary.metalWiseTotal);
            const amounts = metals.map(metal => salesData.summary.metalWiseTotal[metal].amount);
            
            this.charts.metalDistribution.data.labels = metals;
            this.charts.metalDistribution.data.datasets[0].data = amounts;
            this.charts.metalDistribution.update();
        }
    }

    async refreshDashboard() {
        const btn = document.getElementById('refreshDashboardBtn');
        const originalHtml = btn.innerHTML;
        
        btn.innerHTML = '<span class="spinner"></span> Refreshing...';
        btn.disabled = true;
        
        await this.loadDashboardData();
        
        btn.innerHTML = originalHtml;
        btn.disabled = false;
        
        showAlert('success', 'Dashboard refreshed successfully');
    }

    async exportSalesReport() {
        try {
            const response = await fetch(`${this.apiBase}/reports/sales?format=excel`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `sales-report-${new Date().toISOString().split('T')[0]}.xlsx`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                
                showAlert('success', 'Sales report exported successfully');
            } else {
                throw new Error('Export failed');
            }
        } catch (error) {
            console.error('Export error:', error);
            showAlert('danger', 'Failed to export sales report');
        }
    }

    async exportCustomerReport() {
        try {
            const response = await fetch(`${this.apiBase}/reports/customer?format=excel`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `customer-report-${new Date().toISOString().split('T')[0]}.xlsx`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                
                showAlert('success', 'Customer report exported successfully');
            } else {
                throw new Error('Export failed');
            }
        } catch (error) {
            console.error('Export error:', error);
            showAlert('danger', 'Failed to export customer report');
        }
    }

    async showRatesModal() {
        try {
            const response = await fetch(`${this.apiBase}/rates`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            
            const data = await response.json();
            
            if (data.success) {
                const modal = document.getElementById('ratesModal');
                const tbody = modal.querySelector('tbody');
                
                tbody.innerHTML = data.rates.map(rate => `
                    <tr>
                        <td>${rate.metalType}</td>
                        <td>
                            <input type="number" class="form-control rate-input" 
                                   value="${rate.rate}" 
                                   data-metal="${rate.metalType}"
                                   step="0.01">
                        </td>
                        <td>${rate.unit}</td>
                        <td>₹${(rate.rate / (rate.unit === 'kg' ? 1000 : 1)).toFixed(2)}/${rate.unit === 'kg' ? 'g' : rate.unit}</td>
                        <td>${rate.purityLevels.join(', ')}</td>
                        <td>
                            <button class="btn btn-primary btn-sm update-rate-btn" 
                                    data-metal="${rate.metalType}">
                                Update
                            </button>
                        </td>
                    </tr>
                `).join('');
                
                // Add event listeners to update buttons
                modal.querySelectorAll('.update-rate-btn').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        const metalType = e.target.dataset.metal;
                        const input = modal.querySelector(`.rate-input[data-metal="${metalType}"]`);
                        const newRate = parseFloat(input.value);
                        
                        if (isNaN(newRate) || newRate < 0) {
                            showAlert('danger', 'Please enter a valid rate');
                            return;
                        }
                        
                        await this.updateRate(metalType, newRate);
                    });
                });
                
                modal.classList.add('show');
            }
        } catch (error) {
            console.error('Error loading rates:', error);
            showAlert('danger', 'Failed to load rates');
        }
    }

    async updateRate(metalType, rate) {
        try {
            const response = await fetch(`${this.apiBase}/rates/${metalType}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ rate })
            });
            
            const data = await response.json();
            
            if (data.success) {
                showAlert('success', `${metalType} rate updated successfully`);
                
                // Refresh rates in billing system if it exists
                if (window.billingSystem) {
                    await window.billingSystem.loadRates();
                }
                
                if (window.exchangeSystem) {
                    await window.exchangeSystem.loadRates();
                }
            } else {
                showAlert('danger', data.message || 'Failed to update rate');
            }
        } catch (error) {
            console.error('Update rate error:', error);
            showAlert('danger', 'Failed to update rate');
        }
    }

    async showUsersModal() {
        try {
            const response = await fetch(`${this.apiBase}/auth/users`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            
            const data = await response.json();
            
            if (data.success) {
                const modal = document.getElementById('usersModal');
                const tbody = modal.querySelector('tbody');
                
                tbody.innerHTML = data.users.map(user => `
                    <tr>
                        <td>${user.name}</td>
                        <td>${user.email}</td>
                        <td>${user.role}</td>
                        <td>${user.mobile}</td>
                        <td>
                            <span class="status-badge ${user.isActive ? 'status-active' : 'status-inactive'}">
                                ${user.isActive ? 'Active' : 'Inactive'}
                            </span>
                        </td>
                        <td>
                            ${user._id !== window.auth.getUser().id ? `
                                <button class="btn btn-sm ${user.isActive ? 'btn-warning' : 'btn-success'}"
                                        onclick="adminDashboard.toggleUserStatus('${user._id}', ${!user.isActive})">
                                    ${user.isActive ? 'Deactivate' : 'Activate'}
                                </button>
                            ` : ''}
                        </td>
                    </tr>
                `).join('');
                
                modal.classList.add('show');
            }
        } catch (error) {
            console.error('Error loading users:', error);
            showAlert('danger', 'Failed to load users');
        }
    }

    async toggleUserStatus(userId, isActive) {
        if (!confirm(`Are you sure you want to ${isActive ? 'activate' : 'deactivate'} this user?`)) {
            return;
        }
        
        try {
            const response = await fetch(`${this.apiBase}/auth/users/${userId}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ isActive })
            });
            
            const data = await response.json();
            
            if (data.success) {
                showAlert('success', `User ${isActive ? 'activated' : 'deactivated'} successfully`);
                this.showUsersModal(); // Refresh the list
            } else {
                showAlert('danger', data.message || 'Failed to update user');
            }
        } catch (error) {
            console.error('Toggle user status error:', error);
            showAlert('danger', 'Failed to update user');
        }
    }

    async viewBill(billId) {
        try {
            const response = await fetch(`${this.apiBase}/bills/${billId}`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showBillDetails(data.bill);
            }
        } catch (error) {
            console.error('Error viewing bill:', error);
            showAlert('danger', 'Failed to load bill details');
        }
    }

    showBillDetails(bill) {
        const modal = document.getElementById('billDetailsModal');
        
        modal.querySelector('#billDetailNumber').textContent = bill.billNumber;
        modal.querySelector('#billDetailDate').textContent = 
            new Date(bill.billDate).toLocaleString();
        modal.querySelector('#billDetailCustomer').textContent = bill.customer.name;
        modal.querySelector('#billDetailMobile').textContent = bill.customer.mobile;
        modal.querySelector('#billDetailAddress').textContent = bill.customer.address;
        modal.querySelector('#billDetailTotal').textContent = `₹${bill.grandTotal.toFixed(2)}`;
        modal.querySelector('#billDetailPayment').textContent = 
            `${bill.paymentMode.toUpperCase()} - ${bill.paymentStatus}`;
        
        // Items list
        const itemsList = modal.querySelector('#billDetailItems');
        itemsList.innerHTML = bill.items
            .filter(item => !item.isExchangeItem)
            .map(item => `
                <tr>
                    <td>${item.description}</td>
                    <td>${item.metalType} ${item.purity}</td>
                    <td>${item.weight.toFixed(3)} ${item.metalType === 'Diamond' ? 'ct' : 'g'}</td>
                    <td>₹${item.amount.toFixed(2)}</td>
                </tr>
            `).join('');
        
        // Exchange details if any
        const exchangeSection = modal.querySelector('#billDetailExchange');
        if (bill.exchangeDetails.hasExchange) {
            exchangeSection.style.display = 'block';
            exchangeSection.querySelector('#billDetailOldItems').textContent = 
                `₹${bill.exchangeDetails.oldItemsTotal.toFixed(2)}`;
            exchangeSection.querySelector('#billDetailBalance').textContent = 
                bill.exchangeDetails.balancePayable > 0 ?
                `₹${bill.exchangeDetails.balancePayable.toFixed(2)} Payable` :
                `₹${bill.exchangeDetails.balanceRefundable.toFixed(2)} Refundable`;
        } else {
            exchangeSection.style.display = 'none';
        }
        
        modal.classList.add('show');
    }
}

// Initialize admin dashboard
document.addEventListener('DOMContentLoaded', () => {
    if (window.auth.isAuthenticated() && window.auth.isAdmin()) {
        window.adminDashboard = new AdminDashboard();
        
        // Load Chart.js library if not already loaded
        if (typeof Chart === 'undefined') {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
            script.onload = () => {
                window.adminDashboard.initCharts();
            };
            document.head.appendChild(script);
        }
        
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
