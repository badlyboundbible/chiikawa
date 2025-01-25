// Airtable Service Class
class AirtableService {
    constructor() {
        this.apiKey = "patG3xfFhZGjGiXWt.8959878dca997d69972b237177713462c43fe7f385ab43d7d45ce500f104d703";
        this.baseId = "app7aGU54LVkhT1fd";
        this.tableName = "Expenses";
        this.url = `https://api.airtable.com/v0/${this.baseId}/${this.tableName}`;
        this.requestQueue = Promise.resolve();
    }

    async createRecord(fields) {
        try {
            const response = await fetch(this.url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ records: [{ fields }] })
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
}

// Initialize global variables
const airtableService = new AirtableService();
let participants = [];
let expenses = [];

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    // Set up all the button clicks and changes
    document.getElementById('addParticipantBtn').addEventListener('click', addParticipant);
    document.getElementById('splitType').addEventListener('change', toggleSplitInputs);
    document.getElementById('addExpenseBtn').addEventListener('click', addExpense);
    document.getElementById('expenseAmount').addEventListener('change', function() {
        if (document.getElementById('splitType').value === 'manual') {
            toggleSplitInputs();
        }
    });
    
    // Start the app
    initialize();
});

// Handle different currency symbols
function getCurrencySymbol(currency) {
    const symbols = {
        'GBP': '£',
        'EUR': '€',
        'HKD': '$'
    };
    return symbols[currency] || currency;
}

async function initialize() {
    try {
        await loadExpenses();
        updateUI();
    } catch (error) {
        console.error('Failed to initialize:', error);
        alert('Failed to load expenses. Please refresh the page.');
    }
}

// Add a new participant
function addParticipant() {
    const nameInput = document.getElementById('participantName');
    const name = nameInput.value.trim();
    
    if (!name) {
        alert('Please enter a participant name');
        return;
    }
    
    if (!participants.includes(name)) {
        participants.push(name);
        nameInput.value = '';
        updateUI();
    } else {
        alert('This participant has already been added.');
    }
}

// Add a new expense
async function addExpense() {
    const description = document.getElementById('expenseDescription').value.trim();
    const amount = parseFloat(document.getElementById('expenseAmount').value);
    const currency = document.getElementById('currencySelect').value;
    const paidBy = document.getElementById('paidBy').value;
    const splitType = document.getElementById('splitType').value;
    const date = new Date().toISOString().split('T')[0]; // Today's date

    // Check if all fields are filled
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

    // Calculate how to split the expense
    let splits = {};
    if (splitType === 'equal') {
        // Split equally between all participants
        const splitAmount = amount / participants.length;
        participants.forEach(name => {
            splits[name] = parseFloat(splitAmount.toFixed(2));
        });
        
        // Fix any rounding issues by adjusting first participant's amount
        const totalSplit = Object.values(splits).reduce((sum, val) => sum + val, 0);
        if (totalSplit !== amount) {
            const firstParticipant = participants[0];
            splits[firstParticipant] += parseFloat((amount - totalSplit).toFixed(2));
        }
    } else {
        // Use manual split amounts
        let total = 0;
        participants.forEach(name => {
            const input = document.getElementById(`split-${name}`);
            const splitAmount = parseFloat(input.value) || 0;
            splits[name] = parseFloat(splitAmount.toFixed(2));
            total += splits[name];
        });

        // Check if manual splits add up to total
        if (Math.abs(total - amount) > 0.01) {
            alert('Split amounts must equal the total expense amount');
            return;
        }
    }

    try {
        // Save to Airtable using our helper function
        const data = await makeAirtableRequest('/Expenses', {
            method: 'POST',
            body: JSON.stringify({
                records: [{
                    fields: {
                        Description: description,
                        Amount: amount,
                        Currency: currency,
                        PaidBy: paidBy,
                        Participants: JSON.stringify(participants),
                        Splits: JSON.stringify(splits),
                        Date: date
                    }
                }]
            })
        });

        // Add to local list if save was successful
        expenses.push({
            id: data.records[0].id,
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
    }
}

// Load all expenses from Airtable
async function loadExpenses() {
    try {
        const data = await makeAirtableRequest('/Expenses');
        
        if (data.records) {
            expenses = data.records.map(record => ({
                id: record.id,
                description: record.fields.Description,
                amount: record.fields.Amount,
                currency: record.fields.Currency,
                paidBy: record.fields.PaidBy,
                participants: JSON.parse(record.fields.Participants || '[]'),
                splits: JSON.parse(record.fields.Splits || '{}'),
                date: record.fields.Date
            }));

            // Get unique participants from all expenses
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

// Clear the expense form after adding
function clearExpenseForm() {
    document.getElementById('expenseDescription').value = '';
    document.getElementById('expenseAmount').value = '';
    document.getElementById('splitAmounts').style.display = 'none';
    document.getElementById('splitType').value = 'equal';
}

// Update all parts of the UI
function updateUI() {
    updateParticipantsList();
    updateExpensesList();
    updateSettlementSummary();
}

// Update the participants list display
function updateParticipantsList() {
    const list = document.getElementById('participantsList');
    const paidBySelect = document.getElementById('paidBy');
    
    // Show participants list
    if (participants.length === 0) {
        list.innerHTML = '<div class="empty-state">No participants added yet</div>';
    } else {
        list.innerHTML = participants.map(name => 
            `<div class="participant-item">
                ${name}
                <button onclick="removeParticipant('${name}')" class="remove-btn">×</button>
            </div>`
        ).join('');
    }
    
    // Update the dropdown for who paid
    paidBySelect.innerHTML = '<option value="">Select who paid</option>' + 
        participants.map(name =>
            `<option value="${name}">${name}</option>`
        ).join('');
}

// Remove a participant (new function)
function removeParticipant(name) {
    if (expenses.length > 0) {
        alert('Cannot remove participants once expenses have been added');
        return;
    }
    participants = participants.filter(p => p !== name);
    updateUI();
}

// Update the expenses list display
function updateExpensesList() {
    const list = document.getElementById('expensesList');
    
    if (expenses.length === 0) {
        list.innerHTML = '<div class="empty-state">No expenses added yet</div>';
        return;
    }
    
    // Sort expenses by date, newest first
    const sortedExpenses = [...expenses].sort((a, b) => 
        new Date(b.date) - new Date(a.date)
    );

    list.innerHTML = sortedExpenses.map(e => {
        // Format splits for display
        const splitsDisplay = Object.entries(e.splits)
            .map(([name, amount]) => 
                `<div class="split-item">
                    <span class="split-name">${name}:</span> 
                    <span class="split-amount">${getCurrencySymbol(e.currency)}${amount.toFixed(2)}</span>
                </div>`
            ).join('');

        return `
            <div class="expense-item">
                <div class="expense-header">
                    <strong class="expense-description">${e.description}</strong>
                    <span class="expense-date">${formatDate(e.date)}</span>
                </div>
                <div class="expense-amount">
                    ${getCurrencySymbol(e.currency)}${e.amount.toFixed(2)}
                </div>
                <div class="expense-paid-by">Paid by: ${e.paidBy}</div>
                <div class="expense-splits">
                    <div class="splits-header">Split details:</div>
                    <div class="splits-grid">${splitsDisplay}</div>
                </div>
            </div>
        `;
    }).join('');
}

// Format the date nicely
function formatDate(dateString) {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
}

// Show or hide the split amount inputs
function toggleSplitInputs() {
    const splitType = document.getElementById('splitType').value;
    const splitAmounts = document.getElementById('splitAmounts');
    const amount = parseFloat(document.getElementById('expenseAmount').value) || 0;
    
    if (splitType === 'manual') {
        splitAmounts.style.display = 'block';
        const equalSplit = amount / participants.length;
        
        splitAmounts.innerHTML = participants.map((name, index) => `
            <div class="split-input">
                <label>${name}</label>
                <div class="input-group">
                    <span class="currency-symbol">${getCurrencySymbol(document.getElementById('currencySelect').value)}</span>
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

// Update split amounts when they're changed
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
        
        // Show warning if it's negative
        if (remainingAmount < 0) {
            lastInput.classList.add('negative-amount');
        } else {
            lastInput.classList.remove('negative-amount');
        }
    }
}

// Calculate who owes what to whom
function calculateSettlement() {
    const balances = {};
    const settlements = {};
    const totals = {};

    // Initialize balances for each participant and currency
    participants.forEach(name => {
        balances[name] = {
            GBP: 0,
            EUR: 0,
            HKD: 0
        };
    });

    // Calculate balances
    expenses.forEach(e => {
        // Add amount to payer's balance
        balances[e.paidBy][e.currency] += e.amount;

        // Subtract splits from each participant
        Object.entries(e.splits).forEach(([name, amount]) => {
            balances[name][e.currency] -= amount;
        });

        // Update totals for each currency
        totals[e.currency] = (totals[e.currency] || 0) + e.amount;
    });

    // Calculate settlements for each currency
    Object.keys(totals).forEach(currency => {
        const currencyBalances = {};
        settlements[currency] = [];

        // Get non-zero balances for this currency
        participants.forEach(name => {
            if (Math.abs(balances[name][currency]) > 0.01) {
                currencyBalances[name] = balances[name][currency];
            }
        });

        // Keep settling until everyone's paid up
        while (Object.keys(currencyBalances).length > 1) {
            // Find people who owe money (negative balance)
            const debtors = Object.entries(currencyBalances)
                .filter(([name, balance]) => balance < 0)
                .sort((a, b) => a[1] - b[1]);  // Sort by amount owed (most negative first)

            // Find people who are owed money (positive balance)
            const creditors = Object.entries(currencyBalances)
                .filter(([name, balance]) => balance > 0)
                .sort((a, b) => b[1] - a[1]);  // Sort by amount owed (most positive first)

            if (debtors.length === 0 || creditors.length === 0) break;

            const [debtorName, debtorBalance] = debtors[0];
            const [creditorName, creditorBalance] = creditors[0];
            
            // Calculate the amount to settle
            const amount = Math.min(-debtorBalance, creditorBalance);
            const roundedAmount = parseFloat(amount.toFixed(2));

            if (roundedAmount > 0) {
                settlements[currency].push({
                    from: debtorName,
                    to: creditorName,
                    amount: roundedAmount
                });
            }

            // Update balances
            currencyBalances[debtorName] = parseFloat((debtorBalance + amount).toFixed(2));
            currencyBalances[creditorName] = parseFloat((creditorBalance - amount).toFixed(2));

            // Remove settled balances (close to zero)
            if (Math.abs(currencyBalances[debtorName]) < 0.01) delete currencyBalances[debtorName];
            if (Math.abs(currencyBalances[creditorName]) < 0.01) delete currencyBalances[creditorName];
        }
    });

    return { settlements, totals, balances };
}

// Show the settlement summary on the page
function updateSettlementSummary() {
    const summary = calculateSettlement();
    const summaryDiv = document.getElementById('settlementSummary');
    const totalsDiv = document.getElementById('currencyTotals');

    // Show total expenses in each currency
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

    // Show the settlements needed
    if (expenses.length === 0) {
        summaryDiv.innerHTML = '<div class="empty-state">No expenses to settle</div>';
        return;
    }

    let settlementHtml = '';
    
    // Show settlements for each currency
    Object.entries(summary.settlements).forEach(([currency, settlements]) => {
        if (settlements.length > 0) {
            settlementHtml += `
                <div class="currency-settlements">
                    <h3>${currency} Settlements:</h3>
                    <div class="settlements-list">
                        ${settlements.map(s => 
                            `<div class="settlement-item">
                                <span class="from-person">${s.from}</span>
                                <span class="arrow">→</span>
                                <span class="to-person">${s.to}</span>
                                <span class="amount">
                                    ${getCurrencySymbol(currency)}${s.amount.toFixed(2)}
                                </span>
                            </div>`
                        ).join('')}
                    </div>
                </div>`;
        }
    });

    // Show individual balances
    settlementHtml += `
        <div class="individual-balances">
            <h3>Individual Balances:</h3>
            ${participants.map(name => {
                const balances = summary.balances[name];
                const nonZeroBalances = Object.entries(balances)
                    .filter(([_, amount]) => Math.abs(amount) > 0.01)
                    .map(([currency, amount]) => 
                        `${getCurrencySymbol(currency)}${amount.toFixed(2)} ${currency}`
                    ).join(', ');
                
                return nonZeroBalances ? 
                    `<div class="balance-item">
                        <span class="person-name">${name}:</span>
                        <span class="balance-amount">${nonZeroBalances}</span>
                    </div>` : '';
            }).join('')}
        </div>`;

    summaryDiv.innerHTML = settlementHtml || '<div class="empty-state">All settled up!</div>';
}
