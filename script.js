// Airtable configuration
const AIRTABLE_TOKEN = 'patG3xfFhZGjGiXWt.8959878dca997d69972b237177713462c43fe7f385ab43d7d45ce500f104d703';
const AIRTABLE_BASE_ID = 'app7aGU54LVkhT1fd';
const AIRTABLE_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}`;

// State management
let participants = [];
let expenses = [];

// Initialize when the page loads
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

async function initialize() {
    await loadExpenses();
    updateUI();
}

// Handle different currency symbols
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
        // Save to Airtable
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

        // Add to local list if save was successful
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

// Load all expenses from Airtable
async function loadExpenses() {
    try {
        const response = await fetch(`${AIRTABLE_URL}/Expenses`, {
            headers: {
                'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to load expenses');
        }

        const data = await response.json();
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
        alert('Failed to load expenses. Please refresh the page.');
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
            `<div class="participant-item">${name}</div>`
        ).join('');
    }
    
    // Update the dropdown for who paid
    paidBySelect.innerHTML = '<option value="">Select who paid</option>' + 
        participants.map(name =>
            `<option value="${name}">${name}</option>`
        ).join('');
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
        // Show how the expense was split
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

// Update split amounts when they're changed
function updateSplits() {
    const amount = parseFloat(document.getElementById('expenseAmount').value) || 0;
    let total = 0;
    
    // Add up all splits except the last person
    participants.slice(0, -1).forEach(name => {
        const input = document.getElementById(`split-${name}`);
        const splitAmount = parseFloat(input.value) || 0;
        total += splitAmount;
    });

    // Auto-calculate last person's amount
    const lastParticipant = participants[participants.length - 1];
    if (lastParticipant) {
        const lastInput = document.getElementById(`split-${lastParticipant}`);
        const remainingAmount = parseFloat((amount - total).toFixed(2));
        lastInput.value = remainingAmount;
        
        // Show in red if it's negative
        if (remainingAmount < 0) {
            lastInput.style.color = 'red';
        } else {
            lastInput.style.color = '';
        }
    }
}

// Calculate who owes what to whom
function calculateSettlement() {
    const balances = {};
    const settlements = {};
    const totals = {};

    // Start everyone at zero for each currency
    participants.forEach(name => {
        balances[name] = {
            GBP: 0,
            EUR: 0,
            HKD: 0
        };
    });

    // Calculate everyone's balance
    expenses.forEach(e => {
        // Add to the person who paid
        balances[e.paidBy][e.currency] += e.amount;

        // Subtract from people who owe
        Object.entries(e.splits).forEach(([name, amount]) => {
            balances[name][e.currency] -= amount;
        });

        // Keep track of total expenses in each currency
        totals[e.currency] = (totals[e.currency] || 0) + e.amount;
    });

    // Figure out who needs to pay whom for each currency
    Object.keys(totals).forEach(currency => {
        const currencyBalances = {};
        settlements[currency] = [];

        // Get list of people who owe money or are owed money
        participants.forEach(name => {
            if (Math.abs(balances[name][currency]) > 0.01) {
                currencyBalances[name] = balances[name][currency];
            }
        });

        // Keep settling until everyone's paid up
        while (Object.keys(currencyBalances).length > 1) {
            const debtors = Object.entries(currencyBalances)
                .filter(([name, balance]) => balance < 0)
                .sort((a, b) => a[1] - b[1]);  // Biggest debts first

            const creditors = Object.entries(currencyBalances)
                .filter(([name, balance]) => balance > 0)
                .sort((a, b) => b[1] - a[1]);  // Biggest credits first

            if (debtors.length === 0 || creditors.length === 0) break;

            const [debtorName, debtorBalance] = debtors[0];
            const [creditorName, creditorBalance] = creditors[0];
            
            // Figure out how much to settle
            const amount = Math.min(-debtorBalance, creditorBalance);
            const roundedAmount = parseFloat(amount.toFixed(2));

            if (roundedAmount > 0) {
                settlements[currency].push({
                    from: debtorName,
                    to: creditorName,
                    amount: roundedAmount
                });
            }

            // Update the balances
            currencyBalances[debtorName] = parseFloat((debtorBalance + amount).toFixed(2));
            currencyBalances[creditorName] = parseFloat((creditorBalance - amount).toFixed(2));

            // Remove anyone who's all settled up
            if (Math.abs(currencyBalances[debtorName]) < 0.01) delete currencyBalances[debtorName];
            if (Math.abs(currencyBalances[creditorName]) < 0.01) delete currencyBalances[creditorName];
        }
    });

    return { settlements, totals };
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

    // Show who needs to pay whom
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
