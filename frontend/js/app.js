// Main Application JavaScript
document.addEventListener('DOMContentLoaded', async () => {
    if (!authManager.checkAuth()) return;
    
    // Initialize dashboard
    initializeDashboard();
    
    // Load current rates
    await loadCurrentRates();
    
    // Load dashboard stats
    await loadDashboardStats();
    
    // Load recent bills
    await loadRecentBills();
    
    // Update date time
    updateDateTime();
    setInterval(updateDateTime, 60000);
});

// Initialize dashboard
function initializeDashboard() {
    console.log('Dashboard initialized for Shri Mahakaleshwar Jewellers');
}

// Load current rates
async function loadCurrentRates() {
    try {
        const response = await fetch(`${authManager.apiBase}/rates/current`, {
            headers: authManager.getAuthHeaders()
        });
        
        const data = await response.json();
        
        if (data.success && data.rates) {
            displayRates(data.rates);
        }
    } catch (error) {
        console.error('Error loading rates:', error);
    }
}

// Display rates in sidebar
function displayRates(rates) {
    const ratesContainer = document.getElementById('currentRates');
    if (!ratesContainer) return;
    
    ratesContainer.innerHTML = `
        <div class="rate-item">
            <span class="rate-label">Gold 24K:</span>
            <span class="rate-value">₹${(rates.gold24K / 100000).toFixed(2)}/g</span>
        </div>
        <div class="rate-item">
            <span class="rate-label">Gold 22K:</span>
            <span class="rate-value">₹${(rates.gold22K / 100000).toFixed(2)}/g</span>
        </div>
        <div class="rate-item">
            <span class="rate-label">Gold 18K:</span>
            <span class="rate-value">₹${(rates.gold18K / 100000).toFixed(2)}/g</span>
        </div>
        <div class="rate-item">
            <span class="rate-label">Silver 999:</span>
            <span class="rate-value">₹${(rates.silver999 / 1000).toFixed(2)}/g</span>
        </div>
        <div class="rate-item">
            <span class="rate-label">Silver 925:</span>
            <span class="rate-value">₹${(rates.silver925 / 1000).toFixed(2)}/g</span>
        </div>
        <div class="rate-item">
            <span class="rate-label">Last Updated:</span>
            <span class="rate-value">${new Date(rates.lastUpdated).toLocaleDateString()}</span>
        </div>
    `;
}

// Load dashboard statistics
async function loadDashboardStats() {
    try {
        const today = new Date().toISOString().split('T')[0];
        const response = await fetch(`${authManager.apiBase}/reports/daily?date=${today}`, {
            headers: authManager.getAuthHeaders()
        });
        
        const data = await response.json();
        
        if (data.success && data.summary) {
            updateStatsDisplay(data.summary);
        }
    } catch (error) {
        console.error('Error loading dashboard stats:', error);
    }
}

// Update stats display
function updateStatsDisplay(summary) {
    const todaySales = document.getElementById('todaySales');
    const todayBills = document.getElementById('todayBills');
    const todayCustomers = document.getElementById('todayCustomers');
    const pendingBills = document.getElementById('pendingBills');
    
    if (todaySales) {
        todaySales.textContent = `₹${summary.totalSales.toLocaleString('en-IN')}`;
    }
    
    if (todayBills) {
        todayBills.textContent = summary.totalBills;
    }
    
    if (todayCustomers) {
        todayCustomers.textContent = summary.totalBills; // Simplified - would need actual customer count
    }
    
    if (pendingBills) {
        pendingBills.textContent = `₹${summary.totalDue.toLocaleString('en-IN')}`;
    }
}

// Load recent bills
async function loadRecentBills() {
    try {
        const response = await fetch(`${authManager.apiBase}/bills?page=1&limit=10`, {
            headers: authManager.getAuthHeaders()
        });
        
        const data = await response.json();
        
        if (data.success && data.bills) {
            displayRecentBills(data.bills);
        }
    } catch (error) {
        console.error('Error loading recent bills:', error);
    }
}

// Display recent bills in table
function displayRecentBills(bills) {
    const tableBody = document.querySelector('#recentBillsTable tbody');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    bills.forEach(bill => {
        const row = document.createElement('tr');
        row.className = 'fade-in';
        
        const billTypeClass = {
            'sale': 'badge-success',
            'exchange': 'badge-warning',
            'sale_exchange': 'badge-info'
        }[bill.billType] || 'badge-secondary';
        
        const paymentStatusClass = {
            'paid': 'badge-success',
            'pending': 'badge-danger',
            'partial': 'badge-warning'
        }[bill.paymentStatus] || 'badge-secondary';
        
        row.innerHTML = `
            <td>${bill.billNumber}</td>
            <td>${bill.customerName}</td>
            <td>${new Date(bill.date).toLocaleDateString()}</td>
            <td>₹${bill.netPayable.toLocaleString('en-IN')}</td>
            <td><span class="badge ${billTypeClass}">${bill.billType}</span></td>
            <td><span class="badge ${paymentStatusClass}">${bill.paymentStatus}</span></td>
            <td>
                <button onclick="viewBill('${bill._id}')" class="btn-sm btn-view">
                    <i class="fas fa-eye"></i>
                </button>
                <button onclick="printBill('${bill._id}')" class="btn-sm btn-print">
                    <i class="fas fa-print"></i>
                </button>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
}

// View bill details
function viewBill(billId) {
    window.location.href = `billing.html?view=${billId}`;
}

// Print bill
function printBill(billId) {
    window.open(`print.html?bill=${billId}`, '_blank');
}

// Update date and time display
function updateDateTime() {
    const now = new Date();
    const dateTimeElement = document.getElementById('currentDateTime');
    
    if (dateTimeElement) {
        const options = { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        };
        dateTimeElement.textContent = now.toLocaleDateString('en-IN', options);
    }
}

// Reprint bill modal
function reprintBill() {
    const modal = document.getElementById('reprintModal');
    if (modal) {
        modal.style.display = 'block';
        document.getElementById('billNumberSearch').focus();
    }
}

// Close modal
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

// Search bill by number
async function searchBill() {
    const billNumber = document.getElementById('billNumberSearch').value.trim();
    const resultDiv = document.getElementById('billSearchResult');
    
    if (!billNumber) {
        resultDiv.innerHTML = '<p class="invalid-feedback">Please enter a bill number</p>';
        return;
    }
    
    resultDiv.innerHTML = '<div class="spinner"></div>';
    
    try {
        const response = await fetch(`${authManager.apiBase}/bills/number/${billNumber}`, {
            headers: authManager.getAuthHeaders()
        });
        
        const data = await response.json();
        
        if (data.success && data.bill) {
            resultDiv.innerHTML = `
                <div class="bill-found">
                    <h4>Bill Found</h4>
                    <p>Customer: ${data.bill.customerName}</p>
                    <p>Date: ${new Date(data.bill.date).toLocaleDateString()}</p>
                    <p>Amount: ₹${data.bill.netPayable.toLocaleString('en-IN')}</p>
                    <button onclick="printBill('${data.bill._id}')" class="btn-primary">
                        <i class="fas fa-print"></i> Print Bill
                    </button>
                </div>
            `;
        } else {
            resultDiv.innerHTML = '<p class="invalid-feedback">Bill not found</p>';
        }
    } catch (error) {
        console.error('Error searching bill:', error);
        resultDiv.innerHTML = '<p class="invalid-feedback">Error searching bill</p>';
    }
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('reprintModal');
    if (event.target === modal) {
        modal.style.display = 'none';
    }
}

// Keyboard shortcuts
document.addEventListener('keydown', function(event) {
    // Ctrl + N: New bill
    if (event.ctrlKey && event.key === 'n') {
        event.preventDefault();
        window.location.href = 'billing.html';
    }
    
    // Ctrl + R: Reports
    if (event.ctrlKey && event.key === 'r') {
        event.preventDefault();
        window.location.href = 'reports.html';
    }
    
    // Ctrl + L: Logout
    if (event.ctrlKey && event.key === 'l') {
        event.preventDefault();
        logout();
    }
    
    // Ctrl + P: Reprint
    if (event.ctrlKey && event.key === 'p') {
        event.preventDefault();
        reprintBill();
    }
});

// Export functions for global use
window.viewBill = viewBill;
window.printBill = printBill;
window.reprintBill = reprintBill;
window.closeModal = closeModal;
window.searchBill = searchBill;
