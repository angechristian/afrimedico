const express = require('express');
const cors = require('cors');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const { randomBytes, randomUUID, scrypt, timingSafeEqual, createHash } = require('crypto');
const { promisify } = require('util');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 4000;
const DB_PATH = process.env.AFRIMEDICO_DB_PATH || path.join(__dirname, 'data.sqlite');
const uploadsDir = process.env.AFRIMEDICO_UPLOADS_DIR || path.join(__dirname, 'uploads');
const SESSION_TTL = 12 * 60 * 60 * 1000;
const PASSWORD_MIN_LENGTH = 12;
const scryptAsync = promisify(scrypt);
const orderStatuses = ['Submitted', 'Confirmed', 'Processing', 'Dispatched', 'Delivered', 'Cancelled'];

fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({
  dest: uploadsDir,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter(req, file, callback) {
    const allowedTypes = new Map([
      ['.pdf', 'application/pdf'],
      ['.jpg', 'image/jpeg'],
      ['.jpeg', 'image/jpeg'],
      ['.png', 'image/png']
    ]);
    const extension = path.extname(file.originalname || '').toLowerCase();
    if (allowedTypes.get(extension) !== file.mimetype) {
      callback(new Error('Upload a PDF, JPEG or PNG pharmacy document.'));
      return;
    }
    callback(null, true);
  }
});

const sampleProducts = [
  { id: 'amoxicillin', name: 'Amoxicillin 500 mg capsules', category: 'Medicines', pack: 'Box of 100', price: 6500, stock: 'In stock', mark: 'Rx' },
  { id: 'paracetamol', name: 'Paracetamol 500 mg tablets', category: 'Medicines', pack: 'Box of 1,000', price: 9800, stock: 'In stock', mark: '500' },
  { id: 'ors', name: 'Oral rehydration salts', category: 'Medicines', pack: 'Carton of 100 sachets', price: 12000, stock: 'In stock', mark: 'ORS' },
  { id: 'oximeter', name: 'Pulse oximeter, fingertip', category: 'Equipment', pack: 'Each', price: 18500, stock: 'Low stock', mark: 'O₂' },
  { id: 'malaria-kit', name: 'Malaria rapid test kit', category: 'Laboratory', pack: 'Box of 50 tests', price: 28000, stock: 'In stock', mark: 'RDT' },
  { id: 'gloves', name: 'Nitrile examination gloves', category: 'Consumables', pack: 'Box of 100', price: 7500, stock: 'In stock', mark: 'N' },
  { id: 'masks', name: '3-ply surgical masks', category: 'Consumables', pack: 'Box of 50', price: 3200, stock: 'In stock', mark: '3P' },
  { id: 'syringes', name: 'Syringes 5 ml with needle', category: 'Consumables', pack: 'Box of 100', price: 5400, stock: 'Low stock', mark: '5ml' },
  { id: 'oxygen-refill', name: 'Oxygen cylinder refill, 40 L', category: 'Oxygen', pack: 'Per cylinder', price: 35000, stock: 'In stock', mark: 'O₂' },
  { id: 'flowmeter', name: 'Oxygen flowmeter with humidifier', category: 'Oxygen', pack: 'Each', price: 45000, stock: 'In stock', mark: 'L/min' }
];

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
const db = new sqlite3.Database(DB_PATH, (error) => {
  if (error) {
    console.error('DB connection failed:', error.message);
    process.exit(1);
  }
  console.log('Connected to SQLite database');
});

function runSql(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(error) {
      if (error) return reject(error);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function getSql(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => error ? reject(error) : resolve(row));
  });
}

function allSql(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows));
  });
}

async function ensureColumn(tableName, columnName, definition) {
  const rows = await allSql(`PRAGMA table_info(${tableName})`);
  if (!rows.some((row) => row.name === columnName)) {
    await runSql(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = await scryptAsync(password, salt, 64);
  return `scrypt$${salt}$${derivedKey.toString('hex')}`;
}

async function verifyPassword(password, storedPassword) {
  if (!storedPassword.startsWith('scrypt$')) {
    return { valid: password === storedPassword, needsUpgrade: password === storedPassword };
  }

  const [, salt, expectedHex] = storedPassword.split('$');
  if (!salt || !expectedHex) return { valid: false, needsUpgrade: false };
  const expected = Buffer.from(expectedHex, 'hex');
  const actual = await scryptAsync(password, salt, expected.length);
  return { valid: actual.length === expected.length && timingSafeEqual(actual, expected), needsUpgrade: false };
}

function sessionTokenHash(token) {
  return createHash('sha256').update(token).digest('hex');
}

async function createSession(userId) {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL).toISOString();
  await runSql(
    'INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)',
    [sessionTokenHash(token), userId, expiresAt]
  );
  return token;
}

async function seedData() {
  await runSql(`CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      pack TEXT NOT NULL,
      price INTEGER NOT NULL,
      stock TEXT NOT NULL,
      mark TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1
    )`);

  await runSql(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      facility_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'pharmacy',
      document_name TEXT,
      document_path TEXT,
      verification_status TEXT NOT NULL DEFAULT 'pending',
      verified_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);

  await runSql(`CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      facility_name TEXT NOT NULL,
      notes TEXT,
      total INTEGER NOT NULL,
      items TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Submitted',
      payment_method TEXT,
      invoice_status TEXT DEFAULT 'Unpaid',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);

  await runSql(`CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      method TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Paid',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);

  await runSql(`CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);

  await ensureColumn('orders', 'user_id', 'INTEGER');
  await ensureColumn('orders', 'payment_method', 'TEXT');
  await ensureColumn('orders', 'invoice_status', "TEXT DEFAULT 'Unpaid'");
  await ensureColumn('products', 'active', 'INTEGER NOT NULL DEFAULT 1');

  const productCount = await getSql('SELECT COUNT(*) AS count FROM products');
  if (Number(productCount.count) === 0) {
    for (const product of sampleProducts) {
      await runSql(
        'INSERT INTO products (id, name, category, pack, price, stock, mark) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [product.id, product.name, product.category, product.pack, product.price, product.stock, product.mark]
      );
    }
  }

  const admin = await getSql('SELECT id FROM users WHERE email = ?', ['admin@afrimedico.rw']);
  if (!admin) {
    if (process.env.NODE_ENV === 'production' && !process.env.ADMIN_INITIAL_PASSWORD) {
      throw new Error('Set ADMIN_INITIAL_PASSWORD before creating the production administrator account.');
    }
    const initialAdminPassword = process.env.ADMIN_INITIAL_PASSWORD || 'admin123';
    await runSql(
      'INSERT INTO users (email, password, facility_name, role, verification_status) VALUES (?, ?, ?, ?, ?)',
      ['admin@afrimedico.rw', await hashPassword(initialAdminPassword), 'Afrimedico Rwanda', 'admin', 'approved']
    );
  }

  const users = await allSql('SELECT id, password FROM users');
  for (const user of users) {
    if (!user.password.startsWith('scrypt$')) {
      await runSql('UPDATE users SET password = ? WHERE id = ?', [await hashPassword(user.password), user.id]);
    }
  }
  await runSql('DELETE FROM sessions WHERE expires_at <= ?', [new Date().toISOString()]);
}

app.get('/api/products', (req, res) => {
  db.all('SELECT id, name, category, pack, price, stock, mark FROM products WHERE active = 1 ORDER BY category, name', (err, rows) => {
    if (err) {
      res.status(500).json({ message: 'Unable to load products.' });
      return;
    }
    res.json(rows);
  });
});

app.post('/api/auth/register', upload.single('document'), async (req, res) => {
  const { facilityName, email, password } = req.body || {};
  const documentFile = req.file;
  const cleanFacilityName = String(facilityName || '').trim();
  const cleanEmail = String(email || '').trim().toLowerCase();

  if (!cleanFacilityName || !cleanEmail || !password) {
    if (documentFile) fs.unlink(documentFile.path, () => {});
    return res.status(400).json({ message: 'Facility name, email and password are required.' });
  }

  if (cleanFacilityName.length > 160 || cleanEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    if (documentFile) fs.unlink(documentFile.path, () => {});
    return res.status(400).json({ message: 'Enter a valid email and a facility name under 160 characters.' });
  }

  if (String(password).length < PASSWORD_MIN_LENGTH || String(password).length > 256) {
    if (documentFile) fs.unlink(documentFile.path, () => {});
    return res.status(400).json({ message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.` });
  }

  if (!documentFile) {
    return res.status(400).json({ message: 'A pharmacy licence or registration document is required.' });
  }

  const fileBuffer = await fs.promises.readFile(documentFile.path);
  const extension = path.extname(documentFile.originalname || '').toLowerCase();
  const validSignature = extension === '.pdf'
    ? fileBuffer.subarray(0, 5).toString() === '%PDF-'
    : extension === '.png'
      ? fileBuffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : extension === '.jpg' || extension === '.jpeg'
        ? fileBuffer[0] === 0xff && fileBuffer[1] === 0xd8 && fileBuffer[fileBuffer.length - 2] === 0xff && fileBuffer[fileBuffer.length - 1] === 0xd9
        : false;
  if (!validSignature) {
    await fs.promises.unlink(documentFile.path);
    return res.status(400).json({ message: 'The uploaded file does not match its PDF, JPEG or PNG file type.' });
  }

  try {
    const passwordHash = await hashPassword(String(password));
    const documentName = path.basename(documentFile.originalname || 'document');
    await runSql(
      'INSERT INTO users (email, password, facility_name, document_name, document_path, verification_status) VALUES (?, ?, ?, ?, ?, ?)',
      [cleanEmail, passwordHash, cleanFacilityName, documentName, `/uploads/${documentFile.filename}`, 'pending']
    );
    const user = await getSql(
      'SELECT id, email, facility_name AS facilityName, role, verification_status AS verificationStatus, document_name AS documentName, document_path AS documentPath FROM users WHERE email = ?',
      [cleanEmail]
    );
    const token = await createSession(user.id);
    res.status(201).json({ user, token, message: 'Registration received. The document is now pending admin review.' });
  } catch (error) {
    await fs.promises.unlink(documentFile.path).catch(() => {});
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ message: 'An account with that email already exists.' });
    }
    console.error('Registration failed:', error.message);
    res.status(500).json({ message: 'Registration failed.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  try {
    const normalizedEmail = String(email).trim().toLowerCase();
    const account = await getSql('SELECT * FROM users WHERE email = ?', [normalizedEmail]);
    if (!account) return res.status(401).json({ message: 'Invalid email or password.' });

    const result = await verifyPassword(String(password), account.password);
    if (!result.valid) return res.status(401).json({ message: 'Invalid email or password.' });
    if (result.needsUpgrade) {
      await runSql('UPDATE users SET password = ? WHERE id = ?', [await hashPassword(String(password)), account.id]);
    }

    const token = await createSession(account.id);
    const user = {
      id: account.id,
      email: account.email,
      facilityName: account.facility_name,
      role: account.role,
      verificationStatus: account.verification_status,
      documentName: account.document_name,
      documentPath: account.document_path
    };
    res.json({ user, token, message: 'Login successful.' });
  } catch (error) {
    console.error('Login failed:', error.message);
    res.status(500).json({ message: 'Unable to complete sign in.' });
  }
});

function requireAuthentication(req, res, next) {
  const authorization = req.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token || token.length > 256) return res.status(401).json({ message: 'Please sign in to continue.' });

  getSql(
    `SELECT users.id, users.email, users.facility_name AS facilityName, users.role,
      users.verification_status AS verificationStatus, sessions.token_hash
     FROM sessions JOIN users ON users.id = sessions.user_id
     WHERE sessions.token_hash = ? AND sessions.expires_at > ?`,
    [sessionTokenHash(token), new Date().toISOString()]
  ).then((user) => {
    if (!user) return res.status(401).json({ message: 'Your session expired. Please sign in again.' });
    req.user = user;
    req.sessionTokenHash = user.token_hash;
    delete req.user.token_hash;
    next();
  }).catch((error) => {
    console.error('Session verification failed:', error.message);
    res.status(500).json({ message: 'Unable to verify your session.' });
  });
}

function requireAdmin(req, res, next) {
  requireAuthentication(req, res, (error) => {
    if (error) return next(error);
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Administrator access is required.' });
    next();
  });
}

function requirePharmacy(req, res, next) {
  requireAuthentication(req, res, (error) => {
    if (error) return next(error);
    if (req.user.role !== 'pharmacy') return res.status(403).json({ message: 'A pharmacy account is required.' });
    next();
  });
}

app.post('/api/auth/logout', requireAuthentication, async (req, res) => {
  try {
    await runSql('DELETE FROM sessions WHERE token_hash = ?', [req.sessionTokenHash]);
    res.json({ message: 'Session ended.' });
  } catch (error) {
    console.error('Logout failed:', error.message);
    res.status(500).json({ message: 'Unable to end your session.' });
  }
});

app.post('/api/auth/change-password', requireAuthentication, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (typeof newPassword !== 'string' || newPassword.length < PASSWORD_MIN_LENGTH || newPassword.length > 256) {
    return res.status(400).json({ message: `New password must be at least ${PASSWORD_MIN_LENGTH} characters.` });
  }

  try {
    const account = await getSql('SELECT password FROM users WHERE id = ?', [req.user.id]);
    if (!account || !(await verifyPassword(String(currentPassword || ''), account.password)).valid) {
      return res.status(401).json({ message: 'Current password is incorrect.' });
    }
    await runSql('UPDATE users SET password = ? WHERE id = ?', [await hashPassword(newPassword), req.user.id]);
    await runSql('DELETE FROM sessions WHERE user_id = ?', [req.user.id]);
    res.json({ message: 'Password changed. Sign in again with your new password.' });
  } catch (error) {
    console.error('Password change failed:', error.message);
    res.status(500).json({ message: 'Unable to change password.' });
  }
});

app.post('/api/admin/logout', requireAdmin, (req, res) => {
  runSql('DELETE FROM sessions WHERE token_hash = ?', [req.sessionTokenHash])
    .then(() => res.json({ message: 'Administrator session ended.' }))
    .catch((error) => {
      console.error('Admin logout failed:', error.message);
      res.status(500).json({ message: 'Unable to end administrator session.' });
    });
});

app.get('/api/admin/products', requireAdmin, (req, res) => {
  db.all('SELECT * FROM products ORDER BY category, name', (err, rows) => {
    if (err) return res.status(500).json({ message: 'Unable to load product inventory.' });
    res.json(rows);
  });
});

function validateProduct(product) {
  const name = String(product?.name || '').trim();
  const category = String(product?.category || '').trim();
  const pack = String(product?.pack || '').trim();
  const stock = String(product?.stock || '').trim();
  const price = Number(product?.price);
  const mark = String(product?.mark || '').trim();

  if (!name || !category || !pack || !stock || !Number.isSafeInteger(price) || price < 0) {
    return { error: 'Name, category, pack, stock status and a valid whole-number price are required.' };
  }
  if (!['In stock', 'Low stock', 'Out of stock'].includes(stock)) {
    return { error: 'Choose a valid stock status.' };
  }

  return { product: { name, category, pack, stock, price, mark: mark || name.slice(0, 3).toUpperCase() } };
}

app.post('/api/admin/products', requireAdmin, (req, res) => {
  const result = validateProduct(req.body);
  if (result.error) return res.status(400).json({ message: result.error });

  const baseId = result.product.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'product';
  const id = `${baseId}-${randomBytes(3).toString('hex')}`;
  const { name, category, pack, price, stock, mark } = result.product;
  db.run(
    'INSERT INTO products (id, name, category, pack, price, stock, mark, active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)',
    [id, name, category, pack, price, stock, mark],
    function onInserted(err) {
      if (err) return res.status(500).json({ message: 'Product could not be created.' });
      res.status(201).json({ id, ...result.product, active: 1 });
    }
  );
});

app.patch('/api/admin/products/:id', requireAdmin, (req, res) => {
  const result = validateProduct(req.body);
  if (result.error) return res.status(400).json({ message: result.error });

  const { name, category, pack, price, stock, mark } = result.product;
  db.run(
    'UPDATE products SET name = ?, category = ?, pack = ?, price = ?, stock = ?, mark = ? WHERE id = ?',
    [name, category, pack, price, stock, mark, req.params.id],
    function onUpdated(err) {
      if (err) return res.status(500).json({ message: 'Product could not be updated.' });
      if (this.changes === 0) return res.status(404).json({ message: 'Product not found.' });
      res.json({ id: req.params.id, ...result.product });
    }
  );
});

app.patch('/api/admin/products/:id/availability', requireAdmin, (req, res) => {
  const active = req.body?.active;
  if (active !== true && active !== false) {
    return res.status(400).json({ message: 'Availability must be true or false.' });
  }

  db.run('UPDATE products SET active = ? WHERE id = ?', [active ? 1 : 0, req.params.id], function onUpdated(err) {
    if (err) return res.status(500).json({ message: 'Product availability could not be updated.' });
    if (this.changes === 0) return res.status(404).json({ message: 'Product not found.' });
    res.json({ id: req.params.id, active });
  });
});

app.get('/api/admin/pending-pharmacies', requireAdmin, (req, res) => {
  db.all(
    'SELECT id, email, facility_name AS facilityName, document_name AS documentName, document_path AS documentPath, verification_status AS verificationStatus, created_at AS createdAt FROM users WHERE role = ? ORDER BY created_at DESC',
    ['pharmacy'],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ message: 'Unable to load pending pharmacies.' });
      }
      res.json(rows);
    }
  );
});

app.get('/api/admin/pharmacies/:id/document', requireAdmin, (req, res) => {
  db.get('SELECT document_name, document_path FROM users WHERE id = ? AND role = ?', [Number(req.params.id), 'pharmacy'], (err, pharmacy) => {
    if (err) return res.status(500).json({ message: 'Unable to load pharmacy document.' });
    if (!pharmacy || !pharmacy.document_path) return res.status(404).json({ message: 'Pharmacy document not found.' });

    const filename = path.basename(pharmacy.document_path);
    const documentPath = path.join(uploadsDir, filename);
    if (!fs.existsSync(documentPath)) return res.status(404).json({ message: 'The uploaded document is no longer available.' });
    res.type(path.extname(pharmacy.document_name || '') || 'application/octet-stream');
    res.sendFile(documentPath);
  });
});

app.patch('/api/admin/pharmacies/:id', requireAdmin, (req, res) => {
  const { action } = req.body || {};
  const { id } = req.params;
  if (action !== 'approve' && action !== 'reject') {
    return res.status(400).json({ message: 'Action must be approve or reject.' });
  }
  const finalStatus = action === 'reject' ? 'rejected' : 'approved';

  db.run(
    'UPDATE users SET verification_status = ?, verified_at = CURRENT_TIMESTAMP WHERE id = ? AND role = ?',
    [finalStatus, Number(id), 'pharmacy'],
    function onUpdated(error) {
      if (error) {
        return res.status(500).json({ message: 'Update failed.' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ message: 'Pharmacy not found.' });
      }
      res.json({ id: Number(id), verificationStatus: finalStatus });
    }
  );
});

const parseOrderItems = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
};

app.get('/api/orders', requirePharmacy, (req, res) => {
  db.all('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC', [req.user.id], (err, rows) => {
    if (err) return res.status(500).json({ message: 'Unable to load orders.' });
    res.json(rows.map((row) => ({ ...row, items: parseOrderItems(row.items) })));
  });
});

app.post('/api/orders', requirePharmacy, async (req, res) => {
  const { items, notes } = req.body || {};
  if (!Array.isArray(items) || items.length === 0 || items.length > 50) {
    return res.status(400).json({ message: 'Choose between 1 and 50 products before submitting an order.' });
  }

  const quantities = new Map();
  for (const item of items) {
    if (!item || typeof item.id !== 'string' || !/^[a-z0-9-]{1,100}$/i.test(item.id)
      || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 1000
      || quantities.has(item.id)) {
      return res.status(400).json({ message: 'Each product must have a valid unique ID and quantity between 1 and 1,000.' });
    }
    quantities.set(item.id, item.quantity);
  }

  try {
    const pharmacy = await getSql('SELECT facility_name, verification_status FROM users WHERE id = ? AND role = ?', [req.user.id, 'pharmacy']);
    if (!pharmacy || pharmacy.verification_status !== 'approved') {
      return res.status(403).json({ message: 'Your pharmacy must be approved before placing orders.' });
    }

    const ids = [...quantities.keys()];
    const products = await allSql(
      `SELECT id, name, price, stock FROM products WHERE active = 1 AND id IN (${ids.map(() => '?').join(',')})`,
      ids
    );
    if (products.length !== ids.length) {
      return res.status(400).json({ message: 'One or more products are unavailable. Refresh the catalogue and try again.' });
    }

    const orderItems = products.map((product) => {
      if (product.stock === 'Out of stock') return null;
      const quantity = quantities.get(product.id);
      return { id: product.id, name: product.name, quantity, price: product.price };
    });
    if (orderItems.some((item) => item === null)) {
      return res.status(409).json({ message: 'One or more products are out of stock.' });
    }

    const total = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    if (!Number.isSafeInteger(total) || total <= 0) {
      return res.status(400).json({ message: 'The order total is invalid.' });
    }

    const cleanNotes = typeof notes === 'string' ? notes.trim().slice(0, 1000) : '';
    const created = await runSql(
      'INSERT INTO orders (user_id, facility_name, notes, total, items, status) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, pharmacy.facility_name, cleanNotes, total, JSON.stringify(orderItems), 'Submitted']
    );
    res.status(201).json({
      id: created.lastID,
      facilityName: pharmacy.facility_name,
      notes: cleanNotes,
      total,
      items: orderItems,
      status: 'Submitted',
      invoice_status: 'Unpaid',
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Order creation failed:', error.message);
    res.status(500).json({ message: 'Order could not be created.' });
  }
});

app.post('/api/orders/:id/pay', requirePharmacy, async (req, res) => {
  const orderId = Number(req.params.id);
  if (!Number.isSafeInteger(orderId) || orderId <= 0) return res.status(400).json({ message: 'A valid order ID is required.' });

  try {
    const order = await getSql('SELECT id FROM orders WHERE id = ? AND user_id = ?', [orderId, req.user.id]);
    if (!order) return res.status(404).json({ message: 'Order not found.' });
    res.status(503).json({ message: 'Online payments are not connected yet. No payment was taken or recorded.' });
  } catch (error) {
    console.error('Payment request failed:', error.message);
    res.status(500).json({ message: 'Unable to check this order for payment.' });
  }
});

app.get('/api/admin/orders', requireAdmin, (req, res) => {
  db.all('SELECT * FROM orders ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      return res.status(500).json({ message: 'Unable to load admin orders.' });
    }
    res.json(rows.map((row) => ({ ...row, items: parseOrderItems(row.items) })));
  });
});

app.patch('/api/admin/orders/:id/status', requireAdmin, (req, res) => {
  const { status } = req.body || {};
  const orderId = Number(req.params.id);
  if (!Number.isSafeInteger(orderId) || orderId <= 0 || !orderStatuses.includes(status)) {
    return res.status(400).json({ message: 'Choose a valid order ID and status.' });
  }

  db.run('UPDATE orders SET status = ? WHERE id = ?', [status, orderId], function onUpdated(err) {
    if (err) return res.status(500).json({ message: 'Order status could not be updated.' });
    if (this.changes === 0) return res.status(404).json({ message: 'Order not found.' });
    res.json({ id: orderId, status });
  });
});

app.get('/api/admin/payments', requireAdmin, (req, res) => {
  db.all(
    `SELECT invoices.id, invoices.order_id AS orderId, invoices.amount, invoices.method,
      invoices.status, invoices.created_at AS createdAt, orders.facility_name AS facilityName,
      orders.payment_method AS paymentMethod
     FROM invoices JOIN orders ON orders.id = invoices.order_id
     ORDER BY invoices.created_at DESC`,
    (err, rows) => {
      if (err) return res.status(500).json({ message: 'Unable to load payment records.' });
      res.json(rows);
    }
  );
});

const distPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

seedData()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Afrimedico API running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Database initialization failed:', error.message);
    process.exit(1);
  });
