// Airtable configuration
const AIRTABLE_TOKEN = 'patG3xfFhZGjGiXWt.8959878dca997d69972b237177713462c43fe7f385ab43d7d45ce500f104d703';
const AIRTABLE_BASE_ID = 'app7aGU54LVkhT1fd';
const AIRTABLE_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}`;

// State management
let participants = [];
let expenses = [];

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    // Add event listeners
    document.getElementById('addParticipantBtn').addEventListener('click', addParticipant);
    document.getElementById('splitType').addEventListener('change', toggleSplitInputs);
    document.getElementById('addExpenseBtn').addEventListener('click', addExpense);
    document.getElementById('expenseAmount').addEventListener('change', function() {
        if (document.getElementById('splitType').value === 'manual') {
            toggleSplitInputs();
        }
    });
    
    // Initialize the app
    initialize();
});

async function initialize() {
    await loadExpenses();
    updateUI();
}

// Add this after your initialization code
async function testAirtableConnection() {
    try {
        console.log('Testing Airtable connection...');
        const response = await fetch(`${AIRTABLE_URL}/Expenses`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        const responseText = await response.text();
        console.log('Airtable Response:', {
            status: response.status,
            statusText: response.statusText,
            body: responseText
        });

        if (!response.ok) {
            throw new Error(`Airtable Error: ${response.status} ${responseText}`);
        }

        alert('Successfully connected to Airtable!');
    } catch (error) {
        console.error('Airtable Connection Error:', error);
        alert('Failed to connect to Airtable: ' + error.message);
    }
}

// Add this to your DOMContentLoaded event listener
document.addEventListener('DOMContentLoaded', function() {
    // Existing code...
    
    // Add this line
    testAirtableConnection();
});

// Currency utility functions
function getCurrencySymbol(currency) {
    const symbols = {
        'GBP': '£',
        'EUR': '€',
        'HKD': '$'
    };
    return symbols[currency] || currency;
}

// Participants management
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

// Expense management
async function addExpense() {
    const description = document.getElementById('expenseDescription').value.trim();
    const amount = parseFloat(document.getElementById('expenseAmount').value);
    const currency = document.getElementById('currencySelect').value;
    const paidBy = document.getElementById('paidBy').value;
    const splitType = document.getElementById('splitType').value;
    const date = new Date().toISOString().split('T')[0]; // Today's date

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

    let splits = {};
    if (splitType === 'equal') {
        const splitAmount = amount / participants.length;
        participants.forEach(name => {
            splits[name] = parseFloat(splitAmount.toFixed(2));
        });
        
        // Adjust rounding errors by adding/subtracting from first participant
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

    try {
        const response = await fetch(`${AIRTABLE_URL}/Expenses`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
                'Content-Type': 'application/json'
            },
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

        if (!response.ok) {
            throw new Error('Failed to save expense');
        }

        const data = await response.json();
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

async function loadExpenses() {
    try {
        const response = await fetch(`${AIRTABLE_URL}/Expenses`, {
            headers: {
                'Authorization': `Bearer ${AIRTABLE_TOKEN}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to load expenses');
        }

        const data = await response.json();
        expenses = data.records.map(record => ({
            id: record.id,
            description: record.fields.Description,
            amount: record.fields.Amount,
            currency: record.fields.Currency,
            paidBy: record.fields.PaidBy,
            participants: JSON.parse(record.fields.Participants),
            splits: JSON.parse(record.fields.Splits),
            date: record.fields.Date
        }));

        // Update participants list from loaded expenses
        const allParticipants = new Set();
        expenses.forEach(expense => {
            expense.participants.forEach(p => allParticipants.add(p));
        });
        participants = Array.from(allParticipants);
    } catch (error) {
        console.error('Error loading expenses:', error);
        alert('Failed to load expenses. Please refresh the page.');
    }
}

function clearExpenseForm() {
    document.getElementById('expenseDescription').value = '';
    document.getElementById('expenseAmount').value = '';
    document.getElementById('splitAmounts').style.display = 'none';
    document.getElementById('splitType').value = 'equal';
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
            `<div class="participant-item">${name}</div>`
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
    
    if (expenses.length === 0) {
        list.innerHTML = '<div class="empty-state">No expenses added yet</div>';
        return;
    }
    
    // Sort expenses by date, most recent first
    const sortedExpenses = [...expenses].sort((a, b) => 
        new Date(b.date) - new Date(a.date)
    );

    list.innerHTML = sortedExpenses.map(e => {
        // Format splits for display
        const splitsDisplay = Object.entries(e.splits)
            .map(([name, amount]) => 
                `${name}: ${getCurrencySymbol(e.currency)}${amount.toFixed(2)}`
            ).join(', ');

        return `
            <div class="expense-item">
                <div class="expense-header">
                    <strong>${e.description}</strong>
                    <span class="expense-date">${formatDate(e.date)}</span>
                </div>
                <div class="expense-amount">
                    ${getCurrencySymbol(e.currency)}${e.amount.toFixed(2)}
                </div>
                <div class="expense-paid-by">Paid by: ${e.paidBy}</div>
                <div class="expense-splits">
                    <small>Splits: ${splitsDisplay}</small>
                </div>
            </div>
        `;
    }).join('');
}

function formatDate(dateString) {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
}

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
                <input type="number" 
                       id="split-${name}" 
                       value="${equalSplit.toFixed(2)}" 
                       step="0.01" 
                       onchange="updateSplits()"
                       ${index === participants.length - 1 ? 'readonly' : ''}>
            </div>
        `).join('');
    } else {
        splitAmounts.style.display = 'none';
    }
}

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
        
        // Highlight negative values
        if (remainingAmount < 0) {
            lastInput.style.color = 'red';
        } else {
            lastInput.style.color = '';
        }
    }
}

// Settlement calculations
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

        // Update totals
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

        // Calculate settlements
        while (Object.keys(currencyBalances).length > 1) {
            const debtors = Object.entries(currencyBalances)
                .filter(([name, balance]) => balance < 0)
                .sort((a, b) => a[1] - b[1]);  // Sort by balance ascending

            const creditors = Object.entries(currencyBalances)
                .filter(([name, balance]) => balance > 0)
                .sort((a, b) => b[1] - a[1]);  // Sort by balance descending

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

            // Remove settled balances
            if (Math.abs(currencyBalances[debtorName]) < 0.01) delete currencyBalances[debtorName];
            if (Math.abs(currencyBalances[creditorName]) < 0.01) delete currencyBalances[creditorName];
        }
    });

    return { settlements, totals };
}

function updateSettlementSummary() {
    const summary = calculateSettlement();
    const summaryDiv = document.getElementById('settlementSummary');
    const totalsDiv = document.getElementById('currencyTotals');

    // Update currency totals
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

    // Update settlement details
    let settlementHtml = '';
    let hasSettlements = false;

    Object.entries(summary.settlements).forEach(([currency, settlements]) => {
        if (settlements.length > 0) {
            hasSettlements = true;
            settlementHtml += `
                <div class="currency-settlements">
                    <h3>${currency} Settlements:</h3>
                    ${settlements.map(s => 
                        `<div class="settlement-item">
                            ${s.from} pays ${s.to} 
                            <strong>${getCurrencySymbol(currency)}${s.amount.toFixed(2)}</strong>
                        </div>`
                    ).join('')}
                </div>`;
        }
    });

    if (!hasSettlements) {
        summaryDiv.innerHTML = '<div class="empty-state">No settlements needed</div>';
    } else {
        summaryDiv.innerHTML = settlementHtml;
    }
}
