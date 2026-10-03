const express = require('express');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'stellar-bank-demo-secret';
const DATA_FILE = path.join(__dirname, 'data', 'store.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function ensureDataFile() {
  const directory = path.dirname(DATA_FILE);
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }

  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ users: [] }, null, 2));
  }
}

function readStore() {
  ensureDataFile();
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function writeStore(store) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
}

function generateAccountNumber() {
  return `SB-${Math.floor(100000 + Math.random() * 900000)}`;
}

function sanitizeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    accounts: user.accounts,
    cards: user.cards,
    transactions: user.transactions
  };
}

function createToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

function createDemoUser() {
  const passwordHash = bcrypt.hashSync('Password123!', 10);
  const now = new Date().toISOString();

  const demoUser = {
    id: 'user_ava',
    name: 'Ava Thompson',
    email: 'ava@stellarbank.com',
    passwordHash,
    accounts: [
      {
        id: 'acc_checking_1',
        type: 'Checking',
        label: 'Primary Checking',
        number: generateAccountNumber(),
        balance: 48250.73,
        currency: 'USD'
      },
      {
        id: 'acc_savings_1',
        type: 'Savings',
        label: 'Emergency Savings',
        number: generateAccountNumber(),
        balance: 128950.4,
        currency: 'USD'
      }
    ],
    cards: [
      {
        id: 'card_platinum_1',
        label: 'Platinum Visa',
        last4: '4821',
        network: 'Visa',
        status: 'Active',
        spendLimit: 5000,
        expiry: '10/29'
      }
    ],
    transactions: [
      {
        id: 'txn_1',
        type: 'credit',
        title: 'Payroll Deposit',
        amount: 6200,
        accountId: 'acc_checking_1',
        date: now,
        note: 'Monthly salary'
      },
      {
        id: 'txn_2',
        type: 'debit',
        title: 'Mortgage Payment',
        amount: 1850,
        accountId: 'acc_checking_1',
        date: new Date(Date.now() - 86400000).toISOString(),
        note: 'Property financing'
      },
      {
        id: 'txn_3',
        type: 'credit',
        title: 'Savings Transfer',
        amount: 2500,
        accountId: 'acc_savings_1',
        date: new Date(Date.now() - 172800000).toISOString(),
        note: 'Monthly transfer'
      },
      {
        id: 'txn_4',
        type: 'debit',
        title: 'Groceries',
        amount: 218.47,
        accountId: 'acc_checking_1',
        date: new Date(Date.now() - 259200000).toISOString(),
        note: 'Fresh Market'
      }
    ]
  };

  return demoUser;
}

function seedDataIfNeeded() {
  const store = readStore();
  if (!store.users || store.users.length === 0) {
    store.users = [createDemoUser()];
    writeStore(store);
  }
}

function getUserById(userId) {
  const store = readStore();
  return store.users.find((user) => user.id === userId) || null;
}

function findUserByEmail(email) {
  const store = readStore();
  return store.users.find((user) => user.email.toLowerCase() === email.toLowerCase()) || null;
}

function updateUser(user) {
  const store = readStore();
  const index = store.users.findIndex((entry) => entry.id === user.id);
  if (index === -1) return false;
  store.users[index] = user;
  writeStore(store);
  return true;
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'Stellar Bank', version: '1.0.0' });
});

app.post('/api/auth/register', (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email, and password are required' });
  }

  if (password.length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters' });
  }

  const store = readStore();
  const existingUser = store.users.find((user) => user.email.toLowerCase() === email.toLowerCase());
  if (existingUser) {
    return res.status(409).json({ message: 'An account with this email already exists' });
  }

  const newUser = {
    id: uuidv4(),
    name,
    email,
    passwordHash: bcrypt.hashSync(password, 10),
    accounts: [
      {
        id: uuidv4(),
        type: 'Checking',
        label: 'Main Checking',
        number: generateAccountNumber(),
        balance: 2500,
        currency: 'USD'
      }
    ],
    cards: [
      {
        id: uuidv4(),
        label: 'Digital Debit',
        last4: '0001',
        network: 'Visa',
        status: 'Active',
        spendLimit: 2000,
        expiry: '08/28'
      }
    ],
    transactions: [
      {
        id: uuidv4(),
        type: 'credit',
        title: 'Opening Deposit',
        amount: 2500,
        accountId: null,
        date: new Date().toISOString(),
        note: 'Initial deposit'
      }
    ]
  };

  newUser.accounts[0].id = newUser.accounts[0].id;
  newUser.transactions[0].accountId = newUser.accounts[0].id;

  store.users.push(newUser);
  writeStore(store);

  const token = createToken(newUser);
  return res.status(201).json({
    token,
    user: sanitizeUser(newUser)
  });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  const user = findUserByEmail(email);
  if (!user) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  const validPassword = bcrypt.compareSync(password, user.passwordHash);
  if (!validPassword) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  const token = createToken(user);
  return res.json({ token, user: sanitizeUser(user) });
});

app.get('/api/me', authMiddleware, (req, res) => {
  const user = getUserById(req.userId);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }
  return res.json({ user: sanitizeUser(user) });
});

app.get('/api/dashboard', authMiddleware, (req, res) => {
  const user = getUserById(req.userId);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  const totalBalance = user.accounts.reduce((sum, account) => sum + Number(account.balance), 0);
  const recentTransactions = [...user.transactions].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 6);

  res.json({
    user: sanitizeUser(user),
    totalBalance,
    accounts: user.accounts,
    cards: user.cards,
    recentTransactions
  });
});

app.get('/api/transactions', authMiddleware, (req, res) => {
  const user = getUserById(req.userId);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  const sorted = [...user.transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
  res.json({ transactions: sorted });
});

app.post('/api/transfer', authMiddleware, (req, res) => {
  const { fromAccountId, toAccountId, amount, note } = req.body;
  const user = getUserById(req.userId);

  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  if (!fromAccountId || !toAccountId || !amount) {
    return res.status(400).json({ message: 'Source account, destination account, and amount are required' });
  }

  const parsedAmount = Number(amount);
  if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ message: 'Amount must be greater than zero' });
  }

  const fromAccount = user.accounts.find((account) => account.id === fromAccountId);
  const toAccount = user.accounts.find((account) => account.id === toAccountId);

  if (!fromAccount || !toAccount) {
    return res.status(400).json({ message: 'Account not found' });
  }

  if (fromAccount.id === toAccount.id) {
    return res.status(400).json({ message: 'Choose a different destination account' });
  }

  if (fromAccount.balance < parsedAmount) {
    return res.status(400).json({ message: 'Insufficient funds for this transfer' });
  }

  fromAccount.balance = Number((fromAccount.balance - parsedAmount).toFixed(2));
  toAccount.balance = Number((toAccount.balance + parsedAmount).toFixed(2));

  const transferId = uuidv4();
  const transferNote = note || 'Internal transfer';

  user.transactions.unshift({
    id: transferId,
    type: 'debit',
    title: `Transfer to ${toAccount.label}`,
    amount: parsedAmount,
    accountId: fromAccount.id,
    date: new Date().toISOString(),
    note: transferNote
  });

  user.transactions.unshift({
    id: uuidv4(),
    type: 'credit',
    title: `Transfer from ${fromAccount.label}`,
    amount: parsedAmount,
    accountId: toAccount.id,
    date: new Date().toISOString(),
    note: transferNote
  });

  updateUser(user);

  res.status(200).json({
    message: 'Transfer completed successfully',
    user: sanitizeUser(user),
    transfer: {
      fromAccountId: fromAccount.id,
      toAccountId: toAccount.id,
      amount: parsedAmount,
      note: transferNote
    }
  });
});

app.get('/api/accounts', authMiddleware, (req, res) => {
  const user = getUserById(req.userId);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }
  res.json({ accounts: user.accounts });
});

app.get('/api/cards', authMiddleware, (req, res) => {
  const user = getUserById(req.userId);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }
  res.json({ cards: user.cards });
});

app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

seedDataIfNeeded();

app.listen(PORT, () => {
  console.log(`Stellar Bank is running on http://localhost:${PORT}`);
});
