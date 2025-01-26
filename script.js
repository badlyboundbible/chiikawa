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

// Utility Functions
function getCurrencySymbol(currency) {
    const symbols = {
        'GBP': '£',
        'EUR': '€',
        'HKD': '$'
    };
    return symbols[currency] || currency;
}

function formatDate(dateString) {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
}

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

// Participant Management
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
    updatePresentParticipants();
}

function removeParticipant(name) {
    if (expenses.length > 0) {
        alert('Cannot remove participants once expenses have been added');
        return;
    }
    participants = participants.filter(p => p !== name);
    updateUI();
    updatePresentParticipants();
}

function updatePresentParticipants() {
    const container = document.getElementById('presentParticipants');
    if (!container) return;

    container.innerHTML = participants.map(name => `
        <div class="checkbox-item">
            <input type="checkbox" 
                   id="present-${name}" 
                   value="${name}" 
                   checked
                   onchange="handlePresentParticipantChange()">
            <label for="present-${name}">${name}</label>
        </div>
    `).join('');
}

function handlePresentParticipantChange() {
    const splitType = document.getElementById('splitType').value;
    if (splitType === 'manual') {
        toggleSplitInputs();
    }
}

function getPresentParticipants() {
    return participants.filter(name => {
        const checkbox = document.getElementById(`present-${name}`);
        return checkbox && checkbox.checked;
    });
}

// Expense Management
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
                presentParticipants: JSON.parse(record.fields.PresentParticipants || '[]'),
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
        }
    } catch (error) {
        console.error('Error loading expenses:', error);
        throw new Error('Failed to load expenses');
    }
}

async function addExpense() {
    const description = document.getElementById('expenseDescription').value.trim();
    const amount = parseFloat(document.getElementById('expenseAmount').value);
    const currency = document.getElementById('currencySelect').value;
    const paidBy = document.getElementById('paidBy').value;
    const splitType = document.getElementById('splitType').value;
    const date = new Date().toISOString().split('T')[0];
    const presentParticipants = getPresentParticipants();

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
    if (presentParticipants.length === 0) {
        alert('Please select at least one present participant');
        return;
    }

    // Calculate splits
    let splits = {};
    if (splitType === 'equal') {
        const splitAmount = amount / presentParticipants.length;
        presentParticipants.forEach(name => {
            splits[name] = parseFloat(splitAmount.toFixed(2));
        });
        
        // Fix rounding errors
        const totalSplit = Object.values(splits).reduce((sum, val) => sum + val, 0);
        if (totalSplit !== amount) {
            const firstParticipant = presentParticipants[0];
            splits[firstParticipant] += parseFloat((amount - totalSplit).toFixed(2));
        }
    } else {
        let total = 0;
        presentParticipants.forEach(name => {
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
        const record = {
            Description: description,
            Amount: amount,
            Currency: currency,
            PaidBy: paidBy,
            Participants: JSON.stringify(participants),
            PresentParticipants: JSON.stringify(presentParticipants),
            Splits: JSON.stringify(splits),
            Date: date
        };

        const response = await airtableService.createRecord(record);
        
        expenses.push({
            id: response.records[0].id,
            description,
            amount,
            currency,
            paidBy,
            participants: [...participants],
            presentParticipants: [...presentParticipants],
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

// Clear expense form
function clearExpenseForm() {
    document.getElementById('expenseDescription').value = '';
    document.getElementById('expenseAmount').value = '';
    document.getElementById('splitAmounts').style.display = 'none';
    document.getElementById('splitType').value = 'equal';
    document.getElementById('addExpenseBtn').textContent = 'Add Expense';
    currentEditId = null;

    // Reset present participants
    updatePresentParticipants();

    // Update form title and hide cancel button
    document.getElementById('expenseFormTitle').textContent = 'Add Expense';
    const cancelBtn = document.getElementById('cancelEditBtn');
    if (cancelBtn) {
        cancelBtn.style.display = 'none';
    }
}

// Split management
function toggleSplitInputs() {
    const splitType = document.getElementById('splitType').value;
    const splitAmounts = document.getElementById('splitAmounts');
    const amount = parseFloat(document.getElementById('expenseAmount').value) || 0;
    const currency = document.getElementById('currencySelect').value;
    const presentParticipants = getPresentParticipants();
    
    if (presentParticipants.length === 0) {
        alert('Please select at least one present participant');
        return;
    }
    
    if (splitType === 'manual') {
        splitAmounts.style.display = 'block';
        const equalSplit = amount / presentParticipants.length;
        
        splitAmounts.innerHTML = participants.map(name => {
            const isPresent = presentParticipants.includes(name);
            return `
                <div class="split-input ${isPresent ? 'present' : 'not-present'}">
                    <label>${name}</label>
                    <div class="input-group">
                        <span class="currency-symbol">${getCurrencySymbol(currency)}</span>
                        <input type="number" 
                               id="split-${name}" 
                               value="${isPresent ? equalSplit.toFixed(2) : '0.00'}" 
                               step="0.01" 
                               onchange="updateSplits()"
                               ${!isPresent ? 'disabled' : ''}>
                    </div>
                </div>
            `;
        }).join('');
    } else {
        splitAmounts.style.display = 'none';
    }
    updateSplits();
}

function updateSplits() {
    const amount = parseFloat(document.getElementById('expenseAmount').value) || 0;
    const presentParticipants = getPresentParticipants();
    const splitType = document.getElementById('splitType').value;

    if (presentParticipants.length === 0) {
        alert('Please select at least one present participant');
        return;
    }

    if (splitType === 'equal') {
        const equalSplit = amount / presentParticipants.length;
        presentParticipants.forEach(name => {
            const input = document.getElementById(`split-${name}`);
            if (input) {
                input.value = equalSplit.toFixed(2);
            }
        });
    } else {
        let total = 0;
        presentParticipants.forEach(name => {
            const input = document.getElementById(`split-${name}`);
            if (input) {
                const splitAmount = parseFloat(input.value) || 0;
                total += splitAmount;
            }
        });

        if (Math.abs(total - amount) > 0.01) {
            document.querySelectorAll('.split-input.present input').forEach(input => {
                input.classList.add('error');
            });
        } else {
            document.querySelectorAll('.split-input.present input').forEach(input => {
                input.classList.remove('error');
            });
        }
    }

    // Set non-present participants to 0
    participants.forEach(name => {
        if (!presentParticipants.includes(name)) {
            const input = document.getElementById(`split-${name}`);
            if (input) {
                input.value = '0.00';
                input.disabled = true;
            }
        }
    });
}

// UI Updates
function updateUI() {
    updateParticipantsList();
    updateExpensesList();
    updateSettlementSummary();
}

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

            // Format splits for display
            const splitsDisplay = Object.entries(e.splits || {})
                .map(([name, amount]) => {
                    if (amount > 0) {
                        return `<div class="split-item">
                            <span class="split-name">${name}:</span> 
                            <span class="split-amount">${getCurrencySymbol(e.currency)}${amount.toFixed(2)}</span>
                        </div>`;
                    }
                    return '';
                })
                .filter(item => item)
                .join('');

            return `
                <div class="expense-item">
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

function updateSettlementSummary() {
    const summary = calculateSettlement();
    const summaryDiv = document.getElementById('settlementSummary');
    let settlementHtml = '';

    // Group settlements by participant
    participants.forEach(participant => {
        let participantSettlements = {
            outgoing: {}, // What they need to pay
            incoming: {}  // What they will receive
        };

        // Collect all settlements for this participant
        Object.entries(summary.settlements).forEach(([currency, settlements]) => {
            settlements.forEach(s => {
                if (s.from === participant) {
                    if (!participantSettlements.outgoing[currency]) {
                        participantSettlements.outgoing[currency] = [];
                    }
                    participantSettlements.outgoing[currency].push({
                        person: s.to,
                        amount: s.amount
                    });
                }
                if (s.to === participant) {
                    if (!participantSettlements.incoming[currency]) {
                        participantSettlements.incoming[currency] = [];
                    }
                    participantSettlements.incoming[currency].push({
                        person: s.from,
                        amount: s.amount
                    });
                }
            });
        });

        // Only show this person's section if they have settlements
        const hasSettlements = Object.keys(participantSettlements.outgoing).length > 0 || 
                             Object.keys(participantSettlements.incoming).length > 0;

        if (hasSettlements) {
            settlementHtml += `
                <div class="settlement-section">
                    <h3>${participant}'s Settlements</h3>
                    <div class="settlement-tables">`;

            // Outgoing payments (what they need to pay)
            Object.entries(participantSettlements.outgoing).forEach(([currency, payments]) => {
                if (payments.length > 0) {
                    settlementHtml += `
                        <div class="currency-group">
                            <h4>Pay (${currency})</h4>
                            <table class="settlement-table">
                                <tbody>`;
                    
                    payments.forEach(payment => {
                        settlementHtml += `
                            <tr class="payment-row">
                                <td class="person">${payment.person}</td>
                                <td class="amount">${getCurrencySymbol(currency)}${payment.amount.toFixed(2)}</td>
                            </tr>`;
                    });

                    settlementHtml += `
                                </tbody>
                            </table>
                        </div>`;
                }
            });

            // Incoming payments (what they will receive)
            Object.entries(participantSettlements.incoming).forEach(([currency, payments]) => {
                if (payments.length > 0) {
                    settlementHtml += `
                        <div class="currency-group">
                            <h4>Receive (${currency})</h4>
                            <table class="settlement-table">
                                <tbody>`;
                    
                    payments.forEach(payment => {
                        settlementHtml += `
                            <tr class="receive-row">
                                <td class="person">${payment.person}</td>
                                <td class="amount">${getCurrencySymbol(currency)}${payment.amount.toFixed(2)}</td>
                            </tr>`;
                    });

                    settlementHtml += `
                                </tbody>
                            </table>
                        </div>`;
                }
            });

            settlementHtml += `
                    </div>
                </div>`;
        }
    });

    summaryDiv.innerHTML = settlementHtml || '<div class="empty-state">All settled up!</div>';
}

// Settlement calculations
function calculateSettlement() {
    if (!participants.length || !expenses.length) {
        return {
            settlements: {},
            balances: {}
        };
    }

    const balances = {};
    const settlements = {};

    // Initialize balances
    participants.forEach(name => {
        balances[name] = {
            GBP: 0,
            EUR: 0,
            HKD: 0
        };
    });

    // Calculate balances for each expense
    expenses.forEach(expense => {
        const { currency, amount, paidBy, splits, presentParticipants } = expense;
        
        if (!currency || !amount || !paidBy || !splits || !presentParticipants) return;

        // Only handle splits between people who were present
        Object.entries(splits).forEach(([name, splitAmount]) => {
            if (presentParticipants.includes(name)) {
                if (name === paidBy) {
                    // Payer's balance increases by difference between what they paid and their share
                    balances[paidBy][currency] = (balances[paidBy][currency] || 0) + (amount - splitAmount);
                } else {
                    // Others owe their share
                    balances[name][currency] = (balances[name][currency] || 0) - splitAmount;
                    balances[paidBy][currency] = (balances[paidBy][currency] || 0) + splitAmount;
                }
            }
        });
    });

    // Calculate settlements for each currency
    ['GBP', 'EUR', 'HKD'].forEach(currency => {
        settlements[currency] = [];
        const currencyBalances = {};

        // Get non-zero balances for this currency
        participants.forEach(name => {
            const balance = balances[name][currency];
            if (Math.abs(balance) > 0.01) {
                currencyBalances[name] = balance;
            }
        });

        // Calculate settlements
        while (Object.keys(currencyBalances).length > 1) {
            const debtors = Object.entries(currencyBalances)
                .filter(([_, balance]) => balance < 0)
                .sort((a, b) => a[1] - b[1]);  // Most negative first

            const creditors = Object.entries(currencyBalances)
                .filter(([_, balance]) => balance > 0)
                .sort((a, b) => b[1] - a[1]);  // Most positive first

            if (!debtors.length || !creditors.length) break;

            const [debtorName, debtorBalance] = debtors[0];
            const [creditorName, creditorBalance] = creditors[0];
            
            const amount = Math.min(-debtorBalance, creditorBalance);
            const roundedAmount = parseFloat(amount.toFixed(2));

            if (roundedAmount > 0.01) {
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

    return { settlements, balances };
}
