// Airtable configuration
const AIRTABLE_TOKEN = 'patG3xfFhZGjGiXWt.8959878dca997d69972b237177713462c43fe7f385ab43d7d45ce500f104d703';
const AIRTABLE_BASE_ID = 'app7aGU54LVkhT1fd';
const AIRTABLE_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}`;

// State management
let participants = [];
let expenses = [];

// Initialize on page load
document.addEventListener('DOMContentLoaded', initialize);

async function initialize() {
    await loadExpenses();
    updateUI();
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

// Participants management
function addParticipant() {
    const nameInput = document.getElementById('participantName');
    const name = nameInput.value.trim();
    
    if (!name) return;
    
    if (!participants.includes(name)) {
        participants.push(name);
        nameInput.value = '';
        updateUI();
    } else {
        alert('This participant has already been added.');
    }
}

function updateParticipantsList() {
    const list = document.getElementById('participantsList');
    list.innerHTML = participants.map(name => 
        `<div class="participant-item">${name}</div>`
    ).join('');
    
    // Update the paid by select options
    const paidBySelect = document.getElementById('paidBy');
    paidBySelect.innerHTML = participants.map(name =>
        `<option value="${name}">${name}</option>`
    ).join('');
}

// Expense management
async function addExpense() {
    const description = document.getElementById('expenseDescription').value;
    const amount = parseFloat(document.getElementById('expenseAmount').value);
    const currency = document.getElementById('currencySelect').value;
    const paidBy = document.getElementById('paidBy').value;
    const splitType = document.getElementById('splitType').value;
    const date = new Date().toISOString().split('T')[0]; // Today's date

    if (!description || !amount || !paidBy || participants.length === 0) {
        alert('Please fill in all required fields and add at least one participant');
        return;
    }

    let splits = {};
    if (splitType === 'equal') {
        const splitAmount = amount / participants.length;
        participants.forEach(name => {
            splits[name] = splitAmount;
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

        if (response.ok) {
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
        } else {
            throw new Error('Failed to save expense');
        }
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

        if (response.ok) {
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
        }
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

function updateExpensesList() {
    const list = document.getElementById('expensesList');
    list.innerHTML = expenses.map(e => {
        return `
            <div class="expense-item">
                <div><strong>${e.description}</strong></div>
                <div>${getCurrencySymbol(e.currency)}${e.amount.toFixed(2)}</div>
                <div>Paid by: ${e.paidBy}</div>
                <div>Date: ${e.date}</div>
            </div>
        `;
    }).join('');
}

function toggleSplitInputs() {
    const splitType = document.getElementById('splitType').value;
    const splitAmounts = document.getElementById('splitAmounts');
    const amount = parseFloat(document.getElementById('expenseAmount').value) || 0;
    
    if (splitType === 'manual') {
        splitAmounts.style.display = 'block';
        const equalSplit = amount / participants.length;
        
        splitAmounts.innerHTML = participants.map(name => `
            <div>
                <label>${name}</label>
                <input type="number" id="split-${name}" 
                       value="${equalSplit.toFixed(2)}" 
                       step="0.01"
                       onchange="updateSplits()">
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
        total += parseFloat(input.value) || 0;
    });

    // Auto-calculate last participant's amount
    const lastParticipant = participants[participants.length - 1];
    if (lastParticipant) {
        const lastInput = document.getElementById(`split-${lastParticipant}`);
        lastInput.value = (amount - total).toFixed(2);
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
        // Add to payer's balance
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
                .filter(([_, balance]) => balance < 0)
                .sort(([_, a], [_, b]) => a - b);
            const creditors = Object.entries(currencyBalances)
                .filter(([_, balance]) => balance > 0)
                .sort(([_, a], [_, b]) => b - a);

            if (debtors.length === 0 || creditors.length === 0) break;

            const [debtorName, debtorBalance] = debtors[0];
            const [creditorName, creditorBalance] = creditors[0];

            const amount = Math.min(-debtorBalance, creditorBalance);

            settlements[currency].push({
                from: debtorName,
                to: creditorName,
                amount: Math.abs(amount)
            });

            currencyBalances[debtorName] += amount;
            currencyBalances[creditorName] -= amount;

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
    totalsDiv.innerHTML = Object.entries(summary.totals).map(([currency, total]) =>
        `<div>Total ${currency}: ${getCurrencySymbol(currency)}${total.toFixed(2)}</div>`
    ).join('');

    // Update settlement details
    summaryDiv.innerHTML = Object.entries(summary.settlements).map(([currency, settlements]) =>
        settlements.map(s =>
            `<div>${s.from} pays ${s.to} ${getCurrencySymbol(currency)}${s.amount.toFixed(2)}</div>`
        ).join('')
    ).join('');
}
