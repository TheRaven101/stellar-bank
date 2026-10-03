const authModal = document.getElementById('authModal');
const authTitle = document.getElementById('authTitle');
const authForm = document.getElementById('authForm');
const authMessage = document.getElementById('authMessage');
const openAuth = document.getElementById('openAuth');
const heroSignIn = document.getElementById('heroSignIn');
const heroDemo = document.getElementById('heroDemo');
const footerLogin = document.getElementById('footerLogin');
const closeModal = document.getElementById('closeModal');
const registerNameGroup = document.getElementById('registerNameGroup');
const registerName = document.getElementById('registerName');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const submitAuth = document.getElementById('submitAuth');
const dashboardShell = document.getElementById('dashboardShell');
const logoutBtn = document.getElementById('logoutBtn');
const greetingName = document.getElementById('greetingName');
const totalBalance = document.getElementById('totalBalance');
const availableCash = document.getElementById('availableCash');
const accountCount = document.getElementById('accountCount');
const cardCount = document.getElementById('cardCount');
const accountsList = document.getElementById('accountsList');
const cardsList = document.getElementById('cardsList');
const transactionList = document.getElementById('transactionList');
const transferForm = document.getElementById('transferForm');
const transferMessage = document.getElementById('transferMessage');
const fromAccount = document.getElementById('fromAccount');
const toAccount = document.getElementById('toAccount');
const transferAmount = document.getElementById('transferAmount');
const transferNote = document.getElementById('transferNote');

let authMode = 'login';
let currentUser = null;
let authToken = localStorage.getItem('stellarBankToken') || '';

function setMessage(text, type = '') {
  authMessage.textContent = text;
  authMessage.className = 'auth-message';
  if (type) {
    authMessage.classList.add(type);
  }
}

function setTransferMessage(text, type = '') {
  transferMessage.textContent = text;
  transferMessage.className = 'auth-message';
  if (type) {
    transferMessage.classList.add(type);
  }
}

function openAuthModal(mode = 'login') {
  authMode = mode;
  authModal.classList.remove('hidden');

  const isRegister = mode === 'register';
  registerNameGroup.classList.toggle('hidden', !isRegister);
  authTitle.textContent = isRegister ? 'Create your account' : 'Welcome back';
  submitAuth.textContent = isRegister ? 'Create account' : 'Sign In';

  document.querySelectorAll('.tab-button').forEach((button) => {
    button.classList.toggle('active', button.dataset.mode === mode);
  });

  setMessage('');
}

function closeAuthModal() {
  authModal.classList.add('hidden');
}

function handleTabClick(event) {
  openAuthModal(event.target.dataset.mode);
}

async function handleAuthSubmit(event) {
  event.preventDefault();

  const payload = {
    email: emailInput.value.trim(),
    password: passwordInput.value.trim()
  };

  if (authMode === 'register') {
    payload.name = registerName.value.trim();
  }

  if (!payload.email || !payload.password || (authMode === 'register' && !payload.name)) {
    setMessage('Please complete all required fields.', 'error');
    return;
  }

  try {
    const response = await fetch(`/api/auth/${authMode}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      setMessage(data.message || 'Authentication failed.', 'error');
      return;
    }

    authToken = data.token;
    localStorage.setItem('stellarBankToken', authToken);
    currentUser = data.user;
    closeAuthModal();
    await loadDashboard();
  } catch (error) {
    setMessage('Unable to reach the server. Please try again.', 'error');
  }
}

async function loadDashboard() {
  try {
    const response = await fetch('/api/dashboard', {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    if (!response.ok) {
      throw new Error('Not authenticated');
    }

    const data = await response.json();
    currentUser = data.user;
    renderDashboard(data);
    dashboardShell.classList.remove('hidden');
  } catch (error) {
    authToken = '';
    localStorage.removeItem('stellarBankToken');
    dashboardShell.classList.add('hidden');
    openAuthModal('login');
  }
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(Number(value || 0));
}

function renderDashboard(data) {
  const { user, totalBalance, accounts, cards, recentTransactions } = data;

  greetingName.textContent = user.name;
  totalBalance.textContent = formatCurrency(totalBalance);
  availableCash.textContent = formatCurrency(totalBalance);
  accountCount.textContent = accounts.length;
  cardCount.textContent = cards.length;

  accountsList.innerHTML = accounts
    .map(
      (account) => `
        <div class="account-item">
          <div class="account-detail">
            <h4>${account.label}</h4>
            <div class="account-number">${account.type} • ${account.number}</div>
          </div>
          <div class="account-balance">
            <strong>${formatCurrency(account.balance)}</strong>
          </div>
        </div>
      `
    )
    .join('');

  cardsList.innerHTML = cards
    .map(
      (card) => `
        <div class="card-item">
          <div style="display:flex; align-items:center; gap:12px;">
            <div class="card-chip"></div>
            <div>
              <h4>${card.label}</h4>
              <div class="card-meta-text">${card.network} •••• ${card.last4}</div>
            </div>
          </div>
          <div class="card-meta-text">${card.status}</div>
        </div>
      `
    )
    .join('');

  transactionList.innerHTML = recentTransactions
    .map(
      (transaction) => `
        <div class="transaction-item">
          <div class="transaction-main">
            <strong>${transaction.title}</strong>
            <span class="transaction-note">${new Date(transaction.date).toLocaleDateString()} • ${transaction.note || 'No note'}</span>
          </div>
          <div class="transaction-money ${transaction.type === 'credit' ? 'credit' : 'debit'}">
            ${transaction.type === 'credit' ? '+' : '-'}${formatCurrency(transaction.amount)}
          </div>
        </div>
      `
    )
    .join('');

  renderAccountOptions(accounts);
}

function renderAccountOptions(accounts) {
  const options = accounts
    .map((account) => `<option value="${account.id}">${account.label} (${account.number})</option>`)
    .join('');

  fromAccount.innerHTML = options;
  toAccount.innerHTML = options;

  if (accounts.length > 1) {
    toAccount.selectedIndex = 1;
  }
}

async function handleTransferSubmit(event) {
  event.preventDefault();

  const payload = {
    fromAccountId: fromAccount.value,
    toAccountId: toAccount.value,
    amount: Number(transferAmount.value),
    note: transferNote.value.trim()
  };

  if (!payload.fromAccountId || !payload.toAccountId || !payload.amount) {
    setTransferMessage('Choose valid accounts and enter an amount.', 'error');
    return;
  }

  if (payload.fromAccountId === payload.toAccountId) {
    setTransferMessage('Please choose different source and destination accounts.', 'error');
    return;
  }

  try {
    const response = await fetch('/api/transfer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      setTransferMessage(data.message || 'Transfer failed.', 'error');
      return;
    }

    transferForm.reset();
    setTransferMessage('Transfer completed successfully.', 'success');
    await loadDashboard();
  } catch (error) {
    setTransferMessage('Unable to complete transfer at this time.', 'error');
  }
}

function logout() {
  localStorage.removeItem('stellarBankToken');
  authToken = '';
  dashboardShell.classList.add('hidden');
  openAuthModal('login');
}

openAuth.addEventListener('click', () => openAuthModal('login'));
heroSignIn.addEventListener('click', () => openAuthModal('login'));
heroDemo.addEventListener('click', () => {
  if (!authToken) {
    openAuthModal('login');
    return;
  }
  loadDashboard();
});
footerLogin.addEventListener('click', () => openAuthModal('login'));
closeModal.addEventListener('click', closeAuthModal);
document.querySelectorAll('.tab-button').forEach((button) => button.addEventListener('click', handleTabClick));
authForm.addEventListener('submit', handleAuthSubmit);
logoutBtn.addEventListener('click', logout);
transferForm.addEventListener('submit', handleTransferSubmit);

if (authToken) {
  loadDashboard();
}
