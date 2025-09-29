// کلاس مدیریت پایگاه داده
class FinanceDB {
    constructor() {
        this.dbName = 'DailyFinanceDB';
        this.version = 3;
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);
            
            request.onerror = () => {
                console.error('Database error:', request.error);
                reject(new Error(`خطا در اتصال به پایگاه داده: ${request.error}`));
            };
            
            request.onsuccess = () => {
                this.db = request.result;
                console.log('Database initialized successfully');
                resolve(this.db);
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                console.log('Database upgrade needed, old version:', event.oldVersion);
                
                if (!db.objectStoreNames.contains('transactions')) {
                    const store = db.createObjectStore('transactions', { 
                        keyPath: 'id', 
                        autoIncrement: true 
                    });
                    store.createIndex('type', 'type', { unique: false });
                    store.createIndex('date', 'date', { unique: false });
                    store.createIndex('category', 'category', { unique: false });
                    console.log('Transactions store created');
                }
                
                // مهاجرت از نسخه‌های قبلی
                if (event.oldVersion < 2) {
                    // اضافه کردن ایندکس‌های جدید در نسخه 2
                }
                
                if (event.oldVersion < 3) {
                    // تغییرات نسخه 3
                }
            };
        });
    }

    async getAllTransactions() {
        if (!this.db) throw new Error('پایگاه داده راه‌اندازی نشده است');
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['transactions'], 'readonly');
            const store = transaction.objectStore('transactions');
            const request = store.getAll();
            
            request.onerror = () => reject(new Error(`خطا در دریافت داده‌ها: ${request.error}`));
            request.onsuccess = () => resolve(request.result);
        });
    }

    async saveTransaction(transaction) {
        if (!this.db) throw new Error('پایگاه داده راه‌اندازی نشده است');
        
        // اعتبارسنجی داده‌ها
        const errors = this.validateTransaction(transaction);
        if (errors.length > 0) {
            throw new Error(errors.join(', '));
        }
        
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['transactions'], 'readwrite');
            const store = tx.objectStore('transactions');
            
            const transactionWithMeta = {
                ...transaction,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            const request = store.add(transactionWithMeta);
            
            request.onerror = () => reject(new Error(`خطا در ذخیره‌سازی: ${request.error}`));
            request.onsuccess = () => resolve(request.result);
        });
    }

    async updateTransaction(id, updates) {
        if (!this.db) throw new Error('پایگاه داده راه‌اندازی نشده است');
        
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['transactions'], 'readwrite');
            const store = tx.objectStore('transactions');
            
            const getRequest = store.get(parseInt(id));
            
            getRequest.onerror = () => reject(new Error(`خطا در دریافت داده: ${getRequest.error}`));
            getRequest.onsuccess = () => {
                const existing = getRequest.result;
                if (!existing) {
                    reject(new Error('تراکنش مورد نظر یافت نشد'));
                    return;
                }
                
                const updated = {
                    ...existing,
                    ...updates,
                    updatedAt: new Date().toISOString()
                };
                
                // اعتبارسنجی داده‌های به‌روزرسانی شده
                const errors = this.validateTransaction(updated);
                if (errors.length > 0) {
                    reject(new Error(errors.join(', ')));
                    return;
                }
                
                const putRequest = store.put(updated);
                putRequest.onerror = () => reject(new Error(`خطا در به‌روزرسانی: ${putRequest.error}`));
                putRequest.onsuccess = () => resolve(putRequest.result);
            };
        });
    }

    async deleteTransaction(id) {
        if (!this.db) throw new Error('پایگاه داده راه‌اندازی نشده است');
        
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['transactions'], 'readwrite');
            const store = tx.objectStore('transactions');
            const request = store.delete(parseInt(id));
            
            request.onerror = () => reject(new Error(`خطا در حذف: ${request.error}`));
            request.onsuccess = () => resolve(request.result);
        });
    }

    validateTransaction(transaction) {
        const errors = [];
        
        if (!transaction.name || transaction.name.trim().length === 0) {
            errors.push('عنوان تراکنش الزامی است');
        }
        
        if (!transaction.amount || transaction.amount <= 0) {
            errors.push('مبلغ باید بزرگتر از صفر باشد');
        }
        
        if (!transaction.date) {
            errors.push('تاریخ الزامی است');
        } else if (isNaN(new Date(transaction.date).getTime())) {
            errors.push('تاریخ معتبر نیست');
        } else {
            // بررسی تاریخ آینده
            const transactionDate = new Date(transaction.date);
            const today = new Date();
            today.setHours(23, 59, 59, 999);
            
            if (transactionDate > today) {
                errors.push('تاریخ تراکنش نمی‌تواند در آینده باشد');
            }
        }
        
        if (!transaction.type || !['income', 'expense'].includes(transaction.type)) {
            errors.push('نوع تراکنش معتبر نیست');
        }
        
        if (!transaction.category) {
            errors.push('دسته‌بندی الزامی است');
        }
        
        return errors;
    }
}

// کلاس مدیریت رابط کاربری
class FinanceUI {
    constructor() {
        this.transactionsContainer = document.getElementById('transactionsContainer');
        this.totalExpensesElement = document.getElementById('totalExpenses');
        this.totalIncomesElement = document.getElementById('totalIncomes');
        this.totalBalanceElement = document.getElementById('totalBalance');
        this.notification = document.getElementById('notification');
        this.currentTab = 'all';
        this.initEventDelegation();
    }

    initEventDelegation() {
        // Event delegation برای کارایی بهتر
        this.transactionsContainer.addEventListener('click', (e) => {
            const editBtn = e.target.closest('.edit-btn');
            const deleteBtn = e.target.closest('.delete-btn');
            
            if (editBtn) {
                const id = editBtn.dataset.id;
                openEditModal(id);
            }
            
            if (deleteBtn) {
                const id = deleteBtn.dataset.id;
                const name = deleteBtn.dataset.name;
                openDeleteModal(id, name);
            }
        });

        // رویدادهای تب‌ها
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.setActiveTab(tab.dataset.tab);
            });
        });
    }

    setActiveTab(tab) {
        this.currentTab = tab;
        document.querySelectorAll('.tab').forEach(t => {
            t.classList.toggle('active', t.dataset.tab === tab);
        });
        
        if (window.financeApp) {
            window.financeApp.updateUI();
        }
    }

    renderTransactions(transactions) {
        // پاک کردن ایمن محتوا
        this.transactionsContainer.innerHTML = '';
        
        const filteredTransactions = this.filterTransactions(transactions);
        
        if (filteredTransactions.length === 0) {
            this.renderEmptyState();
            return;
        }
        
        const sortedTransactions = this.sortTransactions(filteredTransactions);
        
        sortedTransactions.forEach(transaction => {
            const element = this.createTransactionElement(transaction);
            this.transactionsContainer.appendChild(element);
        });
    }

    filterTransactions(transactions) {
        switch (this.currentTab) {
            case 'incomes':
                return transactions.filter(t => t.type === 'income');
            case 'expenses':
                return transactions.filter(t => t.type === 'expense');
            default:
                return transactions;
        }
    }

    sortTransactions(transactions) {
        return [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    createTransactionElement(transaction) {
        const element = document.createElement('div');
        element.className = `transaction-item ${transaction.type}`;
        
        const descriptionHTML = transaction.description ? 
            `<div class="item-description">${this.escapeHTML(transaction.description)}</div>` : '';
        
        element.innerHTML = `
            <div class="item-header">
                <p class="item-name">${this.escapeHTML(transaction.name)}</p>
                <p class="item-amount">${this.formatCurrency(transaction.amount)}</p>
            </div>
            <div class="item-details">
                <p class="item-date">
                    <i class="far fa-calendar-alt"></i> 
                    ${this.formatDate(transaction.date)}
                </p>
                <p class="item-category">
                    <i class="fas fa-tag"></i> 
                    ${this.escapeHTML(transaction.category)}
                </p>
                ${descriptionHTML}
            </div>
            <div class="btns">
                <button class="edit-btn" data-id="${transaction.id}">
                    <i class="fas fa-edit"></i> ویرایش
                </button>
                <button class="delete-btn" data-id="${transaction.id}" data-name="${this.escapeHTML(transaction.name)}">
                    <i class="fas fa-trash"></i> حذف
                </button>
            </div>
        `;
        
        return element;
    }

    renderEmptyState() {
        let message, icon;
        
        switch (this.currentTab) {
            case 'incomes':
                message = 'هنوز هیچ درآمدی ثبت نکرده‌اید';
                icon = 'fas fa-coins';
                break;
            case 'expenses':
                message = 'هنوز هیچ هزینه‌ای ثبت نکرده‌اید';
                icon = 'fas fa-money-bill-wave';
                break;
            default:
                message = 'هنوز هیچ تراکنشی ثبت نکرده‌اید';
                icon = 'fas fa-file-invoice-dollar';
        }
        
        this.transactionsContainer.innerHTML = `
            <div class="empty-state">
                <i class="${icon}"></i>
                <p>${message}</p>
                <p style="font-size: 1.1rem; margin-top: 15px; opacity: 0.7;">
                    برای شروع، یک ${this.currentTab === 'incomes' ? 'درآمد' : 'هزینه'} جدید اضافه کنید
                </p>
            </div>
        `;
    }

    updateTotals(transactions) {
        let totalExpenses = 0;
        let totalIncomes = 0;
        
        transactions.forEach(transaction => {
            if (transaction.type === 'expense') {
                totalExpenses += transaction.amount;
            } else {
                totalIncomes += transaction.amount;
            }
        });
        
        const balance = totalIncomes - totalExpenses;
        
        this.totalExpensesElement.textContent = this.formatCurrency(totalExpenses);
        this.totalIncomesElement.textContent = this.formatCurrency(totalIncomes);
        this.totalBalanceElement.textContent = this.formatCurrency(balance);
        
        // تغییر رنگ موجودی بر اساس مثبت یا منفی بودن
        if (balance < 0) {
            this.totalBalanceElement.style.color = '#ff6b6b';
        } else {
            this.totalBalanceElement.style.color = '#a2d2ff';
        }
    }

    showNotification(message, isSuccess = true) {
        this.notification.textContent = message;
        this.notification.className = `notification ${isSuccess ? 'success' : 'error'}`;
        this.notification.classList.add('show');
        
        setTimeout(() => {
            this.notification.classList.remove('show');
        }, 4000);
    }

    showLoading() {
        this.transactionsContainer.innerHTML = `
            <div class="empty-state">
                <div class="loading" style="width: 60px; height: 60px; margin: 0 auto 20px;"></div>
                <p>در حال بارگذاری تراکنش‌ها...</p>
            </div>
        `;
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('fa-IR').format(amount) + ' تومان';
    }

    formatDate(dateString) {
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        return new Date(dateString).toLocaleDateString('fa-IR', options);
    }

    escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}

// کلاس اصلی برنامه
class FinanceApp {
    constructor() {
        this.db = new FinanceDB();
        this.ui = new FinanceUI();
        this.transactions = [];
        this.currentTransactionType = 'expense';
    }

    async init() {
        try {
            this.ui.showLoading();
            await this.db.init();
            await this.loadTransactions();
            
            // تنظیم تاریخ امروز به عنوان پیش‌فرض
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('transactionDate').value = today;
            
            console.log('Finance app initialized successfully');
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.ui.showNotification('خطا در راه‌اندازی برنامه: ' + error.message, false);
        }
    }

    async loadTransactions() {
        try {
            this.transactions = await this.db.getAllTransactions();
            this.updateUI();
        } catch (error) {
            console.error('Error loading transactions:', error);
            this.ui.showNotification('خطا در بارگذاری تراکنش‌ها: ' + error.message, false);
        }
    }

    updateUI() {
        this.ui.renderTransactions(this.transactions);
        this.ui.updateTotals(this.transactions);
    }

    async addTransaction(transactionData) {
        try {
            const id = await this.db.saveTransaction(transactionData);
            await this.loadTransactions();
            return id;
        } catch (error) {
            console.error('Error adding transaction:', error);
            throw error;
        }
    }

    async updateTransaction(id, updates) {
        try {
            await this.db.updateTransaction(id, updates);
            await this.loadTransactions();
        } catch (error) {
            console.error('Error updating transaction:', error);
            throw error;
        }
    }

    async deleteTransaction(id) {
        try {
            await this.db.deleteTransaction(id);
            await this.loadTransactions();
        } catch (error) {
            console.error('Error deleting transaction:', error);
            throw error;
        }
    }

    setTransactionType(type) {
        this.currentTransactionType = type;
        const expenseBtn = document.getElementById('expenseType');
        const incomeBtn = document.getElementById('incomeType');
        const modalTitle = document.getElementById('modalTitle');
        const submitButton = document.getElementById('submitButton');
        
        if (type === 'expense') {
            expenseBtn.classList.add('active');
            incomeBtn.classList.remove('active');
            modalTitle.textContent = 'افزودن هزینه جدید';
            submitButton.querySelector('#submitText').textContent = 'ثبت هزینه';
        } else {
            incomeBtn.classList.add('active');
            expenseBtn.classList.remove('active');
            modalTitle.textContent = 'افزودن درآمد جدید';
            submitButton.querySelector('#submitText').textContent = 'ثبت درآمد';
        }
    }
}

// توابع جهانی برای دسترسی از HTML
let financeApp;

async function initializeApp() {
    financeApp = new FinanceApp();
    window.financeApp = financeApp;
    await financeApp.init();
}

function setTransactionType(type) {
    if (financeApp) {
        financeApp.setTransactionType(type);
    }
}

function openForm(type = 'expense') {
    setTransactionType(type);
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('transactionDate').value = today;
    document.getElementById('addModal').style.display = 'flex';
}

function closeForm() {
    document.getElementById('addModal').style.display = 'none';
    document.getElementById('addForm').reset();
    hideSubmitLoading();
}

function openDeleteModal(id, name) {
    window.itemId = id;
    document.getElementById('deleteItemName').textContent = name;
    document.getElementById('deleteModal').style.display = 'flex';
}

function closeDeleteModal() {
    document.getElementById('deleteModal').style.display = 'none';
}

async function openEditModal(id) {
    try {
        const transaction = financeApp.transactions.find(t => t.id === parseInt(id));
        if (transaction) {
            document.getElementById('editTransactionName').value = transaction.name;
            document.getElementById('editTransactionAmount').value = transaction.amount;
            document.getElementById('editTransactionDate').value = transaction.date;
            document.getElementById('editTransactionCategory').value = transaction.category;
            document.getElementById('editTransactionDescription').value = transaction.description || '';
            
            const expenseBtn = document.getElementById('editExpenseType');
            const incomeBtn = document.getElementById('editIncomeType');
            
            if (transaction.type === 'expense') {
                expenseBtn.classList.add('active');
                incomeBtn.classList.remove('active');
            } else {
                incomeBtn.classList.add('active');
                expenseBtn.classList.remove('active');
            }
            
            window.itemId = id;
            document.getElementById('editModal').style.display = 'flex';
        } else {
            financeApp.ui.showNotification('تراکنش مورد نظر یافت نشد', false);
        }
    } catch (error) {
        console.error('Error opening edit modal:', error);
        financeApp.ui.showNotification('خطا در باز کردن فرم ویرایش', false);
    }
}

function closeEditModal() {
    document.getElementById('editModal').style.display = 'none';
}

function showSubmitLoading() {
    document.getElementById('submitText').style.display = 'none';
    document.getElementById('submitLoading').style.display = 'inline-block';
}

function hideSubmitLoading() {
    document.getElementById('submitText').style.display = 'inline';
    document.getElementById('submitLoading').style.display = 'none';
}

async function deleteItem() {
    try {
        showSubmitLoading();
        await financeApp.deleteTransaction(window.itemId);
        financeApp.ui.showNotification('تراکنش با موفقیت حذف شد');
        closeDeleteModal();
    } catch (error) {
        financeApp.ui.showNotification('خطا در حذف تراکنش: ' + error.message, false);
    } finally {
        hideSubmitLoading();
    }
}

// رویدادهای فرم‌ها
document.getElementById('addForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const formData = {
        name: document.getElementById('transactionName').value.trim(),
        amount: parseInt(document.getElementById('transactionAmount').value),
        date: document.getElementById('transactionDate').value,
        category: document.getElementById('transactionCategory').value,
        description: document.getElementById('transactionDescription').value.trim(),
        type: financeApp.currentTransactionType
    };
    
    try {
        showSubmitLoading();
        await financeApp.addTransaction(formData);
        financeApp.ui.showNotification('تراکنش با موفقیت ثبت شد');
        closeForm();
    } catch (error) {
        financeApp.ui.showNotification('خطا در ثبت تراکنش: ' + error.message, false);
    } finally {
        hideSubmitLoading();
    }
});

document.getElementById('editForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const expenseBtn = document.getElementById('editExpenseType');
    const type = expenseBtn.classList.contains('active') ? 'expense' : 'income';
    
    const formData = {
        name: document.getElementById('editTransactionName').value.trim(),
        amount: parseInt(document.getElementById('editTransactionAmount').value),
        date: document.getElementById('editTransactionDate').value,
        category: document.getElementById('editTransactionCategory').value,
        description: document.getElementById('editTransactionDescription').value.trim(),
        type: type
    };
    
    try {
        showSubmitLoading();
        await financeApp.updateTransaction(window.itemId, formData);
        financeApp.ui.showNotification('تغییرات با موفقیت ذخیره شد');
        closeEditModal();
    } catch (error) {
        financeApp.ui.showNotification('خطا در ذخیره تغییرات: ' + error.message, false);
    } finally {
        hideSubmitLoading();
    }
});

// رویدادهای دکمه‌های نوع تراکنش
document.getElementById('expenseType').addEventListener('click', () => setTransactionType('expense'));
document.getElementById('incomeType').addEventListener('click', () => setTransactionType('income'));

document.getElementById('editExpenseType').addEventListener('click', function() {
    this.classList.add('active');
    document.getElementById('editIncomeType').classList.remove('active');
});

document.getElementById('editIncomeType').addEventListener('click', function() {
    this.classList.add('active');
    document.getElementById('editExpenseType').classList.remove('active');
});

// مدیریت تم تاریک
const themeToggle = document.getElementById('theme-toggle');

if (localStorage.getItem('darkMode') === 'enabled') {
    document.body.classList.add('dark-mode');
    themeToggle.checked = true;
}

themeToggle.addEventListener('change', function() {
    if (this.checked) {
        document.body.classList.add('dark-mode');
        localStorage.setItem('darkMode', 'enabled');
    } else {
        document.body.classList.remove('dark-mode');
        localStorage.setItem('darkMode', 'disabled');
    }
});

// نمایش/پنهان کردن اطلاعات توسعه‌دهنده
function toggleDeveloperInfo() {
    const details = document.getElementById('developerDetails');
    details.classList.toggle('show');
}

// بارگذاری اولیه برنامه
window.addEventListener('load', initializeApp);