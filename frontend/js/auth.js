// Authentication module

class Auth {
    constructor() {
        this.token = localStorage.getItem('token');
        this.user = JSON.parse(localStorage.getItem('user') || 'null');
        this.apiBase = 'http://localhost:5000/api';
    }

    async login(email, password) {
        try {
            const response = await fetch(`${this.apiBase}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (data.success) {
                this.token = data.token;
                this.user = data.user;
                
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                
                return { success: true, user: data.user };
            } else {
                return { success: false, message: data.message };
            }
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, message: 'Network error. Please try again.' };
        }
    }

    async register(userData) {
        try {
            const response = await fetch(`${this.apiBase}/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(userData)
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Registration error:', error);
            return { success: false, message: 'Network error. Please try again.' };
        }
    }

    logout() {
        this.token = null;
        this.user = null;
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'login.html';
    }

    isAuthenticated() {
        return !!this.token;
    }

    isAdmin() {
        return this.user && this.user.role === 'admin';
    }

    isStaff() {
        return this.user && (this.user.role === 'staff' || this.user.role === 'admin');
    }

    getToken() {
        return this.token;
    }

    getUser() {
        return this.user;
    }

    async updateProfile(profileData) {
        try {
            const response = await fetch(`${this.apiBase}/auth/profile`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify(profileData)
            });

            const data = await response.json();
            
            if (data.success) {
                this.user = data.user;
                localStorage.setItem('user', JSON.stringify(data.user));
            }
            
            return data;
        } catch (error) {
            console.error('Update profile error:', error);
            return { success: false, message: 'Network error' };
        }
    }

    async changePassword(currentPassword, newPassword) {
        try {
            const response = await fetch(`${this.apiBase}/auth/change-password`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ currentPassword, newPassword })
            });

            return await response.json();
        } catch (error) {
            console.error('Change password error:', error);
            return { success: false, message: 'Network error' };
        }
    }
}

// Initialize auth instance
const auth = new Auth();

// DOM ready function for login page
if (document.getElementById('loginForm')) {
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        
        const loginBtn = document.getElementById('loginBtn');
        const originalText = loginBtn.innerHTML;
        loginBtn.innerHTML = '<span class="spinner"></span> Logging in...';
        loginBtn.disabled = true;
        
        const result = await auth.login(email, password);
        
        if (result.success) {
            showAlert('success', 'Login successful! Redirecting...');
            
            // Redirect based on role
            setTimeout(() => {
                if (result.user.role === 'admin') {
                    window.location.href = 'admin.html';
                } else {
                    window.location.href = 'billing.html';
                }
            }, 1000);
        } else {
            showAlert('danger', result.message);
            loginBtn.innerHTML = originalText;
            loginBtn.disabled = false;
        }
    });
}

// Utility functions
function showAlert(type, message) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="close" onclick="this.parentElement.remove()">&times;</button>
    `;
    
    const container = document.querySelector('.auth-box') || document.querySelector('.main-container');
    container.insertBefore(alertDiv, container.firstChild);
    
    setTimeout(() => alertDiv.remove(), 5000);
}

// Check authentication on page load
document.addEventListener('DOMContentLoaded', () => {
    const publicPages = ['login.html', 'index.html'];
    const currentPage = window.location.pathname.split('/').pop();
    
    // Redirect to login if not authenticated
    if (!publicPages.includes(currentPage) && !auth.isAuthenticated()) {
        window.location.href = 'login.html';
        return;
    }
    
    // Redirect away from login if already authenticated
    if (currentPage === 'login.html' && auth.isAuthenticated()) {
        if (auth.isAdmin()) {
            window.location.href = 'admin.html';
        } else {
            window.location.href = 'billing.html';
        }
        return;
    }
    
    // Show user info in navbar
    if (auth.isAuthenticated()) {
        const userInfoElements = document.querySelectorAll('.user-info');
        userInfoElements.forEach(element => {
            const user = auth.getUser();
            element.innerHTML = `
                <div class="user-avatar">${user.name.charAt(0)}</div>
                <div>
                    <div class="user-name">${user.name}</div>
                    <div class="user-role">${user.role}</div>
                </div>
                <button class="btn btn-outline btn-sm" onclick="auth.logout()">Logout</button>
            `;
        });
    }
    
    // Show/hide elements based on role
    if (auth.isAuthenticated()) {
        // Hide admin links from non-admin users
        if (!auth.isAdmin()) {
            const adminLinks = document.querySelectorAll('[data-role="admin"]');
            adminLinks.forEach(link => link.style.display = 'none');
        }
        
        // Hide staff links from viewers
        if (auth.getUser().role === 'viewer') {
            const staffLinks = document.querySelectorAll('[data-role="staff"]');
            staffLinks.forEach(link => link.style.display = 'none');
        }
    }
});

// Make auth available globally
window.auth = auth;
