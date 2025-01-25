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
    await loadParticipants();
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
async function addParticipant() {
    const nameInput = document.getElementById('participantName');
    const name = nameInput.value.trim();
    
    if (!name) return;

    try {
        const response = await fetch(`${AIRTABLE_URL}/Participants`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                fields: {
                    Name: name
                }
            })
        });

        if (response.ok) {
            const data = await response.json();
            participants.push({
                id: data.id,
                name: name
            });
            nameInput.value = '';
            updateUI();
        }
    } catch (error) {
        console.error('Error adding participant:', error);
        alert('Failed to add participant. Please try again.');
    }
}

async function loadParticipants() {
    try {
        const response = await fetch(`${AIRTABLE_URL}/Participants`, {
            headers: {
                'Authorization': `Bearer ${AIRTABLE_TOKEN}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            participants = data.records.map(record => ({
                id: record.id,
                name: record.fields.Name
            }));
        }
    } catch (error) {
        console.error('Error loading participants:', error);
        alert('Failed to load participants. Please refresh the page.');
    }
}

// Expenses management
async function addExpense() {
    const description = document.getElementById('expenseDescription').value;
    const amount = parseFloat(document.getElementById('expenseAmount').value);
    const currency = document.getElementById('currencySelect').value;
    const paidBy = document.getElementById('paidBy').value;
    const splitType = document.getElementById('splitType').value;

    if (!description || !amount || !paidBy) {
        alert('Please fill in all required fields');
        return;
    }

    let splits = {};
    if (splitType === 'equal') {
        const splitAmount = amount / participants.length;
        participants.forEach(p => {
            splits[p.id] = splitAmount;
        });
    } else {
        let total = 0;
        participants.forEach(p => {
            const input = document.getElementById(`split-${p.id}`);
            const splitAmount = parseFloat(input.value) || 0;
            splits[p.id] = splitAmount;
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
                fields: {
                    Description: description,
                    Amount: amount,
                    Currency: currency,
                    PaidBy: paidBy,
                    Splits: JSON.stringify(splits)
                }
            })
        });

        if (response.ok) {
            const data = await response.json();
            expenses.push({
                id: data.id,
                description,
                amount,
                currency,
                paidBy,
                splits
            });
            clearExpenseForm();
            updateUI();
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
                splits: JSON.parse(record.fields.Splits)
            }));
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
    updatePaidBySelect();
    updateExpensesList();
    updateSettlementSummary();
}

function updateParticipantsList() {
    const list = document.getElementById('participantsList');
    list.innerHTML = participants.map(p => 
        `<div>${p.name}</div>`
    ).join('');
}

function updatePaidBySelect() {
    const select = document.getElementById('paidBy');
    select.innerHTML = participants.map(p =>
        `<option value="${p.id}">${p.name}</option>`
    ).join('');
}

function updateExpensesList() {
    const list = document.getElementById('expensesList');
    list.innerHTML = expenses.map(e => {
        const paidBy = participants.find(p => p.id === e.paidBy)?.name;
        return `
            <div class="expense-item">
                <div>${e.description}</div>
                <div>${getCurrencySymbol(e.currency)}${e.amount.toFixed(2)}</div>
                <div>Paid by: ${paidBy}</div>
            </div>
        `;
    }).join('');
}

function calculateSettlement() {
    const balances = {};
    const settlements = {};
    const totals = {};

    // Initialize balances for each currency
    participants.forEach(p => {
        balances[p.id] = {
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
        Object.entries(e.splits).forEach(([participantId, amount]) => {
            balances[participantId][e.currency] -= amount;
        });

        // Update totals
        totals[e.currency] = (totals[e.currency] || 0) + e.amount;
    });

    // Calculate settlements for each currency
    Object.keys(totals).forEach(currency => {
        const currencyBalances = {};
        settlements[currency] = [];

        // Get non-zero balances for this currency
        participants.forEach(p => {
            if (Math.abs(balances[p.id][currency]) > 0.01) {
                currencyBalances[p.id] = balances[p.id][currency];
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

            const [debtorId, debtorBalance] = debtors[0];
            const [creditorId, creditorBalance] = creditors[0];

            const amount = Math.min(-debtorBalance, creditorBalance);

            settlements[currency].push({
                from: participants.find(p => p.id === debtorId).name,
                to: participants.find(p => p.id === creditorId).name,
                amount: Math.abs(amount)
            });

            currencyBalances[debtorId] += amount;
            currencyBalances[creditorId] -= amount;

            // Remove settled balances
            if (Math.abs(currencyBalances[debtorId]) < 0.01) delete currencyBalances[debtorId];
            if (Math.abs(currencyBalances[creditorId]) < 0.01) delete currencyBalances[creditorId];
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

function toggleSplitInputs() {
    const splitType = document.getElementById('splitType').value;
    const splitAmounts = document.getElementById('splitAmounts');
    const amount = parseFloat(document.getElementById('expenseAmount').value) || 0;
    
    if (splitType === 'manual') {
        splitAmounts.style.display = 'block';
        const equalSplit = amount / participants.length;
        
        splitAmounts.innerHTML = participants.map(p => `
            <div>
                <label>${p.name}</label>
                <input type="number" id="split-${p.id}" 
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
    
    participants.slice(0, -1).forEach(p => {
        const input = document.getElementById(`split-${p.id}`);
        total += parseFloat(input.value) || 0;
    });

    // Auto-calculate last participant's amount
    const lastParticipant = participants[participants.length - 1];
    if (lastParticipant) {
        const lastInput = document.getElementById(`split-${lastParticipant.id}`);
        lastInput.value = (amount - total).toFixed(2);
    }
}
