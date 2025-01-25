class AirtableService {
    constructor() {
        this.apiKey = "patG3xfFhZGjGiXWt.8959878dca997d69972b237177713462c43fe7f385ab43d7d45ce500f104d703";
        this.baseId = "app7aGU54LVkhT1fd";
        this.tableName = "Expenses";
        this.url = `https://api.airtable.com/v0/${this.baseId}/${this.tableName}`;
    }

    async createRecord(fields) {
        try {
            // Match exact field names from Airtable
            const airtableFields = {
                Description: fields.Description,
                Amount: parseFloat(fields.Amount) || 0,
                Currency: fields.Currency || 'GBP',
                PaidBy: fields.PaidBy,
                Participants: fields.Participants, // Add Participants field
                Splits: fields.Splits,
                Date: fields.Date || new Date().toISOString().split('T')[0]
            };

            console.log('Sending to Airtable:', airtableFields);

            const response = await fetch(this.url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    records: [{
                        fields: airtableFields
                    }]
                })
            });

            const responseText = await response.text();
            console.log('Airtable Response:', response.status, responseText);

            if (!response.ok) {
                throw new Error(`Airtable Error: ${response.status} ${responseText}`);
            }

            return JSON.parse(responseText);
        } catch (error) {
            console.error('Detailed error:', error);
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
                const errorText = await response.text();
                throw new Error(`Failed to fetch records: ${response.status} ${errorText}`);
            }

            const data = await response.json();
            console.log('Successfully fetched records:', data);
            return data;
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

    try {
        // Create the record in Airtable
        const record = {
            Description: description,
            Amount: amount,
            Currency: currency,
            PaidBy: paidBy,
            Participants: JSON.stringify(participants), // Store participants list
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
    }
}

// Load all expenses from Airtable
async function loadExpenses() {
    try {
        const data = await airtableService.getAllRecords();
        
        if (data && data.records) {
            expenses = data.records.map(record => {
                try {
                    if (!record || !record.fields) return null;
                    
                    return {
                        id: record.id,
                        description: record.fields.Description || '',
                        amount: parseFloat(record.fields.Amount) || 0,
                        currency: record.fields.Currency || 'GBP',
                        paidBy: record.fields.PaidBy || '',
                        participants: JSON.parse(record.fields.Participants || '[]'),
                        splits: JSON.parse(record.fields.Splits || '{}'),
                        date: record.fields.Date || new Date().toISOString().split('T')[0]
                    };
                } catch (error) {
                    console.error('Error processing record:', error, record);
                    return null;
                }
            }).filter(expense => expense !== null);

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
        } else {
            console.log('No records found in response:', data);
            expenses = [];
            participants = [];
        }
    } catch (error) {
        console.error('Error loading expenses:', error);
        throw new Error('Failed to load expenses');
    }
}

// Clear the expense form
function clearExpenseForm() {
    document.getElementById('expenseDescription').value = '';
    document.getElementById('expenseAmount').value = '';
    document.getElementById('splitAmounts').style.display = 'none';
    document.getElementById('splitType').value = 'equal';
}

// Update all UI elements
function updateUI() {
    updateParticipantsList();
    updateExpensesList();
    updateSettlementSummary();
}

// Update participants list and dropdown
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
                <button onclick="removeParticipant('${name}')" class="remove-btn">×</button>
            </div>`
        ).join('');
    }
    
    // Update paid by select options
    paidBySelect.innerHTML = '<option value="">Select who paid</option>' + 
        participants.map(name =>
            `<option value="${name}">${name}</option>`
        ).join('');
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
            // Validate the expense object has all required properties
            if (!e || typeof e.amount !== 'number') {
                console.error('Invalid expense record:', e);
                return '';
            }

            // Format splits for display
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

    // Initialize balances with safeguards
    participants.forEach(name => {
        if (name) {  // Only create balance for valid names
            balances[name] = {
                GBP: 0,
                EUR: 0,
                HKD: 0
            };
        }
    });

    // Calculate balances for each expense with validation
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
        const currencyBalances = {};
        settlements[currency] = [];

        // Get non-zero balances
        participants.forEach(name => {
            if (name && balances[name] && Math.abs(balances[name][currency]) > 0.01) {
                currencyBalances[name] = balances[name][currency];
            }
        });

        // Calculate optimal settlements
        while (Object.keys(currencyBalances).length > 1) {
            // Find people who owe money (negative balance)
            const debtors = Object.entries(currencyBalances)
                .filter(([name, balance]) => balance < 0)
                .sort((a, b) => a[1] - b[1]); // Biggest debts first

            // Find people who are owed money (positive balance)
            const creditors = Object.entries(currencyBalances)
                .filter(([name, balance]) => balance > 0)
                .sort((a, b) => b[1] - a[1]); // Biggest credits first

            if (debtors.length === 0 || creditors.length === 0) break;

            const [debtorName, debtorBalance] = debtors[0];
            const [creditorName, creditorBalance] = creditors[0];
            
            // Calculate settlement amount
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

    return { settlements, totals, balances };
}

    // Calculate balances for each expense with validation
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

    // Rest of the settlement calculation logic...

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
    
    // Group settlements by participant
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
