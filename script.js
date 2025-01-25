// Airtable Service Class
class AirtableService {
    constructor() {
        this.apiKey = "patG3xfFhZGjGiXWt.8959878dca997d69972b237177713462c43fe7f385ab43d7d45ce500f104d703";
        this.baseId = "app7aGU54LVkhT1fd";
        this.tableName = "Expenses";
        this.url = `https://api.airtable.com/v0/${this.baseId}/${this.tableName}`;
    }

    async createRecord(fields) {
        try {
            const response = await fetch(this.url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    records: [{
                        fields: fields
                    }]
                })
            });

            if (!response.ok) {
                throw new Error('Failed to create record');
            }

            return await response.json();
        } catch (error) {
            console.error('Error creating record:', error);
            throw error;
        }
    }

    async getAllRecords() {
        try {
            const response = await fetch(this.url, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch records');
            }

            return await response.json();
        } catch (error) {
            console.error('Error fetching records:', error);
            throw error;
        }
    }

    async deleteRecord(recordId) {
        try {
            const response = await fetch(`${this.url}/${recordId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to delete record');
            }

            return await response.json();
        } catch (error) {
            console.error('Error deleting record:', error);
            throw error;
        }
    }

    async updateRecord(recordId, fields) {
        try {
            const response = await fetch(`${this.url}/${recordId}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    fields: fields
                })
            });

            if (!response.ok) {
                throw new Error('Failed to update record');
            }

            return await response.json();
        } catch (error) {
            console.error('Error updating record:', error);
            throw error;
        }
    }
}

// Initialize global variables
const airtableService = new AirtableService();
let participants = [];
let expenses = [];
let currentEditId = null;

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    // Set up all the button clicks and changes
    document.getElementById('addParticipantBtn').addEventListener('click', addParticipant);
    document.getElementById('splitType').addEventListener('change', toggleSplitInputs);
    document.getElementById('addExpenseBtn').addEventListener('click', () => {
        if (currentEditId) {
            updateExpenseRecord(currentEditId);
        } else {
            addExpense();
        }
    });
    document.getElementById('expenseAmount').addEventListener('change', function() {
        if (document.getElementById('splitType').value === 'manual') {
            toggleSplitInputs();
        }
    });
    
    // Initialize loading spinner
    initializeLoadingSpinner();
    
    // Start the app
    initialize();
});

// Loading spinner functions
function initializeLoadingSpinner() {
    window.showLoading = function() {
        document.getElementById('loadingSpinner').style.display = 'flex';
    };
    
    window.hideLoading = function() {
        document.getElementById('loadingSpinner').style.display = 'none';
    };
}

// Initialize app
async function initialize() {
    showLoading();
    try {
        await loadExpenses();
        updateUI();
    } catch (error) {
        console.error('Failed to initialize:', error);
        alert('Failed to load expenses. Please refresh the page.');
    } finally {
        hideLoading();
    }
}

// Currency utility functions
function getCurrencySymbol(currency) {
    const symbols = {
        'GBP': '£',
        'EUR': '€',
        'HKD': '$'
    };
    return symbols[currency] || currency;
}

// Add a new participant
function addParticipant() {
    const nameInput = document.getElementById('participantName');
    const name = nameInput.value.trim();
    
    if (!name) {
        alert('Please enter a participant name');
        return;
    }
    
    if (participants.includes(name)) {
        alert('This participant has already been added.');
        return;
    }
    
    participants.push(name);
    nameInput.value = '';
    updateUI();
}

// Load all expenses from Airtable
async function loadExpenses() {
    try {
        const data = await airtableService.getAllRecords();
        
        if (data && data.records) {
            expenses = data.records.map(record => ({
                id: record.id,
                description: record.fields.Description || '',
                amount: parseFloat(record.fields.Amount) || 0,
                currency: record.fields.Currency || 'GBP',
                paidBy: record.fields.PaidBy || '',
                participants: JSON.parse(record.fields.Participants || '[]'),
                splits: JSON.parse(record.fields.Splits || '{}'),
                date: record.fields.Date || new Date().toISOString().split('T')[0]
            }));

            // Update participants list from loaded expenses
            const allParticipants = new Set();
            expenses.forEach(expense => {
                if (Array.isArray(expense.participants)) {
                    expense.participants.forEach(p => allParticipants.add(p));
                }
            });
            participants = Array.from(allParticipants);
            console.log('Loaded expenses:', expenses);
            console.log('Updated participants:', participants);
        }
    } catch (error) {
        console.error('Error loading expenses:', error);
        throw new Error('Failed to load expenses');
    }
}

// Add new expense
async function addExpense() {
    const description = document.getElementById('expenseDescription').value.trim();
    const amount = parseFloat(document.getElementById('expenseAmount').value);
    const currency = document.getElementById('currencySelect').value;
    const paidBy = document.getElementById('paidBy').value;
    const splitType = document.getElementById('splitType').value;
    const date = new Date().toISOString().split('T')[0];

    // Validation
    if (!description) {
        alert('Please enter a description');
        return;
    }
    if (!amount || amount <= 0) {
        alert('Please enter a valid amount');
        return;
    }
    if (!paidBy) {
        alert('Please select who paid');
        return;
    }
    if (participants.length < 2) {
        alert('Please add at least two participants');
        return;
    }

    // Calculate splits
    let splits = {};
    if (splitType === 'equal') {
        const splitAmount = amount / participants.length;
        participants.forEach(name => {
            splits[name] = parseFloat(splitAmount.toFixed(2));
        });
        
        // Fix rounding errors
        const totalSplit = Object.values(splits).reduce((sum, val) => sum + val, 0);
        if (totalSplit !== amount) {
            const firstParticipant = participants[0];
            splits[firstParticipant] += parseFloat((amount - totalSplit).toFixed(2));
        }
    } else {
        let total = 0;
        participants.forEach(name => {
            const input = document.getElementById(`split-${name}`);
            const splitAmount = parseFloat(input.value) || 0;
            splits[name] = parseFloat(splitAmount.toFixed(2));
            total += splits[name];
        });

        if (Math.abs(total - amount) > 0.01) {
            alert('Split amounts must equal the total expense amount');
            return;
        }
    }

    showLoading();
    try {
        // Create the record in Airtable
        const record = {
            Description: description,
            Amount: amount,
            Currency: currency,
            PaidBy: paidBy,
            Participants: JSON.stringify(participants),
            Splits: JSON.stringify(splits),
            Date: date
        };

        const response = await airtableService.createRecord(record);
        
        // Add to local expenses array
        expenses.push({
            id: response.records[0].id,
            description,
            amount,
            currency,
            paidBy,
            participants: [...participants],
            splits,
            date
        });

        clearExpenseForm();
        updateUI();
        alert('Expense added successfully!');
    } catch (error) {
        console.error('Error adding expense:', error);
        alert('Failed to add expense. Please try again.');
    } finally {
        hideLoading();
    }
}

// Clear the expense form
function clearExpenseForm() {
    document.getElementById('expenseDescription').value = '';
    document.getElementById('expenseAmount').value = '';
    document.getElementById('splitAmounts').style.display = 'none';
    document.getElementById('splitType').value = 'equal';
    document.getElementById('addExpenseBtn').textContent = 'Add Expense';
    currentEditId = null;

    // Update form title
    document.getElementById('expenseFormTitle').textContent = 'Add Expense';

    // Hide cancel button if it exists
    const cancelBtn = document.getElementById('cancelEditBtn');
    if (cancelBtn) {
        cancelBtn.style.display = 'none';
    }
}

// Remove a participant
function removeParticipant(name) {
    if (expenses.length > 0) {
        alert('Cannot remove participants once expenses have been added');
        return;
    }
    participants = participants.filter(p => p !== name);
    updateUI();
}

// Update all UI elements
function updateUI() {
    updateParticipantsList();
    updateExpensesList();
    updateSettlementSummary();
}

// Update participants list
function updateParticipantsList() {
    const list = document.getElementById('participantsList');
    const paidBySelect = document.getElementById('paidBy');
    
    // Update participants list
    if (participants.length === 0) {
        list.innerHTML = '<div class="empty-state">No participants added yet</div>';
    } else {
        list.innerHTML = participants.map(name => 
            `<div class="participant-item">
                ${name}
                <button onclick="removeParticipant('${name}')" class="delete-btn">
                    <span class="material-icons">person_remove</span>
                </button>
            </div>`
        ).join('');
    }
    
    // Update paid by select options
    paidBySelect.innerHTML = '<option value="">Select who paid</option>' + 
        participants.map(name =>
            `<option value="${name}">${name}</option>`
        ).join('');
}

// Update expenses list
function updateExpensesList() {
    const list = document.getElementById('expensesList');
    
    if (!expenses || expenses.length === 0) {
        list.innerHTML = '<div class="empty-state">No expenses added yet</div>';
        return;
    }
    
    // Sort expenses by date, newest first
    const sortedExpenses = [...expenses].sort((a, b) => 
        new Date(b.date || '') - new Date(a.date || '')
    );

    list.innerHTML = sortedExpenses.map(e => {
        try {
            if (!e || typeof e.amount !== 'number') {
                console.error('Invalid expense record:', e);
                return '';
            }

            const splitsDisplay = Object.entries(e.splits || {})
                .map(([name, amount]) => {
                    const splitAmount = parseFloat(amount) || 0;
                    return `<div class="split-item">
                        <span class="split-name">${name}:</span> 
                        <span class="split-amount">${getCurrencySymbol(e.currency)}${splitAmount.toFixed(2)}</span>
                    </div>`;
                })
                .join('');

            return `
                <div class="expense-item" data-expense-id="${e.id}">
                    <div class="expense-actions">
                        <button class="edit-btn" onclick="editExpense('${e.id}')">
                            <span class="material-icons">edit</span>
                        </button>
                        <button class="delete-btn" onclick="deleteExpense('${e.id}')">
                            <span class="material-icons">delete</span>
                        </button>
                    </div>
                    <div class="expense-header">
                        <strong class="expense-description">${e.description || 'No description'}</strong>
                        <span class="expense-date">${formatDate(e.date || new Date())}</span>
                    </div>
                    <div class="expense-amount">
                        ${getCurrencySymbol(e.currency)}${e.amount.toFixed(2)}
                    </div>
                    <div class="expense-paid-by">Paid by: ${e.paidBy || 'Unknown'}</div>
                    <div class="expense-splits">
                        <div class="splits-grid">${splitsDisplay}</div>
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('Error rendering expense:', error, e);
            return '';
        }
    }).filter(html => html).join('');
}

// Update settlement summary display
function updateSettlementSummary() {
    const summary = calculateSettlement();
    const summaryDiv = document.getElementById('settlementSummary');
    const totalsDiv = document.getElementById('currencyTotals');

    // Display currency totals
    if (Object.keys(summary.totals).length === 0) {
        totalsDiv.innerHTML = '<div class="empty-state">No expenses yet</div>';
    } else {
        totalsDiv.innerHTML = Object.entries(summary.totals)
            .map(([currency, total]) =>
                `<div class="currency-total">
                    <strong>Total ${currency}:</strong> 
                    ${getCurrencySymbol(currency)}${total.toFixed(2)}
                </div>`
            ).join('');
    }

    // Handle no expenses case
    if (expenses.length === 0) {
        summaryDiv.innerHTML = '<div class="empty-state">No expenses to settle</div>';
        return;
    }

    let settlementHtml = '';
    
    // Display settlements by participant
    participants.forEach(participant => {
        let participantSettlements = [];
        
        // Collect all settlements involving this participant
        Object.entries(summary.settlements).forEach(([currency, settlements]) => {
            settlements.forEach(s => {
                if (s.from === participant || s.to === participant) {
                    participantSettlements.push({
                        ...s,
                        currency
                    });
                }
            });
        });

        // Only show participant section if they have settlements
        if (participantSettlements.length > 0) {
            settlementHtml += `
                <div class="participant-settlements">
                    <h3>${participant}'s Settlements:</h3>
                    <div class="settlements-list">
                        ${participantSettlements.map(s => {
                            const isOwing = s.from === participant;
                            return `
                                <div class="settlement-item ${isOwing ? 'owing' : 'receiving'}">
                                    ${isOwing ? 
                                        `Pay ${s.to}` :
                                        `Receive from ${s.from}`
                                    }
                                    <span class="settlement-amount">
                                        ${getCurrencySymbol(s.currency)}${s.amount.toFixed(2)} ${s.currency}
                                    </span>
                                </div>`;
                        }).join('')}
                    </div>
                </div>`;
        }
    });

    // Display individual balances
    const nonZeroBalances = participants.some(name => 
        Object.values(summary.balances[name]).some(amount => Math.abs(amount) > 0.01)
    );

    if (nonZeroBalances) {
        settlementHtml += `
            <div class="individual-balances">
                <h3>Overall Balances:</h3>
                ${participants.map(name => {
                    const balances = summary.balances[name];
                    const nonZeroBalances = Object.entries(balances)
                        .filter(([_, amount]) => Math.abs(amount) > 0.01)
                        .map(([currency, amount]) => {
                            const formattedAmount = amount.toFixed(2);
                            return `<span class="${amount < 0 ? 'negative' : 'positive'}">
                                ${getCurrencySymbol(currency)}${formattedAmount} ${currency}
                            </span>`;
                        }).join(', ');
                    
                    return nonZeroBalances ? 
                        `<div class="balance-item">
                            <span class="person-name">${name}:</span>
                            <span class="balance-amount">${nonZeroBalances}</span>
                        </div>` : '';
                }).join('')}
            </div>`;
    }

    summaryDiv.innerHTML = settlementHtml || '<div class="empty-state">All settled up!</div>';
}

// Format date for display
function formatDate(dateString) {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
}

// Handle split type toggle
function toggleSplitInputs() {
    const splitType = document.getElementById('splitType').value;
    const splitAmounts = document.getElementById('splitAmounts');
    const amount = parseFloat(document.getElementById('expenseAmount').value) || 0;
    const currency = document.getElementById('currencySelect').value;
    
    if (splitType === 'manual') {
        splitAmounts.style.display = 'block';
        const equalSplit = amount / participants.length;
        
        splitAmounts.innerHTML = participants.map((name, index) => `
            <div class="split-input">
                <label>${name}</label>
                <div class="input-group">
                    <span class="currency-symbol">${getCurrencySymbol(currency)}</span>
                    <input type="number" 
                           id="split-${name}" 
                           value="${equalSplit.toFixed(2)}" 
                           step="0.01" 
                           onchange="updateSplits()"
                           ${index === participants.length - 1 ? 'readonly' : ''}>
                </div>
            </div>
        `).join('');
    } else {
        splitAmounts.style.display = 'none';
    }
}

// Update split amounts
function updateSplits() {
    const amount = parseFloat(document.getElementById('expenseAmount').value) || 0;
    let total = 0;
    
    // Calculate total of all splits except last participant
    participants.slice(0, -1).forEach(name => {
        const input = document.getElementById(`split-${name}`);
        const splitAmount = parseFloat(input.value) || 0;
        total += splitAmount;
    });

    // Auto-calculate last participant's amount
    const lastParticipant = participants[participants.length - 1];
    if (lastParticipant) {
        const lastInput = document.getElementById(`split-${lastParticipant}`);
        const remainingAmount = parseFloat((amount - total).toFixed(2));
        lastInput.value = remainingAmount;
        
        // Show warning if negative
        if (remainingAmount < 0) {
            lastInput.classList.add('negative-amount');
        } else {
            lastInput.classList.remove('negative-amount');
        }
    }
}

// Edit expense
function editExpense(expenseId) {
    const expense = expenses.find(e => e.id === expenseId);
    if (!expense) return;

    // Set current edit ID
    currentEditId = expenseId;

    // Update form title and button
    document.getElementById('expenseFormTitle').textContent = 'Edit Expense';
    const addButton = document.getElementById('addExpenseBtn');
    addButton.textContent = 'Update Expense';

    // Show cancel button
    const cancelButton = document.getElementById('cancelEditBtn');
    cancelButton.style.display = 'inline-block';
    cancelButton.onclick = cancelEdit;

    // Fill the form with expense details
    document.getElementById('expenseDescription').value = expense.description;
    document.getElementById('expenseAmount').value = expense.amount;
    document.getElementById('currencySelect').value = expense.currency;
    document.getElementById('paidBy').value = expense.paidBy;

    // Show split amounts
    document.getElementById('splitType').value = 'manual';
    toggleSplitInputs();
    Object.entries(expense.splits).forEach(([name, amount]) => {
        const input = document.getElementById(`split-${name}`);
        if (input) {
            input.value = amount;
        }
    });

    // Scroll to form
    document.querySelector('.card').scrollIntoView({ behavior: 'smooth' });
}

// Cancel editing
function cancelEdit() {
    clearExpenseForm();
    updateUI();
}

// Update expense record
async function updateExpenseRecord(expenseId) {
    const description = document.getElementById('expenseDescription').value.trim();
    const amount = parseFloat(document.getElementById('expenseAmount').value);
    const currency = document.getElementById('currencySelect').value;
    const paidBy = document.getElementById('paidBy').value;
    const splitType = document.getElementById('splitType').value;

    // Validation
    if (!description || !amount || !paidBy) {
        alert('Please fill in all required fields');
        return;
    }

    // Calculate splits
    let splits = {};
    if (splitType === 'equal') {
        const splitAmount = amount / participants.length;
        participants.forEach(name => {
            splits[name] = parseFloat(splitAmount.toFixed(2));
        });
    } else {
        let total = 0;
        participants.forEach(name => {
            const input = document.getElementById(`split-${name}`);
            const splitAmount = parseFloat(input.value) || 0;
            splits[name] = splitAmount;
            total += splitAmount;
        });

        if (Math.abs(total - amount) > 0.01) {
            alert('Split amounts must equal the total expense amount');
            return;
        }
    }

    showLoading();
    try {
        const updatedFields = {
            Description: description,
            Amount: amount,
            Currency: currency,
            PaidBy: paidBy,
            Splits: JSON.stringify(splits),
            Participants: JSON.stringify(participants)
        };

        await airtableService.updateRecord(expenseId, updatedFields);
        
        // Update local state
        expenses = expenses.map(e => 
            e.id === expenseId 
                ? { 
                    ...e, 
                    description,
                    amount,
                    currency,
                    paidBy,
                    splits,
                    participants: [...participants]
                } 
                : e
        );

        clearExpenseForm();
        updateUI();
        alert('Expense updated successfully');
    } catch (error) {
        console.error('Error updating expense:', error);
        alert('Failed to update expense. Please try again.');
    } finally {
        hideLoading();
    }
}

// Delete expense
async function deleteExpense(expenseId) {
    if (!confirm('Are you sure you want to delete this expense?')) {
        return;
    }

    showLoading();
    try {
        await airtableService.deleteRecord(expenseId);
        expenses = expenses.filter(e => e.id !== expenseId);
        updateUI();
        alert('Expense deleted successfully');
    } catch (error) {
        console.error('Error deleting expense:', error);
        alert('Failed to delete expense. Please try again.');
    } finally {
        hideLoading();
    }
}

// Calculate settlements
function calculateSettlement() {
    // If no participants or expenses, return empty results
    if (!participants.length || !expenses.length) {
        return {
            settlements: {},
            totals: {},
            balances: {}
        };
    }

    const balances = {};
    const settlements = {};
    const totals = {};

    // Initialize balances
    participants.forEach(name => {
        if (name) {
            balances[name] = {
                GBP: 0,
                EUR: 0,
                HKD: 0
            };
        }
    });

    // Calculate balances for each expense
    expenses.forEach(e => {
        if (!e || !e.currency || !e.amount || !e.paidBy || !e.splits) return;

        // Add to payer's balance
        if (balances[e.paidBy] && balances[e.paidBy][e.currency] !== undefined) {
            balances[e.paidBy][e.currency] += e.amount;
        }

        // Subtract splits from each participant
        Object.entries(e.splits).forEach(([name, amount]) => {
            if (balances[name] && balances[name][e.currency] !== undefined) {
                balances[name][e.currency] -= amount;
            }
        });

        // Update totals
        totals[e.currency] = (totals[e.currency] || 0) + e.amount;
    });

    // Calculate settlements for each currency
    Object.keys(totals).forEach(currency => {
        settlements[currency] = [];
        const currencyBalances = {};

        // Get non-zero balances
        participants.forEach(name => {
            if (balances[name] && Math.abs(balances[name][currency]) > 0.01) {
                currencyBalances[name] = balances[name][currency];
            }
        });

        // Calculate optimal settlements
        while (Object.keys(currencyBalances).length > 1) {
            const debtors = Object.entries(currencyBalances)
                .filter(([_, balance]) => balance < 0)
                .sort((a, b) => a[1] - b[1]);

            const creditors = Object.entries(currencyBalances)
                .filter(([_, balance]) => balance > 0)
                .sort((a, b) => b[1] - a[1]);

            if (!debtors.length || !creditors.length) break;

            const [debtorName, debtorBalance] = debtors[0];
            const [creditorName, creditorBalance] = creditors[0];
            
            const amount = Math.min(-debtorBalance, creditorBalance);
            const roundedAmount = parseFloat(amount.toFixed(2));

            if (roundedAmount > 0) {
                settlements[currency].push({
                    from: debtorName,
                    to: creditorName,
                    amount: roundedAmount
                });
            }

            currencyBalances[debtorName] += amount;
            currencyBalances[creditorName] -= amount;

            if (Math.abs(currencyBalances[debtorName]) < 0.01) delete currencyBalances[debtorName];
            if (Math.abs(currencyBalances[creditorName]) < 0.01) delete currencyBalances[creditorName];
        }
    });

    return { settlements, totals, balances };
}
