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
            // Log the data we're about to send
            console.log('Sending to Airtable:', fields);

            const response = await fetch(this.url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    records: [{
                        fields: {
                            // Ensure field names match exactly what's in Airtable
                            Description: fields.Description || '',
                            Amount: Number(fields.Amount) || 0,
                            Currency: fields.Currency || 'GBP',
                            PaidBy: fields.PaidBy || '',
                            Date: fields.Date || new Date().toISOString().split('T')[0],
                            Splits: fields.Splits || '{}',
                            Participants: fields.Participants || '[]'
                        }
                    }]
                })
            });

            // Log the response status
            console.log('Airtable response status:', response.status);

            const responseText = await response.text();
            console.log('Airtable response:', responseText);

            if (!response.ok) {
                throw new Error(`Failed to create record: ${response.status} - ${responseText}`);
            }

            return JSON.parse(responseText);
        } catch (error) {
            console.error('Detailed error creating record:', error);
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
                throw new Error(`Failed to fetch records: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            console.log('Successfully fetched records:', data);
            return data;
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
                const errorText = await response.text();
                throw new Error(`Failed to delete record: ${response.status} - ${errorText}`);
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
                    fields: {
                        Description: fields.Description || '',
                        Amount: Number(fields.Amount) || 0,
                        Currency: fields.Currency || 'GBP',
                        PaidBy: fields.PaidBy || '',
                        Date: fields.Date || new Date().toISOString().split('T')[0],
                        Splits: fields.Splits || '{}',
                        Participants: fields.Participants || '[]'
                    }
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to update record: ${response.status} - ${errorText}`);
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

// Participant management
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
    updatePresentParticipants(); // Update checkboxes when adding new participant
}

// Update present participants checkboxes
function updatePresentParticipants() {
    const container = document.getElementById('presentParticipants');
    container.innerHTML = participants.map(name => `
        <div class="checkbox-item">
            <input type="checkbox" 
                   id="present-${name}" 
                   value="${name}" 
                   checked
                   onchange="updateSplitAmounts()">
            <label for="present-${name}">${name}</label>
        </div>
    `).join('');
}

// Get present participants
function getPresentParticipants() {
    return participants.filter(name => 
        document.getElementById(`present-${name}`)?.checked
    );
}

// Load expenses from Airtable
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
            updatePresentParticipants(); // Initialize checkboxes after loading
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

    const presentParticipants = getPresentParticipants();
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
            total += splitAmount;
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
            PresentParticipants: JSON.stringify(presentParticipants),
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

// Clear the expense form
function clearExpenseForm() {
    document.getElementById('expenseDescription').value = '';
    document.getElementById('expenseAmount').value = '';
    document.getElementById('splitAmounts').style.display = 'none';
    document.getElementById('splitType').value = 'equal';
    document.getElementById('addExpenseBtn').textContent = 'Add Expense';
    currentEditId = null;

    // Reset present participants
    updatePresentParticipants();

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
    updatePresentParticipants(); // Update checkboxes after removing participant
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

            // Format splits display with present participants highlighted
            const splitsDisplay = Object.entries(e.splits || {})
                .map(([name, amount]) => {
                    const splitAmount = parseFloat(amount) || 0;
                    const isPresent = e.presentParticipants?.includes(name);
                    return `<div class="split-item ${isPresent ? 'present' : 'not-present'}">
                        <span class="split-name">${name}:</span> 
                        <span class="split-amount">${getCurrencySymbol(e.currency)}${splitAmount.toFixed(2)}</span>
                    </div>`;
                })
                .join('');

            // Format present participants list
            const presentList = e.presentParticipants?.length 
                ? `<div class="present-participants">Present: ${e.presentParticipants.join(', ')}</div>` 
                : '';

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
                    ${presentList}
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

// Handle split type toggle
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
                               onchange="updateSplitAmounts()"
                               ${!isPresent ? 'disabled' : ''}>
                    </div>
                </div>
            `;
        }).join('');
    } else {
        splitAmounts.style.display = 'none';
    }
    updateSplitAmounts();
}

// Update split amounts
function updateSplitAmounts() {
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

    // Disable inputs for non-present participants and set their values to 0
    participants.forEach(name => {
        const input = document.getElementById(`split-${name}`);
        if (input && !presentParticipants.includes(name)) {
            input.value = '0.00';
            input.disabled = true;
        }
    });
}

// Update settlement summary display
function updateSettlementSummary() {
    const summary = calculateSettlement();
    const summaryDiv = document.getElementById('settlementSummary');
    let settlementHtml = '';

    // Group settlements by participant and currency
    participants.forEach(person => {
        const personSettlements = {
            EUR: { pay: [], receive: [] },
            GBP: { pay: [], receive: [] },
            HKD: { pay: [], receive: [] }
        };

        // Collect all settlements for this person
        Object.entries(summary.settlements).forEach(([currency, settlements]) => {
            settlements.forEach(s => {
                if (s.from === person) {
                    personSettlements[currency].pay.push({
                        person: s.to,
                        amount: s.amount
                    });
                }
                if (s.to === person) {
                    personSettlements[currency].receive.push({
                        person: s.from,
                        amount: s.amount
                    });
                }
            });
        });

        // Only show this person's section if they have settlements
        const hasSettlements = Object.values(personSettlements).some(
            curr => curr.pay.length > 0 || curr.receive.length > 0
        );

        if (hasSettlements) {
            settlementHtml += `
                <div class="settlement-section">
                    <h3>${person}'s Settlements</h3>
                    <div class="settlement-tables">`;

            // Show settlements for each currency if they exist
            ['EUR', 'GBP', 'HKD'].forEach(currency => {
                const currencyData = personSettlements[currency];
                if (currencyData.pay.length > 0 || currencyData.receive.length > 0) {
                    settlementHtml += `
                        <div class="currency-group">
                            <h4>${currency} Settlements</h4>
                            <table class="settlement-table">
                                <tbody>`;
                    
                    // Outgoing payments
                    currencyData.pay.forEach(payment => {
                        settlementHtml += `
                            <tr class="payment-row">
                                <td class="direction">Pay:</td>
                                <td class="person">${payment.person}</td>
                                <td class="amount">${getCurrencySymbol(currency)}${payment.amount.toFixed(2)}</td>
                            </tr>`;
                    });

                    // Incoming payments
                    currencyData.receive.forEach(payment => {
                        settlementHtml += `
                            <tr class="receive-row">
                                <td class="direction">Receive from:</td>
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

// Format date for display
function formatDate(dateString) {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
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

    // Update present participants checkboxes
    updatePresentParticipants();
    expense.presentParticipants?.forEach(name => {
        const checkbox = document.getElementById(`present-${name}`);
        if (checkbox) {
            checkbox.checked = true;
        }
    });

    // Show split amounts
    document.getElementById('splitType').value = 'manual';
    toggleSplitInputs();
    Object.entries(expense.splits).forEach(([name, amount]) => {
        const input = document.getElementById(`split-${name}`);
        if (input) {
            input.value = amount;
            input.disabled = !expense.presentParticipants?.includes(name);
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
    const presentParticipants = getPresentParticipants();

    // Validation
    if (!description || !amount || !paidBy) {
        alert('Please fill in all required fields');
        return;
    }

    if (presentParticipants.length === 0) {
        alert('Please select at least one present participant');
        return;
    }

    // Calculate splits
    let splits = {};
    let total = 0;
    presentParticipants.forEach(name => {
        const input = document.getElementById(`split-${name}`);
        const splitAmount = parseFloat(input.value) || 0;
        splits[name] = splitAmount;
        total += splitAmount;
    });

    if (Math.abs(total - amount) > 0.01) {
        alert('Split amounts must equal the total expense amount');
        return;
    }

    showLoading();
    try {
        const updatedFields = {
            Description: description,
            Amount: amount,
            Currency: currency,
            PaidBy: paidBy,
            Participants: JSON.stringify(participants),
            PresentParticipants: JSON.stringify(presentParticipants),
            Splits: JSON.stringify(splits),
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
                    participants: [...participants],
                    presentParticipants: [...presentParticipants],
                    splits
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
    if (!participants.length || !expenses.length) {
        return { settlements: {}, totals: {}, balances: {} };
    }

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

    // First, calculate the net amount each person owes/is owed for each expense
    expenses.forEach(expense => {
        const { currency, amount, paidBy, splits, presentParticipants } = expense;
        
        if (!currency || !amount || !paidBy || !splits || !presentParticipants) return;
        
        // Add to total expenses in this currency
        totals[currency] = (totals[currency] || 0) + amount;

        // Only handle splits between people who were present
        presentParticipants.forEach(participant => {
            if (participant === paidBy) {
                // The payer's balance increases by what others owe them
                const othersOwe = Object.entries(splits)
                    .filter(([name, _]) => name !== paidBy && presentParticipants.includes(name))
                    .reduce((sum, [_, amount]) => sum + amount, 0);
                balances[paidBy][currency] = (balances[paidBy][currency] || 0) + othersOwe;
            } else {
                // Others owe their share to the payer
                const share = splits[participant] || 0;
                balances[participant][currency] = (balances[participant][currency] || 0) - share;
            }
        });
    });

    // For each currency, create the most efficient settlements
    Object.keys(totals).forEach(currency => {
        settlements[currency] = [];
        
        // Get all participants who have non-zero balances in this currency
        const debtors = [];
        const creditors = [];
        
        participants.forEach(name => {
            const balance = balances[name][currency];
            if (Math.abs(balance) > 0.01) {
                if (balance < 0) {
                    debtors.push([name, -balance]);  // Convert to positive amount for easier handling
                } else {
                    creditors.push([name, balance]);
                }
            }
        });

        // Sort by amount (largest first) to handle larger debts first
        debtors.sort((a, b) => b[1] - a[1]);
        creditors.sort((a, b) => b[1] - a[1]);

        // Create settlements
        while (debtors.length > 0 && creditors.length > 0) {
            const [debtorName, debtAmount] = debtors[0];
            const [creditorName, creditAmount] = creditors[0];

            const amount = Math.min(debtAmount, creditAmount);
            const roundedAmount = parseFloat(amount.toFixed(2));

            if (roundedAmount > 0.01) {
                settlements[currency].push({
                    from: debtorName,
                    to: creditorName,
                    amount: roundedAmount
                });
            }

            // Update remaining amounts
            if (debtAmount - amount < 0.01) {
                debtors.shift();
            } else {
                debtors[0][1] = parseFloat((debtAmount - amount).toFixed(2));
            }

            if (creditAmount - amount < 0.01) {
                creditors.shift();
            } else {
                creditors[0][1] = parseFloat((creditAmount - amount).toFixed(2));
            }
        }
    });

    return { settlements, totals, balances };
}
