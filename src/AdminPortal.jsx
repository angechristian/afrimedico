import { useEffect, useMemo, useState } from 'react';
import './admin.css';
import { apiUrl } from './api';

const ADMIN_TOKEN_KEY = 'afrimedico-admin-token';
const ADMIN_USER_KEY = 'afrimedico-admin-user';
const currency = (amount) => `${Number(amount || 0).toLocaleString('en-US')} RWF`;

function downloadCsv(filename, columns, rows) {
  const quote = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const csv = [columns.map(([, label]) => quote(label)).join(','), ...rows.map((row) => columns.map(([key]) => quote(row[key])).join(','))].join('\r\n');
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

const navigation = [
  { group: 'WORKSPACE', items: [['Dashboard', '◫'], ['Proforma Invoices', '▤'], ['Orders and Deliveries', '⇢'], ['Invoices and Payments', '▧']] },
  { group: 'CATALOGUE', items: [['Products and Stock', '▦'], ['Customers', '♙'], ['Premium Members', '✳'], ['Adverts', '▧']] },
  { group: 'INSIGHTS & TEAM', items: [['Reports', '⌁'], ['Staff and Roles', '♧'], ['Settings', '⚙']] }
];

const initialProformas = [
  { ref: 'PF-2026-0147', facility: 'Kigali Community Clinic', items: [{ name: 'Amoxicillin 500 mg capsules', qty: 24, price: 6500 }, { name: 'Nitrile examination gloves', qty: 16, price: 7500 }], total: 276000, date: '08 Oct 2026', status: 'Submitted', contact: 'Dr. Diane Uwase', email: 'procurement@kigaliclinic.rw' },
  { ref: 'PF-2026-0146', facility: 'CHUK Pharmacy', items: [{ name: 'Malaria rapid test kit', qty: 18, price: 28000 }, { name: 'Paracetamol 500 mg tablets', qty: 30, price: 9800 }], total: 798000, date: '08 Oct 2026', status: 'Submitted', contact: 'Jean Claude Niyonzima', email: 'pharmacy@chuk.rw' },
  { ref: 'PF-2026-0145', facility: 'Musanze District Hospital', items: [{ name: 'Oxygen cylinder refill, 40 L', qty: 12, price: 35000 }], total: 420000, date: '07 Oct 2026', status: 'Approved', contact: 'Aline Mukamana', email: 'stores@musanzehospital.rw' },
  { ref: 'PF-2026-0144', facility: 'Pharmacie de l’Est', items: [{ name: 'Amoxicillin 500 mg capsules', qty: 40, price: 6500 }], total: 260000, date: '06 Oct 2026', status: 'Invoiced', contact: 'Eric Habimana', email: 'orders@estpharmacy.rw' },
  { ref: 'PF-2026-0143', facility: 'King Faisal Hospital', items: [{ name: 'Nitrile examination gloves', qty: 50, price: 7500 }], total: 375000, date: '05 Oct 2026', status: 'Rejected', contact: 'Beatha Uwamahoro', email: 'supply@kfh.rw' },
  { ref: 'PF-2026-0142', facility: 'Kibagabaga Hospital', items: [{ name: 'Malaria rapid test kit', qty: 10, price: 28000 }], total: 280000, date: '04 Oct 2026', status: 'Draft', contact: 'Patrick Murenzi', email: 'procurement@kibagabaga.rw' }
];
const initialOrders = [
  { ref: 'ORD-2026-0918', facility: 'Kigali Community Clinic', total: 276000, status: 'Approved', eta: 'Today, 14:30', driver: 'Jean Bosco', vehicle: 'RAC 482 B', category: 'Medicines' },
  { ref: 'ORD-2026-0917', facility: 'CHUK Pharmacy', total: 798000, status: 'Packed', eta: 'Today, 16:00', driver: 'Not assigned', vehicle: '—', category: 'Laboratory' },
  { ref: 'ORD-2026-0916', facility: 'Musanze District Hospital', total: 420000, status: 'Dispatched', eta: 'Today, 12:15', driver: 'Emmanuel N.', vehicle: 'RAB 226 C', category: 'Oxygen' },
  { ref: 'ORD-2026-0915', facility: 'King Faisal Hospital', total: 375000, status: 'Delivered', eta: 'Delivered 09:42', driver: 'Patrick M.', vehicle: 'RAD 105 A', category: 'Consumables' }
];
const initialPayments = [
  { ref: 'INV-2026-0731', facility: 'Musanze District Hospital', amount: 420000, method: 'MTN MoMo', status: 'Paid', date: '08 Oct 2026' },
  { ref: 'INV-2026-0730', facility: 'Kigali Community Clinic', amount: 276000, method: 'Bank transfer', status: 'Awaiting confirmation', date: '08 Oct 2026' },
  { ref: 'INV-2026-0729', facility: 'CHUK Pharmacy', amount: 798000, method: 'Airtel Money', status: 'Paid', date: '07 Oct 2026' },
  { ref: 'INV-2026-0728', facility: 'Pharmacie de l’Est', amount: 260000, method: 'Bank transfer', status: 'Overdue', date: '30 Sep 2026' }
];
const initialProducts = [
  { name: 'Amoxicillin 500 mg capsules', category: 'Medicines', sku: 'MED-AMX-500', stock: 1240, min: 400, batch: 'RW-AMX-2408', expiry: '18 Mar 2027', price: 6500, access: 'Open catalogue' },
  { name: 'Malaria rapid test kit', category: 'Laboratory', sku: 'LAB-RDT-050', stock: 82, min: 100, batch: 'RDT-2026-041', expiry: '12 Dec 2026', price: 28000, access: 'Premium only' },
  { name: 'Nitrile examination gloves', category: 'Consumables', sku: 'CON-NGL-100', stock: 435, min: 200, batch: 'NG-0826-RW', expiry: '09 Jun 2028', price: 7500, access: 'Open catalogue' },
  { name: 'Oxygen cylinder refill, 40 L', category: 'Oxygen', sku: 'OXY-REF-040', stock: 28, min: 15, batch: 'O2-40L-0926', expiry: '30 Nov 2026', price: 35000, access: 'Open catalogue' },
  { name: 'Paracetamol 500 mg tablets', category: 'Medicines', sku: 'MED-PAR-500', stock: 3200, min: 800, batch: 'PAR-2609-14', expiry: '25 Aug 2028', price: 9800, access: 'Open catalogue' }
];
const initialCustomers = [
  { facility: 'Kigali Community Clinic', type: 'Clinic', contact: 'Dr. Diane Uwase', region: 'Kigali', orders: 28, spend: 12450000, premium: true },
  { facility: 'CHUK Pharmacy', type: 'Hospital', contact: 'Jean Claude Niyonzima', region: 'Kigali', orders: 42, spend: 28760000, premium: true },
  { facility: 'Musanze District Hospital', type: 'Hospital', contact: 'Aline Mukamana', region: 'Northern', orders: 19, spend: 9840000, premium: false },
  { facility: 'Pharmacie de l’Est', type: 'Pharmacy', contact: 'Eric Habimana', region: 'Eastern', orders: 15, spend: 6720000, premium: false },
  { facility: 'King Faisal Hospital', type: 'Hospital', contact: 'Beatha Uwamahoro', region: 'Kigali', orders: 36, spend: 32400000, premium: true }
];
const initialMembers = [
  { facility: 'CHUK Pharmacy', contact: 'Jean Claude Niyonzima', status: 'Active', renewal: '24 Oct 2026', since: '24 Apr 2026' },
  { facility: 'Kigali Community Clinic', contact: 'Dr. Diane Uwase', status: 'Active', renewal: '03 Nov 2026', since: '03 May 2026' },
  { facility: 'King Faisal Hospital', contact: 'Beatha Uwamahoro', status: 'Expiring soon', renewal: '12 Oct 2026', since: '12 Apr 2026' },
  { facility: 'Musanze District Hospital', contact: 'Aline Mukamana', status: 'Lapsed', renewal: '01 Oct 2026', since: '01 Apr 2026' }
];

function usePersistedState(key, fallback) {
  const [state, setState] = useState(() => {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; }
  });
  useEffect(() => { localStorage.setItem(key, JSON.stringify(state)); }, [key, state]);
  return [state, setState];
}

function Status({ children }) {
  const key = String(children).toLowerCase();
  const tone = /paid|approved|active|delivered|invoiced|confirmed/.test(key) ? 'success' : /overdue|rejected|lapsed|low stock/.test(key) ? 'danger' : /expiring|awaiting|submitted|packed|dispatched|draft/.test(key) ? 'warning' : 'neutral';
  return <span className={`af-status ${tone}`}><i />{children}</span>;
}

function Button({ children, primary = false, onClick, className = '', ...props }) {
  return <button type="button" className={`af-button ${primary ? 'primary' : ''} ${className}`} onClick={onClick} {...props}>{children}</button>;
}

function PageHeader({ eyebrow, title, subtitle, action, onAction }) {
  return <div className="af-page-head"><div><div className="af-breadcrumb">Operations <span>/</span> {eyebrow}</div><h1>{title}</h1><p>{subtitle}</p></div>{action && <Button primary onClick={onAction}>＋ {action}</Button>}</div>;
}

function Metric({ icon, label, value, change, positive = true }) {
  return <article className="af-metric"><div className="af-metric-top"><span className="af-metric-icon">{icon}</span><span className={`af-trend ${positive ? '' : 'down'}`}>{positive ? '↗' : '↘'} {change}</span></div><div className="af-metric-value">{value}</div><div className="af-metric-label">{label}</div></article>;
}

function DataTable({ columns, rows, rowKey, onRow, empty = 'Try adjusting your filters or search terms.', selectable = false, bulkAction, onBulkAction }) {
  const [sort, setSort] = useState({ key: '', direction: 1 });
  const [selected, setSelected] = useState([]);
  const [page, setPage] = useState(1);
  const pageSize = 6;
  const sortedRows = useMemo(() => {
    if (!sort.key) return rows;
    return [...rows].sort((a, b) => String(a[sort.key] ?? '').localeCompare(String(b[sort.key] ?? ''), undefined, { numeric: true }) * sort.direction);
  }, [rows, sort]);
  const pages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const visible = sortedRows.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => { setPage(1); setSelected([]); }, [rows.length]);
  return <div className="af-table-wrap">
    {selectable && selected.length > 0 && <div className="af-bulkbar">{selected.length} selected <div>{bulkAction && <Button primary onClick={() => { onBulkAction?.(selected); setSelected([]); }}>{bulkAction}</Button>}<Button onClick={() => setSelected([])}>Clear selection</Button></div></div>}
    <table className="af-table"><thead><tr>{selectable && <th><input aria-label="Select all rows" type="checkbox" checked={visible.length > 0 && visible.every((row) => selected.includes(row[rowKey]))} onChange={(event) => setSelected(event.target.checked ? visible.map((row) => row[rowKey]) : [])} /></th>}{columns.map((column) => <th key={column.label}><button type="button" onClick={() => column.sort && setSort((current) => ({ key: column.sort, direction: current.key === column.sort ? -current.direction : 1 }))}>{column.label}{sort.key === column.sort ? (sort.direction > 0 ? ' ↑' : ' ↓') : ''}</button></th>)}</tr></thead>
      <tbody>{visible.map((row) => <tr key={row[rowKey]} onClick={() => onRow?.(row)} className={onRow ? 'clickable' : ''}>{selectable && <td onClick={(event) => event.stopPropagation()}><input aria-label={`Select ${row[rowKey]}`} type="checkbox" checked={selected.includes(row[rowKey])} onChange={(event) => setSelected((current) => event.target.checked ? [...current, row[rowKey]] : current.filter((id) => id !== row[rowKey]))} /></td>}{columns.map((column) => <td key={column.label}>{column.render ? column.render(row) : row[column.key]}</td>)}</tr>)}
      {visible.length === 0 && <tr><td colSpan={columns.length + (selectable ? 1 : 0)}><div className="af-empty"><span>⌕</span><strong>No records found</strong><small>{empty}</small></div></td></tr>}</tbody></table>
    <div className="af-pagination"><span>{rows.length ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, rows.length)} of ${rows.length}` : '0 records'}</span><div><Button onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1}>←</Button><span>Page {page} of {pages}</span><Button onClick={() => setPage((current) => Math.min(pages, current + 1))} disabled={page >= pages}>→</Button></div></div>
  </div>;
}

function Drawer({ title, subtitle, onClose, children }) {
  useEffect(() => {
    const closeOnEscape = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);
  return <div className="af-drawer-scrim" onMouseDown={onClose}><aside className="af-drawer" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}><header><div><small>RECORD DETAILS</small><h2>{title}</h2><p>{subtitle}</p></div><button className="af-close" onClick={onClose} aria-label="Close details">×</button></header><div className="af-drawer-content">{children}</div></aside></div>;
}

function RevenueChart() {
  const values = [38, 44, 41, 52, 48, 61, 56, 68, 63, 79, 73, 88];
  const points = values.map((value, index) => `${34 + index * 55},${170 - value * 1.45}`).join(' ');
  return <div className="af-chart"><div className="af-chart-legend"><span><i /> Revenue</span><select aria-label="Revenue time range"><option>Last 12 months</option><option>Last 30 days</option></select></div><svg viewBox="0 0 650 190" role="img" aria-label="Revenue trend rising from January to December"><defs><linearGradient id="revenue-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#12783A" stopOpacity=".14" /><stop offset="100%" stopColor="#12783A" stopOpacity="0" /></linearGradient></defs>{[35, 75, 115, 155].map((y) => <line key={y} x1="28" x2="638" y1={y} y2={y} className="af-chart-grid" />)}<polygon points={`34,170 ${points} 639,170`} fill="url(#revenue-fill)" /><polyline points={points} fill="none" stroke="#12783A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />{['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((month, index) => <text key={month} x={34 + index * 55} y="188" className="af-chart-label">{month}</text>)}</svg></div>;
}

function CategoryChart() {
  const entries = [['Medicines', 52, '#12783A'], ['Consumables', 24, '#0B3F94'], ['Laboratory', 14, '#D89A16'], ['Oxygen & equipment', 10, '#89B79A']];
  let offset = 0;
  return <div className="af-donut-layout"><svg viewBox="0 0 120 120" aria-label="Orders by category" role="img"><circle cx="60" cy="60" r="44" fill="none" stroke="#edf2ee" strokeWidth="16" />{entries.map(([name, value, color]) => { const circle = <circle key={name} cx="60" cy="60" r="44" fill="none" stroke={color} strokeWidth="16" strokeDasharray={`${value * 2.76} 276`} strokeDashoffset={-offset * 2.76} transform="rotate(-90 60 60)" />; offset += value; return circle; })}<text x="60" y="56" textAnchor="middle" className="af-donut-total">1,284</text><text x="60" y="71" textAnchor="middle" className="af-donut-caption">orders</text></svg><div className="af-legend">{entries.map(([name, value, color]) => <div key={name}><i style={{ background: color }} />{name}<b>{value}%</b></div>)}</div></div>;
}

function AdminPortal() {
  const [token, setToken] = useState(() => localStorage.getItem(ADMIN_TOKEN_KEY) || '');
  const [user, setUser] = useState(() => { try { return JSON.parse(localStorage.getItem(ADMIN_USER_KEY)); } catch { return null; } });
  const [login, setLogin] = useState({ email: 'admin@afrimedico.rw', password: '' });
  const [page, setPage] = useState('Dashboard');
  const [collapsed, setCollapsed] = useState(false);
  const [dark, setDark] = useState(() => localStorage.getItem('afrimedico-admin-dark') === 'true');
  const [query, setQuery] = useState('');
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const [drawer, setDrawer] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [passwordDialog, setPasswordDialog] = useState(false);
  const [passwordFields, setPasswordFields] = useState({ currentPassword: '', newPassword: '' });
  const [loginBusy, setLoginBusy] = useState(false);
  const [apiOrders, setApiOrders] = useState([]);
  const [apiProducts, setApiProducts] = useState([]);
  const [apiPharmacies, setApiPharmacies] = useState([]);
  const [apiPayments, setApiPayments] = useState([]);
  const [apiLoading, setApiLoading] = useState(false);
  const [proformas, setProformas] = usePersistedState('afrimedico-admin-proformas', initialProformas);
  const [orders, setOrders] = usePersistedState('afrimedico-admin-delivery-orders', initialOrders);
  const [payments, setPayments] = usePersistedState('afrimedico-admin-invoices', initialPayments);
  const [products, setProducts] = usePersistedState('afrimedico-admin-stock', initialProducts);
  const [members, setMembers] = usePersistedState('afrimedico-admin-members', initialMembers);
  const [adverts, setAdverts] = usePersistedState('afrimedico-admin-adverts', [
    { name: 'October essentials', placement: 'Home slider', schedule: '01 Oct – 31 Oct 2026', status: 'Active' },
    { name: 'Premium diagnostics', placement: 'Category banner', schedule: '10 Oct – 10 Nov 2026', status: 'Scheduled' },
    { name: 'World Health Week', placement: 'Home slider', schedule: '01 Sep – 30 Sep 2026', status: 'Paused' }
  ]);
  const [customers, setCustomers] = usePersistedState('afrimedico-admin-customers', initialCustomers);
  const [filter, setFilter] = useState('All statuses');
  const [productCategory, setProductCategory] = useState('All categories');
  const [view, setView] = useState('Table');
  const [note, setNote] = useState('');
  const [proformaDraft, setProformaDraft] = useState({ facility: initialCustomers[0].facility, sku: initialProducts[0].sku, quantity: 1 });
  const [productDraft, setProductDraft] = useState({ name: '', category: 'Medicines', stock: 0, min: 100, batch: '', expiry: '', price: 0, access: 'Open catalogue' });
  const [advertDraft, setAdvertDraft] = useState({ name: '', placement: 'Home slider', start: '', end: '', category: 'Medicines' });
  const [customerDraft, setCustomerDraft] = useState({ facility: '', type: 'Pharmacy', contact: '', region: 'Kigali', email: '' });
  const [activeTab, setActiveTab] = useState('Overview');

  const notify = (message) => { setToast(message); window.setTimeout(() => setToast(''), 3000); };

  async function loadAdminRecords(authToken = token) {
    const headers = { Authorization: `Bearer ${authToken}` };
    const endpoints = ['/api/admin/orders', '/api/admin/products', '/api/admin/pending-pharmacies', '/api/admin/payments'];
    setApiLoading(true);
    try {
      const results = await Promise.all(endpoints.map(async (endpoint) => {
        const response = await fetch(apiUrl(endpoint), { headers });
        if (!response.ok) throw new Error(`Unable to load ${endpoint.split('/').pop()}.`);
        return response.json();
      }));
      setApiOrders(results[0]);
      setApiProducts(results[1]);
      setApiPharmacies(results[2]);
      setApiPayments(results[3]);
    } finally {
      setApiLoading(false);
    }
  }

  useEffect(() => {
    if (!token || user?.role !== 'admin') return;
    loadAdminRecords().catch(() => {
      localStorage.removeItem(ADMIN_TOKEN_KEY);
      localStorage.removeItem(ADMIN_USER_KEY);
      setToken('');
      setUser(null);
    });
  }, [token, user?.role]);

  useEffect(() => {
    document.documentElement.dataset.afAdminTheme = dark ? 'dark' : 'light';
    localStorage.setItem('afrimedico-admin-dark', String(dark));
    document.title = 'Afrimedico | Operations';
  }, [dark]);

  const signIn = async (event) => {
    event.preventDefault(); setError(''); setLoginBusy(true);
    try {
      const response = await fetch(apiUrl('/api/auth/login'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(login) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'Sign in failed.');
      if (payload.user?.role !== 'admin' || !payload.token) throw new Error('This account does not have administrator access.');
      localStorage.setItem(ADMIN_TOKEN_KEY, payload.token); localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(payload.user));
      setToken(payload.token); setUser(payload.user);
      notify('Welcome to Afrimedico operations.');
    } catch (requestError) { setError(requestError.message || 'Unable to sign in.'); }
    finally { setLoginBusy(false); }
  };

  const signOut = async () => {
    try { if (token) await fetch(apiUrl('/api/admin/logout'), { method: 'POST', headers: { Authorization: `Bearer ${token}` } }); }
    finally { localStorage.removeItem(ADMIN_TOKEN_KEY); localStorage.removeItem(ADMIN_USER_KEY); setToken(''); setUser(null); }
  };

  const changePassword = async (event) => {
    event.preventDefault(); setError('');
    try {
      const response = await fetch(apiUrl('/api/auth/change-password'), { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(passwordFields) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'Unable to change password.');
      setPasswordDialog(false); setPasswordFields({ currentPassword: '', newPassword: '' });
      await signOut(); setError(''); notify(payload.message || 'Password changed. Sign in with your new password.');
    } catch (requestError) { setError(requestError.message); }
  };

  const filteredProformas = useMemo(() => proformas.filter((record) => (
    (filter === 'All statuses' || record.status === filter)
    && `${record.ref} ${record.facility} ${record.status}`.toLowerCase().includes(query.toLowerCase())
  )), [filter, proformas, query]);

  const updateProforma = (record, status) => {
    setProformas((list) => list.map((item) => item.ref === record.ref ? { ...item, status, staffNote: note } : item));
    if (status === 'Approved') {
      setOrders((list) => [{ ref: `ORD-${record.ref.slice(3)}`, facility: record.facility, total: record.total, status: 'Approved', eta: 'To be scheduled', driver: 'Not assigned', vehicle: '—', category: record.items[0]?.name || 'Medicines' }, ...list]);
      setPayments((list) => [{ ref: `INV-2026-${String(732 + list.length).padStart(4, '0')}`, facility: record.facility, amount: record.total, method: 'Awaiting payment', status: 'Awaiting confirmation', date: '08 Oct 2026' }, ...list]);
    }
    setDrawer(null); setNote(''); notify(status === 'Approved' ? `Proforma ${record.ref} approved and converted to an order.` : `Proforma ${record.ref} ${status.toLowerCase()}.`);
  };

  const updateProformaLine = (record, itemIndex, field, value) => {
    const items = record.items.map((item, index) => index === itemIndex ? { ...item, [field]: Number(value) || 0 } : item);
    const updated = { ...record, items, total: items.reduce((total, item) => total + item.qty * item.price, 0) };
    setProformas((list) => list.map((item) => item.ref === record.ref ? updated : item));
    setDrawer((current) => current?.record?.ref === record.ref ? { ...current, record: updated } : current);
  };

  const createProforma = () => {
    const product = products.find((item) => item.sku === proformaDraft.sku);
    if (!product || !proformaDraft.facility || Number(proformaDraft.quantity) < 1) { notify('Choose a facility, product and valid quantity.'); return; }
    let sequence = 148;
    while (proformas.some((record) => record.ref === `PF-2026-${String(sequence).padStart(4, '0')}`)) sequence += 1;
    const customer = customers.find((item) => item.facility === proformaDraft.facility);
    const record = {
      ref: `PF-2026-${String(sequence).padStart(4, '0')}`,
      facility: proformaDraft.facility,
      items: [{ name: product.name, qty: Number(proformaDraft.quantity), price: product.price }],
      total: Number(proformaDraft.quantity) * product.price,
      date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      status: 'Draft',
      contact: customer?.contact || 'Procurement contact',
      email: 'procurement@facility.rw'
    };
    setProformas((list) => [record, ...list]);
    setDrawer(null);
    setProformaDraft({ facility: initialCustomers[0].facility, sku: initialProducts[0].sku, quantity: 1 });
    notify(`Draft proforma ${record.ref} created.`);
  };

  const createProduct = () => {
    if (!productDraft.name.trim() || !productDraft.batch.trim() || !productDraft.expiry || Number(productDraft.price) < 0) { notify('Complete the product name, batch, expiry and valid price.'); return; }
    const baseSku = productDraft.name.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 15) || 'PRODUCT';
    const sku = `${baseSku}-${String(Date.now()).slice(-4)}`;
    setProducts((list) => [{ ...productDraft, name: productDraft.name.trim(), sku, stock: Number(productDraft.stock), min: Number(productDraft.min), price: Number(productDraft.price) }, ...list]);
    setDrawer(null);
    setProductDraft({ name: '', category: 'Medicines', stock: 0, min: 100, batch: '', expiry: '', price: 0, access: 'Open catalogue' });
    notify('Product added to catalogue and stock list.');
  };

  const createAdvert = () => {
    if (!advertDraft.name.trim() || !advertDraft.start || !advertDraft.end) { notify('Enter a campaign name and start and end dates.'); return; }
    const schedule = `${new Date(advertDraft.start).toLocaleDateString('en-GB')} – ${new Date(advertDraft.end).toLocaleDateString('en-GB')}`;
    setAdverts((list) => [{ name: advertDraft.name.trim(), placement: advertDraft.placement, schedule, category: advertDraft.category, status: 'Scheduled' }, ...list]);
    setDrawer(null);
    setAdvertDraft({ name: '', placement: 'Home slider', start: '', end: '', category: 'Medicines' });
    notify('Campaign added to the schedule.');
  };

  const createCustomer = () => {
    if (!customerDraft.facility.trim() || !customerDraft.contact.trim()) { notify('Enter a facility name and primary contact.'); return; }
    setCustomers((list) => [{ ...customerDraft, facility: customerDraft.facility.trim(), contact: customerDraft.contact.trim(), orders: 0, spend: 0, premium: false, notes: '' }, ...list]);
    setCustomerDraft({ facility: '', type: 'Pharmacy', contact: '', region: 'Kigali', email: '' });
    setDrawer(null);
    notify('Customer profile created.');
  };

  const importProductsCsv = async (file) => {
    if (!file) return;
    const lines = (await file.text()).split(/\r?\n/).filter((line) => line.trim());
    const parseRow = (line) => line.match(/("(?:[^"]|"")*"|[^,]*)(,|$)/g)?.map((cell) => cell.replace(/,$/, '').replace(/^"|"$/g, '').replaceAll('""', '"')) || [];
    const headers = parseRow(lines.shift() || '').map((header) => header.trim().toLowerCase());
    const required = ['name', 'category', 'sku', 'stock', 'min', 'batch', 'expiry', 'price', 'access'];
    if (!required.every((header) => headers.includes(header))) { notify('CSV needs name, category, sku, stock, min, batch, expiry, price and access columns.'); return; }
    const imported = lines.map((line) => {
      const values = parseRow(line);
      return Object.fromEntries(headers.map((header, index) => [header, values[index] || '']));
    }).filter((row) => row.name && row.sku).map((row) => ({ ...row, stock: Number(row.stock), min: Number(row.min), price: Number(row.price) }));
    if (!imported.length || imported.some((row) => !Number.isFinite(row.stock) || !Number.isFinite(row.price))) { notify('No valid product rows found in that CSV.'); return; }
    setProducts((current) => [...imported, ...current.filter((product) => !imported.some((row) => row.sku === product.sku))]);
    notify(`${imported.length} products imported from CSV.`);
  };

  const approvePharmacy = async (pharmacy, action) => {
    const response = await fetch(apiUrl(`/api/admin/pharmacies/${pharmacy.id}`), { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ action }) });
    if (!response.ok) { setError('Unable to update pharmacy review.'); return; }
    await loadAdminRecords(); notify(`Pharmacy ${action === 'approve' ? 'approved' : 'rejected'}.`);
  };

  const currentNav = navigation.flatMap((group) => group.items.map(([label]) => label)).includes(page) ? page : 'Dashboard';
  const navSelection = (label) => { setPage(label); setQuery(''); setError(''); };
  const openRecord = (record, type) => setDrawer({ record, type });
  const tableQuery = (rows, keys) => rows.filter((row) => keys.some((key) => String(row[key] || '').toLowerCase().includes(query.toLowerCase())));
  const filteredOrders = tableQuery(orders.filter((row) => filter === 'All statuses' || row.status === filter), ['ref', 'facility', 'status']);

  const dashboard = () => {
    const pending = proformas.filter((item) => item.status === 'Submitted').length;
    const lowStock = products.filter((item) => item.stock < item.min).length;
    return <>
      <PageHeader eyebrow="Dashboard" title="Good morning, team" subtitle="Here’s what’s happening across your supply network today." action="New proforma" onAction={() => navSelection('Proforma Invoices')} />
      <div className="af-metrics">
        <Metric icon="↗" label="Revenue this month" value="48.6M RWF" change="12.8%" />
        <Metric icon="▤" label="Open proformas" value={String(pending + 12).padStart(2, '0')} change="3 awaiting" />
        <Metric icon="⇢" label="Orders in delivery" value="18" change="4 today" />
        <Metric icon="✳" label="Active Premium" value="124" change="8.4%" />
        <Metric icon="▥" label="Low-stock items" value={String(lowStock + 7).padStart(2, '0')} change="Needs review" positive={false} />
      </div>
      <div className="af-dashboard-grid">
        <section className="af-card af-revenue-card"><div className="af-card-head"><div><h2>Revenue overview</h2><p>Consistent growth across the supply network</p></div><span className="af-compare">↑ 12.8% <small>vs last year</small></span></div><RevenueChart /></section>
        <section className="af-card af-category-card"><div className="af-card-head"><div><h2>Orders by category</h2><p>Distribution this month</p></div><button className="af-icon-button" aria-label="Category chart options">···</button></div><CategoryChart /></section>
        <section className="af-card af-attention"><div className="af-card-head"><div><h2>Needs your attention</h2><p>Items requiring a decision</p></div><button className="af-text-button" onClick={() => navSelection('Proforma Invoices')}>View all</button></div>
          {[['▤', `${pending + 2} proformas awaiting approval`, 'Review submitted quotes', 'Proforma Invoices', 'amber'], ['◷', '3 bank transfers to confirm', 'Finance · last update 12 min ago', 'Invoices and Payments', 'blue'], ['▥', `${lowStock + 1} products below reorder level`, 'Review stock and upcoming expiry', 'Products and Stock', 'red'], ['⌁', '2 batches expire in 90 days', 'Check batch-level inventory', 'Products and Stock', 'amber']].map(([icon, title, sub, target, tone]) => <button className="af-attention-row" key={title} onClick={() => navSelection(target)}><span className={`af-attention-icon ${tone}`}>{icon}</span><span><strong>{title}</strong><small>{sub}</small></span><b>›</b></button>)}
        </section>
        <section className="af-card af-recent-orders"><div className="af-card-head"><div><h2>Recent orders</h2><p>Latest activity from your facilities</p></div><button className="af-text-button" onClick={() => navSelection('Orders and Deliveries')}>View all orders →</button></div>
          <DataTable rowKey="ref" rows={orders.slice(0, 4)} columns={[{ label: 'REFERENCE', key: 'ref', sort: 'ref', render: (row) => <strong className="af-mono af-link">{row.ref}</strong> }, { label: 'FACILITY', key: 'facility', sort: 'facility' }, { label: 'TOTAL', key: 'total', sort: 'total', render: (row) => <strong className="af-mono">{currency(row.total)}</strong> }, { label: 'STATUS', key: 'status', render: (row) => <Status>{row.status}</Status> }]} onRow={(row) => openRecord(row, 'order')} />
        </section>
      </div>
    </>;
  };

  const proformaPage = () => <>
    <PageHeader eyebrow="Proforma invoices" title="Proforma invoices" subtitle="Review customer quotes and convert approved proformas into invoices." action="Create proforma" onAction={() => { setDrawer({ type: 'new-proforma' }); }} />
    <div className="af-stat-strip"><span><b>{proformas.filter((item) => item.status === 'Submitted').length}</b> awaiting review</span><span><b>{proformas.filter((item) => item.status === 'Approved').length}</b> approved this month</span><span><b>{currency(proformas.filter((item) => item.status === 'Submitted').reduce((sum, item) => sum + item.total, 0))}</b> pending value</span></div>
    <section className="af-card af-list-card"><div className="af-list-toolbar"><div className="af-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search reference or facility" /></div><select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filter proforma status">{['All statuses', 'Draft', 'Submitted', 'Approved', 'Rejected', 'Invoiced'].map((status) => <option key={status}>{status}</option>)}</select><Button onClick={() => notify('Filters cleared.')}>↕ Filters</Button></div>
      <DataTable selectable bulkAction="Approve selected" onBulkAction={(refs) => refs.forEach((ref) => { const record = proformas.find((item) => item.ref === ref); if (record?.status === 'Submitted') updateProforma(record, 'Approved'); })} rowKey="ref" rows={filteredProformas} columns={[{ label: 'REFERENCE', key: 'ref', sort: 'ref', render: (row) => <strong className="af-mono af-link">{row.ref}</strong> }, { label: 'FACILITY', key: 'facility', sort: 'facility', render: (row) => <div className="af-facility-cell"><strong>{row.facility}</strong><small>{row.contact}</small></div> }, { label: 'ITEMS', key: 'items', sort: 'items', render: (row) => `${row.items.length} items` }, { label: 'TOTAL', key: 'total', sort: 'total', render: (row) => <strong className="af-mono">{currency(row.total)}</strong> }, { label: 'DATE', key: 'date', sort: 'date' }, { label: 'STATUS', key: 'status', render: (row) => <Status>{row.status}</Status> }, { label: '', render: () => <span className="af-more">···</span> }]} onRow={(row) => openRecord(row, 'proforma')} empty="No proformas match this view. Try a different status or search." />
    </section>
  </>;

  const ordersPage = () => <>
    <PageHeader eyebrow="Orders and deliveries" title="Orders and deliveries" subtitle="Coordinate fulfilment from approval through signed delivery." action="Schedule delivery" onAction={() => notify('Delivery scheduling is ready for a selected order.')} />
    <div className="af-pipeline">{['Approved', 'Paid', 'Packed', 'Dispatched', 'Delivered'].map((status, index) => <button key={status} className={activeTab === status ? 'selected' : ''} onClick={() => { setActiveTab(status); setFilter(status === 'Paid' ? 'All statuses' : status); }}><span>{index + 1}</span><b>{status}</b><small>{index === 0 ? 6 : index === 1 ? 4 : index === 2 ? 3 : index === 3 ? 2 : 18}</small></button>)}</div>
    <section className="af-card af-list-card"><div className="af-list-toolbar"><div className="af-view-switch"><button className={view === 'Table' ? 'selected' : ''} onClick={() => setView('Table')}>☷ Table</button><button className={view === 'Board' ? 'selected' : ''} onClick={() => setView('Board')}>▦ Board</button></div><div className="af-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search orders or facilities" /></div></div>
      {view === 'Table' ? <DataTable selectable rowKey="ref" rows={filteredOrders} columns={[{ label: 'ORDER', key: 'ref', sort: 'ref', render: (row) => <strong className="af-mono af-link">{row.ref}</strong> }, { label: 'FACILITY', key: 'facility', sort: 'facility' }, { label: 'TOTAL', key: 'total', sort: 'total', render: (row) => <strong className="af-mono">{currency(row.total)}</strong> }, { label: 'DRIVER / VEHICLE', key: 'driver', render: (row) => <span>{row.driver}<small className="af-subline">{row.vehicle}</small></span> }, { label: 'ETA', key: 'eta' }, { label: 'STATUS', key: 'status', render: (row) => <Status>{row.status}</Status> }]} onRow={(row) => openRecord(row, 'order')} /> : <div className="af-kanban">{['Approved', 'Packed', 'Dispatched', 'Delivered'].map((status) => <div className="af-kanban-column" key={status}><h3>{status}<span>{orders.filter((item) => item.status === status).length}</span></h3>{orders.filter((item) => item.status === status).map((item) => <button key={item.ref} className="af-kanban-card" onClick={() => openRecord(item, 'order')}><small>{item.ref}</small><strong>{item.facility}</strong><b>{currency(item.total)}</b><span>{item.driver} · {item.eta}</span></button>)}</div>)}</div>}
    </section>
  </>;

  const paymentsPage = () => <>
    <PageHeader eyebrow="Invoices and payments" title="Invoices and payments" subtitle="Track invoices and reconcile customer payments across channels." action="Create invoice" onAction={() => notify('Select an approved order to create an invoice.')} />
    <div className="af-metrics af-payment-metrics"><Metric icon="R" label="Paid this month" value="32.8M RWF" change="8.2%" /><Metric icon="◷" label="Awaiting confirmation" value={String(payments.filter((item) => item.status === 'Awaiting confirmation').length).padStart(2, '0')} change="Bank transfers" positive={false} /><Metric icon="!" label="Overdue balance" value="1.26M RWF" change="4 invoices" positive={false} /></div>
    <section className="af-card af-list-card"><div className="af-list-toolbar"><div className="af-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search invoice or facility" /></div><Button onClick={() => notify('Invoice export downloaded.')}>↓ Export</Button></div><DataTable selectable rowKey="ref" rows={tableQuery(payments, ['ref', 'facility', 'method', 'status'])} columns={[{ label: 'INVOICE', key: 'ref', sort: 'ref', render: (row) => <strong className="af-mono af-link">{row.ref}</strong> }, { label: 'FACILITY', key: 'facility', sort: 'facility' }, { label: 'AMOUNT', key: 'amount', sort: 'amount', render: (row) => <strong className="af-mono">{currency(row.amount)}</strong> }, { label: 'PAYMENT METHOD', key: 'method' }, { label: 'ISSUED', key: 'date', sort: 'date' }, { label: 'STATUS', key: 'status', render: (row) => <Status>{row.status}</Status> }, { label: 'ACTION', render: (row) => row.status === 'Awaiting confirmation' ? <button className="af-inline-action" onClick={(event) => { event.stopPropagation(); setConfirm({ title: 'Confirm bank transfer?', message: `${row.facility} · ${currency(row.amount)}`, action: () => { setPayments((items) => items.map((item) => item.ref === row.ref ? { ...item, status: 'Paid' } : item)); setConfirm(null); notify('Bank transfer confirmed.'); } }); }}>Confirm</button> : <span className="af-more">···</span> }]} onRow={(row) => openRecord(row, 'invoice')} /></section>
  </>;

  const productsPage = () => <>
    <PageHeader eyebrow="Products and stock" title="Products and stock" subtitle="Manage catalogue access, on-hand stock, batches and expiry dates." action="Add product" onAction={() => setDrawer({ type: 'new-product' })} />
    <div className="af-stock-alert"><span>!</span><div><strong>{products.filter((item) => item.stock < item.min).length + 1} items need a stock review</strong><small>One or more batches are below reorder level or near expiry.</small></div><button onClick={() => setQuery('')}>Review stock →</button></div>
    <section className="af-card af-list-card"><div className="af-list-toolbar"><div className="af-view-switch"><button className={view === 'Table' ? 'selected' : ''} onClick={() => setView('Table')}>☷ Table</button><button className={view === 'Grid' ? 'selected' : ''} onClick={() => setView('Grid')}>▦ Grid</button></div><div className="af-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search product, batch or SKU" /></div><select aria-label="Filter product category" value={productCategory} onChange={(event) => setProductCategory(event.target.value)}><option>All categories</option>{['Medicines', 'Equipment', 'Laboratory', 'Consumables', 'Oxygen'].map((category) => <option key={category}>{category}</option>)}</select><label className="af-button af-upload-button">↑ Import CSV<input type="file" accept=".csv,text/csv" onChange={(event) => importProductsCsv(event.target.files?.[0])} /></label></div>
      {view === 'Table' ? <DataTable selectable rowKey="sku" rows={tableQuery(products.filter((item) => productCategory === 'All categories' || item.category === productCategory), ['name', 'sku', 'category', 'batch'])} columns={[{ label: 'PRODUCT', key: 'name', sort: 'name', render: (row) => <div className="af-facility-cell"><strong>{row.name}</strong><small>{row.sku} · {row.category}</small></div> }, { label: 'ON HAND', key: 'stock', sort: 'stock', render: (row) => <div className="af-stock-meter"><strong>{row.stock.toLocaleString()}</strong><span><i style={{ width: `${Math.min(100, row.stock / row.min * 45)}%` }} className={row.stock < row.min ? 'low' : ''} /></span></div> }, { label: 'BATCH', key: 'batch', sort: 'batch', render: (row) => <span className="af-mono">{row.batch}</span> }, { label: 'EXPIRY', key: 'expiry', sort: 'expiry' }, { label: 'PRICE', key: 'price', sort: 'price', render: (row) => <strong className="af-mono">{currency(row.price)}</strong> }, { label: 'ACCESS', key: 'access', render: (row) => <Status>{row.access}</Status> }]} onRow={(row) => openRecord(row, 'product')} /> : <div className="af-product-grid">{tableQuery(products.filter((item) => productCategory === 'All categories' || item.category === productCategory), ['name', 'sku', 'category']).map((product) => <button className="af-product-card" key={product.sku} onClick={() => openRecord(product, 'product')}><span className="af-product-icon">{product.category === 'Oxygen' ? '◉' : '✚'}</span><Status>{product.access}</Status><h3>{product.name}</h3><small>{product.category} · {product.sku}</small><div><strong>{currency(product.price)}</strong><span>{product.stock.toLocaleString()} units</span></div></button>)}</div>}
    </section>
  </>;

  const customersPage = () => <><PageHeader eyebrow="Customers" title="Customer network" subtitle="Relationships and purchasing activity across Rwanda." action="Add customer" onAction={() => setDrawer({ type: 'new-customer' })} /><div className="af-stat-strip"><span><b>{customers.length + 138}</b> registered facilities</span><span><b>30</b> districts covered</span><span><b>92%</b> repeat customers</span></div><section className="af-card af-list-card"><div className="af-list-toolbar"><div className="af-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search facility, region or contact" /></div><Button onClick={() => downloadCsv('afrimedico-customers.csv', [['facility', 'Facility'], ['type', 'Type'], ['contact', 'Contact'], ['region', 'Region'], ['orders', 'Orders'], ['spend', 'Total spend RWF'], ['premium', 'Premium member']], customers)} >↓ Export CSV</Button></div><DataTable selectable rowKey="facility" rows={tableQuery(customers, ['facility', 'contact', 'region', 'type'])} columns={[{ label: 'FACILITY', key: 'facility', sort: 'facility', render: (row) => <div className="af-facility-cell"><strong>{row.facility}</strong><small>{row.type} · {row.region} Province</small></div> }, { label: 'PRIMARY CONTACT', key: 'contact', sort: 'contact' }, { label: 'ORDERS', key: 'orders', sort: 'orders' }, { label: 'TOTAL SPEND', key: 'spend', sort: 'spend', render: (row) => <strong className="af-mono">{currency(row.spend)}</strong> }, { label: 'MEMBERSHIP', key: 'premium', render: (row) => row.premium ? <Status>Premium</Status> : <span className="af-muted">Standard</span> }]} onRow={(row) => openRecord(row, 'customer')} /></section></>;

  const membersPage = () => <><PageHeader eyebrow="Premium members" title="Premium membership" subtitle="Manage renewals and member benefits across the network." action="Add member" onAction={() => { setMembers((list) => [{ facility: 'New facility', contact: 'Pending contact', status: 'Active', renewal: '08 Nov 2026', since: '08 Oct 2026' }, ...list]); notify('Premium membership added.'); }} /><div className="af-premium-banner"><span>✳</span><div><small>AFRIMEDICO PREMIUM</small><h2>Better access. Better value.</h2><p>Members receive a 6% discount on every product for 10,000 RWF per month.</p></div><strong>10,000 <small>RWF / month</small></strong></div><div className="af-metrics af-three-metrics"><Metric icon="✳" label="Active members" value="124" change="8 this month" /><Metric icon="◷" label="Renewing in 30 days" value="18" change="Action needed" positive={false} /><Metric icon="↗" label="Membership revenue" value="1.24M RWF" change="This month" /></div><section className="af-card af-list-card"><div className="af-list-toolbar"><div className="af-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search facility or contact" /></div><Button onClick={() => setFilter(filter === 'Active' ? 'All statuses' : 'Active')}>♧ {filter === 'Active' ? 'All members' : 'Active members'}</Button></div><DataTable rowKey="facility" rows={tableQuery(members.filter((item) => filter !== 'Active' || item.status === 'Active'), ['facility', 'contact', 'status'])} columns={[{ label: 'FACILITY', key: 'facility', sort: 'facility', render: (row) => <strong>{row.facility}</strong> }, { label: 'CONTACT', key: 'contact', sort: 'contact' }, { label: 'MEMBER SINCE', key: 'since', sort: 'since' }, { label: 'NEXT RENEWAL', key: 'renewal', sort: 'renewal' }, { label: 'STATUS', key: 'status', render: (row) => <Status>{row.status}</Status> }, { label: 'MONTHLY FEE', render: () => <strong className="af-mono">{currency(10000)}</strong> }]} onRow={(row) => openRecord(row, 'member')} /></section></>;

  const advertsPage = () => <><PageHeader eyebrow="Adverts" title="Campaign banners" subtitle="Schedule and preview promotional placements across the customer storefront." action="Create campaign" onAction={() => { setDrawer({ type: 'new-advert' }); }} /><div className="af-ad-preview"><div><span>FEATURED CAMPAIGN · HOME SLIDER</span><h2>Reliable supply. Healthier communities.</h2><p>Essential medicines, delivered across Rwanda.</p><Button primary onClick={() => notify('Campaign preview opened.')}>Shop the catalogue →</Button></div><div className="af-ad-shape">✚</div></div><section className="af-card af-list-card"><div className="af-card-head"><div><h2>Campaign schedule</h2><p>Manage live and upcoming placements</p></div></div><DataTable rowKey="name" rows={adverts} columns={[{ label: 'CAMPAIGN', key: 'name', sort: 'name', render: (row) => <strong>{row.name}</strong> }, { label: 'PLACEMENT', key: 'placement' }, { label: 'SCHEDULE', key: 'schedule' }, { label: 'STATUS', key: 'status', render: (row) => <Status>{row.status}</Status> }, { label: 'ACTION', render: (row) => <button className="af-inline-action" onClick={(event) => { event.stopPropagation(); setAdverts((items) => items.map((item) => item.name === row.name ? { ...item, status: item.status === 'Paused' ? 'Active' : 'Paused' } : item)); notify(row.status === 'Paused' ? 'Campaign activated.' : 'Campaign paused.'); }}>{row.status === 'Paused' ? 'Activate' : 'Pause'}</button> }]} onRow={(row) => openRecord(row, 'advert')} /></section></>;

  const reportsPage = () => <><PageHeader eyebrow="Reports" title="Reports and exports" subtitle="Explore commercial performance by category, customer, month and region." action="Export report" onAction={() => downloadCsv('afrimedico-regional-report.csv', [['region', 'Region'], ['facilities', 'Facilities'], ['orders', 'Orders'], ['revenue', 'Revenue RWF']], [{ region: 'Kigali City', facilities: 68, orders: 812, revenue: 28600000 }, { region: 'Northern Province', facilities: 24, orders: 202, revenue: 9420000 }, { region: 'Eastern Province', facilities: 19, orders: 141, revenue: 6280000 }, { region: 'Southern Province', facilities: 17, orders: 96, revenue: 4120000 }])} /><div className="af-list-toolbar af-report-controls"><label>Date range<select><option>01 Sep – 08 Oct 2026</option><option>Last 30 days</option><option>This year</option></select></label><label>Report view<select><option>Sales by category</option><option>Sales by customer</option><option>Sales by region</option><option>Monthly revenue</option></select></label><Button onClick={() => downloadCsv('afrimedico-regional-report.csv', [['region', 'Region'], ['facilities', 'Facilities'], ['orders', 'Orders'], ['revenue', 'Revenue RWF']], [{ region: 'Kigali City', facilities: 68, orders: 812, revenue: 28600000 }, { region: 'Northern Province', facilities: 24, orders: 202, revenue: 9420000 }, { region: 'Eastern Province', facilities: 19, orders: 141, revenue: 6280000 }, { region: 'Southern Province', facilities: 17, orders: 96, revenue: 4120000 }])}>↓ Excel / CSV</Button><Button onClick={() => window.print()}>↓ Print / Save PDF</Button></div><div className="af-report-grid"><section className="af-card"><div className="af-card-head"><div><h2>Revenue performance</h2><p>Monthly sales · RWF</p></div></div><RevenueChart /></section><section className="af-card"><div className="af-card-head"><div><h2>Sales by category</h2><p>Share of total orders</p></div></div><CategoryChart /></section></div><section className="af-card af-list-card"><div className="af-card-head"><div><h2>Regional performance</h2><p>Facility orders by province</p></div></div><DataTable rowKey="region" rows={[{ region: 'Kigali City', facilities: 68, orders: 812, revenue: 28600000 }, { region: 'Northern Province', facilities: 24, orders: 202, revenue: 9420000 }, { region: 'Eastern Province', facilities: 19, orders: 141, revenue: 6280000 }, { region: 'Southern Province', facilities: 17, orders: 96, revenue: 4120000 }]} columns={[{ label: 'REGION', key: 'region', sort: 'region' }, { label: 'FACILITIES', key: 'facilities', sort: 'facilities' }, { label: 'ORDERS', key: 'orders', sort: 'orders' }, { label: 'REVENUE', key: 'revenue', sort: 'revenue', render: (row) => <strong className="af-mono">{currency(row.revenue)}</strong> }]} /></section></>;

  const staffPage = () => <><PageHeader eyebrow="Staff and roles" title="Team access" subtitle="Control permissions and review operational activity." action="Invite staff" onAction={() => notify('Staff invitation form opened.')} /><div className="af-role-grid">{[['Admin', 'Full system access', '2 staff', '▣'], ['Sales', 'Proformas, orders and customers', '5 staff', '↗'], ['Finance', 'Invoices, payments and reports', '3 staff', '▤'], ['Logistics', 'Dispatch, drivers and delivery notes', '4 staff', '⇢'], ['Warehouse', 'Products, stock and batches', '6 staff', '▦']].map(([role, desc, count, icon]) => <article key={role} className="af-role-card"><span>{icon}</span><div><h3>{role}</h3><p>{desc}</p></div><small>{count}</small><button onClick={() => notify(`${role} permissions opened.`)}>Manage →</button></article>)}</div><section className="af-card af-list-card"><div className="af-card-head"><div><h2>Recent activity</h2><p>Audit trail for staff actions</p></div></div><DataTable rowKey="id" rows={[{ id: 'ACT-918', staff: 'Diane U.', action: 'Approved proforma PF-2026-0144', time: 'Today, 10:42', role: 'Sales' }, { id: 'ACT-917', staff: 'Patrick M.', action: 'Confirmed bank transfer INV-2026-0727', time: 'Today, 09:18', role: 'Finance' }, { id: 'ACT-916', staff: 'Eric H.', action: 'Updated stock for amoxicillin batch', time: 'Yesterday, 16:32', role: 'Warehouse' }]} columns={[{ label: 'STAFF', key: 'staff' }, { label: 'ACTIVITY', key: 'action' }, { label: 'ROLE', key: 'role' }, { label: 'TIME', key: 'time' }]} /></section></>;

  const settingsPage = () => <><PageHeader eyebrow="Settings" title="Workspace settings" subtitle="Manage company preferences and operational defaults." action="Save changes" onAction={() => notify('Workspace settings saved.')} /><section className="af-card af-settings-card"><div className="af-card-head"><div><h2>General preferences</h2><p>Configure how Afrimedico operations appear to your team.</p></div></div><label>Company name<input defaultValue="Afrimedico Rwanda Ltd." /></label><label>Default currency<select defaultValue="RWF"><option>RWF</option></select></label><label>Timezone<select defaultValue="Africa/Kigali"><option value="Africa/Kigali">Africa/Kigali (CAT, UTC+2)</option></select></label><label>Low stock alert threshold<input type="number" defaultValue="100" /></label><label className="af-theme-toggle">Dark appearance<span><input type="checkbox" checked={dark} onChange={(event) => setDark(event.target.checked)} /> Use dark mode</span></label><Button primary onClick={() => notify('Settings saved.')}>Save preferences</Button></section></>;

  const pageContent = {
    Dashboard: dashboard,
    'Proforma Invoices': proformaPage,
    'Orders and Deliveries': ordersPage,
    'Invoices and Payments': paymentsPage,
    'Products and Stock': productsPage,
    Customers: customersPage,
    'Premium Members': membersPage,
    Adverts: advertsPage,
    Reports: reportsPage,
    'Staff and Roles': staffPage,
    Settings: settingsPage
  };

  if (!token || user?.role !== 'admin') return <div className="af-login-screen"><div className="af-login-brand"><div className="af-brand-mark">a<span>+</span></div><strong>afri<span>medico</span></strong></div><form className="af-login-card" onSubmit={signIn}><div className="af-login-icon">⌑</div><div className="af-login-eyebrow">SECURE OPERATIONS PORTAL</div><h1>Welcome back</h1><p>Sign in to manage the Afrimedico supply network.</p>{error && <div className="af-login-error">{error}</div>}<label>Email address<input type="email" autoComplete="username" required value={login.email} onChange={(event) => setLogin({ ...login, email: event.target.value })} /></label><label>Password<input type="password" autoComplete="current-password" required value={login.password} onChange={(event) => setLogin({ ...login, password: event.target.value })} /></label><button className="af-button primary af-login-submit" disabled={loginBusy}>{loginBusy ? 'Signing in…' : 'Sign in to operations'}</button><small>Access is restricted to authorised Afrimedico staff.</small></form><footer>AFRIMEDICO RWANDA · KIGALI</footer></div>;

  return <div className={`af-admin ${collapsed ? 'is-collapsed' : ''} ${dark ? 'theme-dark' : ''}`}>
    <aside className="af-sidebar">
      <div className="af-brand"><div className="af-brand-mark">a<span>+</span></div>{!collapsed && <div><strong>afri<span>medico</span></strong><small>WHOLESALE OPERATIONS</small></div>}<button aria-label="Collapse navigation" className="af-collapse" onClick={() => setCollapsed((value) => !value)}>{collapsed ? '›' : '‹'}</button></div>
      <div className="af-sidebar-scroll">{navigation.map((section) => <div className="af-nav-section" key={section.group}>{!collapsed && <span className="af-nav-heading">{section.group}</span>}{section.items.map(([label, icon]) => <button title={collapsed ? label : undefined} className={`af-nav-item ${currentNav === label ? 'active' : ''}`} key={label} onClick={() => navSelection(label)}><span>{icon}</span>{!collapsed && <>{label}{label === 'Proforma Invoices' && <i>{proformas.filter((item) => item.status === 'Submitted').length}</i>}</>}</button>)}</div>)}</div>
      {!collapsed && <div className="af-sidebar-footer"><div className="af-support-icon">?</div><div><strong>Need a hand?</strong><small>Operations support</small></div><button onClick={() => notify('Contact operations@afrimedico.rw for support.')}>↗</button></div>}
      <button className="af-sidebar-user" onClick={signOut}><span className="af-avatar">AU</span>{!collapsed && <span><strong>{user?.facilityName || 'Afrimedico Admin'}</strong><small>Administrator · Sign out</small></span>}<b>···</b></button>
    </aside>
    <div className="af-main">
      <header className="af-topbar"><label className="af-global-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search anything..." /><kbd>⌘ K</kbd></label><div className="af-top-actions"><button className="af-notifications" aria-label="Notifications" onClick={() => navSelection('Proforma Invoices')}>♧<i>4</i></button><Button primary onClick={() => { setPage('Proforma Invoices'); setDrawer({ type: 'new-proforma' }); }}>＋ New proforma</Button><span className="af-top-divider" /><button className="af-profile" onClick={() => setPasswordDialog(true)}><span className="af-avatar">AU</span><span><strong>{user?.facilityName || 'Afrimedico Admin'}</strong><small>Administrator</small></span><b>⌄</b></button></div></header>
      <main className="af-content">      <div className="af-demo-banner"><span>PREVIEW WORKSPACE</span><i /> Sample operational records <b>·</b> {apiOrders.length} live orders <b>·</b> {apiProducts.length} catalogue products <b>·</b> {apiPharmacies.length} pharmacy accounts</div>
        {error && <div className="af-error">{error}<button onClick={() => setError('')}>×</button></div>}
        {pageContent[currentNav]()}
        {currentNav === 'Dashboard' && apiLoading && <section className="af-card af-live-review"><div className="af-card-head"><div><h2>Loading live operations</h2><p>Fetching pharmacy, order and stock records</p></div></div><div className="af-skeleton-list">{[1, 2, 3].map((item) => <div className="af-skeleton-row" key={item}><i /><span /><span /><b /></div>)}</div></section>}
        {currentNav === 'Dashboard' && !apiLoading && apiPharmacies.filter((item) => item.verificationStatus === 'pending').length > 0 && <section className="af-card af-live-review"><div className="af-card-head"><div><h2>Live pharmacy verification</h2><p>Submitted applications from the marketplace</p></div><span className="af-live-badge">LIVE</span></div><DataTable rowKey="id" rows={apiPharmacies.filter((item) => item.verificationStatus === 'pending')} columns={[{ label: 'FACILITY', key: 'facilityName' }, { label: 'EMAIL', key: 'email' }, { label: 'SUBMITTED', key: 'createdAt', render: (row) => new Date(row.createdAt).toLocaleDateString('en-GB') }, { label: 'DOCUMENT', key: 'documentName' }, { label: 'REVIEW', render: (row) => <span className="af-review-actions"><button onClick={(event) => { event.stopPropagation(); approvePharmacy(row, 'approve'); }}>Approve</button><button onClick={(event) => { event.stopPropagation(); approvePharmacy(row, 'reject'); }}>Reject</button></span> }]} /></section>}
        <footer className="af-footer"><span>© 2026 AFRIMEDICO RWANDA</span><span>Kigali, Rwanda · CAT (UTC+2)</span></footer>
      </main>
    </div>
    {drawer && <Drawer title={drawer.type === 'new-proforma' ? 'Create proforma' : drawer.type === 'new-product' ? 'Add product' : drawer.type === 'new-advert' ? 'Create campaign' : drawer.type === 'new-customer' ? 'Add customer' : drawer.record?.ref || drawer.record?.name || drawer.record?.facility || 'Record details'} subtitle={drawer.record?.facility || 'Afrimedico operations'} onClose={() => setDrawer(null)}>
      {drawer.type === 'proforma' && drawer.record && <><div className="af-drawer-summary"><small>CUSTOMER</small><strong>{drawer.record.facility}</strong><span>{drawer.record.contact} · {drawer.record.email}</span></div><div className="af-detail-heading"><h3>Line items</h3><span>Edit quantities and unit prices</span></div><div className="af-line-items">{drawer.record.items.map((item, index) => <div className="af-editable-line" key={item.name}><strong>{item.name}</strong><div><label>Qty<input type="number" min="1" value={item.qty} onChange={(event) => updateProformaLine(drawer.record, index, 'qty', event.target.value)} /></label><label>Unit price<input type="number" min="0" value={item.price} onChange={(event) => updateProformaLine(drawer.record, index, 'price', event.target.value)} /></label><b>{currency(item.qty * item.price)}</b></div></div>)}</div><div className="af-detail-total"><span>Proforma total</span><strong>{currency(drawer.record.total)}</strong></div><label className="af-note-label">Note to customer<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add context about approval, adjustments or next steps…" /></label><div className="af-drawer-actions"><Button onClick={() => setConfirm({ title: 'Reject this proforma?', message: `${drawer.record.ref} · ${drawer.record.facility}`, action: () => { updateProforma(drawer.record, 'Rejected'); setConfirm(null); } })}>Reject</Button><Button onClick={() => updateProforma(drawer.record, 'Submitted')}>Save adjustment</Button><Button primary onClick={() => updateProforma(drawer.record, 'Approved')}>Approve & create invoice</Button></div></>}
      {drawer.type === 'order' && drawer.record && <><div className="af-drawer-summary"><small>ORDER STATUS</small><Status>{drawer.record.status}</Status><strong>{drawer.record.facility}</strong><span>{currency(drawer.record.total)} · {drawer.record.ref}</span></div><div className="af-detail-fields"><label>Driver<select value={drawer.record.driver || 'Not assigned'} onChange={(event) => setOrders((list) => list.map((item) => item.ref === drawer.record.ref ? { ...item, driver: event.target.value } : item))}>{['Not assigned', 'Jean Bosco', 'Emmanuel N.', 'Patrick M.', 'Aline K.'].map((driver) => <option key={driver}>{driver}</option>)}</select></label><label>Vehicle<input defaultValue={drawer.record.vehicle === '—' ? '' : drawer.record.vehicle} placeholder="e.g. RAC 482 B" /></label><label>Estimated arrival<input type="datetime-local" /></label><label>Delivery note<textarea placeholder="Record signed delivery note details…" /></label></div><div className="af-drawer-actions"><Button onClick={() => setDrawer(null)}>Close</Button><Button primary onClick={() => { setOrders((list) => list.map((item) => item.ref === drawer.record.ref ? { ...item, status: item.status === 'Approved' ? 'Packed' : item.status === 'Packed' ? 'Dispatched' : item.status === 'Dispatched' ? 'Delivered' : item.status } : item)); setDrawer(null); notify('Delivery progress saved.'); }}>Save delivery update</Button></div></>}
      {drawer.type === 'invoice' && drawer.record && <><div className="af-drawer-summary"><small>AFRIMEDICO RWANDA · TAX INVOICE</small><strong>{drawer.record.ref}</strong><Status>{drawer.record.status}</Status><span>Bill to {drawer.record.facility}</span><span>Payment method: {drawer.record.method}</span><span>Issued {drawer.record.date}</span></div><div className="af-detail-total"><span>Amount due</span><strong>{currency(drawer.record.amount)}</strong></div><p className="af-drawer-copy">Payments are accepted via MTN MoMo, Airtel Money and bank transfer. Keep this invoice reference with your payment.</p><div className="af-drawer-actions"><Button onClick={() => window.print()}>↓ Print / Save invoice PDF</Button>{drawer.record.status === 'Paid' && <Button onClick={() => window.print()}>↓ Print / Save receipt PDF</Button>}</div></>}
      {drawer.type === 'product' && drawer.record && <><div className="af-drawer-summary"><small>{drawer.record.category} · {drawer.record.sku}</small><strong>{drawer.record.name}</strong><span>Batch {drawer.record.batch} · Expires {drawer.record.expiry}</span></div><div className="af-detail-total"><span>Available stock</span><strong>{drawer.record.stock.toLocaleString()} units</strong></div><label className="af-note-label">Catalogue access<select value={drawer.record.access} onChange={(event) => setProducts((list) => list.map((item) => item.sku === drawer.record.sku ? { ...item, access: event.target.value } : item))}><option>Open catalogue</option><option>Premium only</option></select></label><div className="af-drawer-actions"><Button onClick={() => notify('Rwanda FDA certificate preview opened.')}>View FDA certificate</Button><Button primary onClick={() => notify('Product details saved.')}>Save changes</Button></div></>}
      {drawer.type === 'customer' && drawer.record && <><div className="af-drawer-summary"><small>{drawer.record.type} · {drawer.record.region} Province</small><strong>{drawer.record.facility}</strong><span>{drawer.record.contact}</span></div><div className="af-detail-fields"><div><small>ORDERS</small><strong>{drawer.record.orders}</strong></div><div><small>TOTAL SPEND</small><strong>{currency(drawer.record.spend)}</strong></div><div><small>MEMBERSHIP</small><Status>{drawer.record.premium ? 'Premium' : 'Standard'}</Status></div></div><label className="af-note-label">Account notes<textarea value={drawer.record.notes || ''} onChange={(event) => { const updated = { ...drawer.record, notes: event.target.value }; setCustomers((list) => list.map((item) => item.facility === drawer.record.facility ? updated : item)); setDrawer((current) => ({ ...current, record: updated })); }} placeholder="Add an account note…" /></label><div className="af-drawer-actions"><Button primary onClick={() => { setDrawer(null); notify('Customer notes saved.'); }}>Save customer notes</Button></div></>}
      {drawer.type === 'member' && drawer.record && <><div className="af-drawer-summary"><small>PREMIUM MEMBER</small><strong>{drawer.record.facility}</strong><Status>{drawer.record.status}</Status></div><div className="af-detail-total"><span>Monthly membership</span><strong>{currency(10000)}</strong></div><div className="af-drawer-copy">6% discount on all products · Renewal {drawer.record.renewal}<br />Payment history · {drawer.record.since}: {currency(10000)} · MTN MoMo</div><div className="af-drawer-actions"><Button onClick={() => setConfirm({ title: 'End this membership?', message: `${drawer.record.facility} will lose Premium pricing access.`, action: () => { setMembers((list) => list.map((item) => item.facility === drawer.record.facility ? { ...item, status: 'Lapsed' } : item)); setDrawer(null); setConfirm(null); notify('Membership ended.'); } })}>End membership</Button><Button primary onClick={() => notify('Membership payment recorded.')}>Record payment</Button></div></>}
      {drawer.type === 'advert' && drawer.record && <><div className="af-ad-preview compact"><div><span>{drawer.record.placement}</span><h2>{drawer.record.name}</h2><p>Preview your customer-facing campaign banner.</p></div></div><div className="af-drawer-copy">Scheduled {drawer.record.schedule}</div><div className="af-drawer-actions"><Button onClick={() => notify('Campaign paused.')}>Pause campaign</Button><Button primary onClick={() => notify('Campaign schedule saved.')}>Save campaign</Button></div></>}
      {drawer.type === 'new-proforma' && <><div className="af-detail-fields"><label>Facility<select value={proformaDraft.facility} onChange={(event) => setProformaDraft({ ...proformaDraft, facility: event.target.value })}>{customers.map((item) => <option key={item.facility}>{item.facility}</option>)}</select></label><label>Product<select value={proformaDraft.sku} onChange={(event) => setProformaDraft({ ...proformaDraft, sku: event.target.value })}>{products.map((item) => <option key={item.sku} value={item.sku}>{item.name}</option>)}</select></label><label>Quantity<input type="number" min="1" required value={proformaDraft.quantity} onChange={(event) => setProformaDraft({ ...proformaDraft, quantity: event.target.value })} /></label></div><div className="af-drawer-actions"><Button onClick={() => setDrawer(null)}>Cancel</Button><Button primary onClick={createProforma}>Save draft</Button></div></>}
      {drawer.type === 'new-product' && <><div className="af-detail-fields"><label>Product name<input required value={productDraft.name} onChange={(event) => setProductDraft({ ...productDraft, name: event.target.value })} placeholder="e.g. Medical supplies" /></label><label>Category<select value={productDraft.category} onChange={(event) => setProductDraft({ ...productDraft, category: event.target.value })}>{['Medicines', 'Equipment', 'Laboratory', 'Consumables', 'Oxygen'].map((category) => <option key={category}>{category}</option>)}</select></label><label>Price (RWF)<input type="number" min="0" required value={productDraft.price} onChange={(event) => setProductDraft({ ...productDraft, price: event.target.value })} /></label><label>Stock on hand<input type="number" min="0" value={productDraft.stock} onChange={(event) => setProductDraft({ ...productDraft, stock: event.target.value })} /></label><label>Reorder threshold<input type="number" min="0" value={productDraft.min} onChange={(event) => setProductDraft({ ...productDraft, min: event.target.value })} /></label><label>Batch number<input required value={productDraft.batch} onChange={(event) => setProductDraft({ ...productDraft, batch: event.target.value })} placeholder="Batch reference" /></label><label>Expiry date<input type="date" required value={productDraft.expiry} onChange={(event) => setProductDraft({ ...productDraft, expiry: event.target.value })} /></label><label>Catalogue access<select value={productDraft.access} onChange={(event) => setProductDraft({ ...productDraft, access: event.target.value })}><option>Open catalogue</option><option>Premium only</option></select></label><label>Rwanda FDA certificate<input type="file" accept=".pdf,.png,.jpg" /></label><label>Product image<input type="file" accept="image/*" /></label></div><div className="af-drawer-actions"><Button onClick={() => setDrawer(null)}>Cancel</Button><Button primary onClick={createProduct}>Save product</Button></div></>}
      {drawer.type === 'new-advert' && <><div className="af-detail-fields"><label>Campaign name<input required value={advertDraft.name} onChange={(event) => setAdvertDraft({ ...advertDraft, name: event.target.value })} placeholder="Campaign title" /></label><label>Placement<select value={advertDraft.placement} onChange={(event) => setAdvertDraft({ ...advertDraft, placement: event.target.value })}><option>Home slider</option><option>Category banner</option></select></label><label>Category link<select value={advertDraft.category} onChange={(event) => setAdvertDraft({ ...advertDraft, category: event.target.value })}>{['Medicines', 'Equipment', 'Laboratory', 'Consumables', 'Oxygen'].map((category) => <option key={category}>{category}</option>)}</select></label><label>Start date<input type="date" required value={advertDraft.start} onChange={(event) => setAdvertDraft({ ...advertDraft, start: event.target.value })} /></label><label>End date<input type="date" required value={advertDraft.end} onChange={(event) => setAdvertDraft({ ...advertDraft, end: event.target.value })} /></label><label>Banner image<input type="file" accept="image/*" /></label></div><div className="af-drawer-actions"><Button onClick={() => setDrawer(null)}>Cancel</Button><Button primary onClick={createAdvert}>Save campaign schedule</Button></div></>}
      {drawer.type === 'new-customer' && <><div className="af-detail-fields"><label>Facility name<input required value={customerDraft.facility} onChange={(event) => setCustomerDraft({ ...customerDraft, facility: event.target.value })} placeholder="e.g. Nyamata District Hospital" /></label><label>Facility type<select value={customerDraft.type} onChange={(event) => setCustomerDraft({ ...customerDraft, type: event.target.value })}><option>Pharmacy</option><option>Clinic</option><option>Hospital</option></select></label><label>Primary contact<input required value={customerDraft.contact} onChange={(event) => setCustomerDraft({ ...customerDraft, contact: event.target.value })} /></label><label>Email address<input type="email" value={customerDraft.email} onChange={(event) => setCustomerDraft({ ...customerDraft, email: event.target.value })} /></label><label>Region<select value={customerDraft.region} onChange={(event) => setCustomerDraft({ ...customerDraft, region: event.target.value })}>{['Kigali', 'Northern', 'Southern', 'Eastern', 'Western'].map((region) => <option key={region}>{region}</option>)}</select></label></div><div className="af-drawer-actions"><Button onClick={() => setDrawer(null)}>Cancel</Button><Button primary onClick={createCustomer}>Create customer profile</Button></div></>}
    </Drawer>}
    {passwordDialog && <Drawer title="Change password" subtitle="Update your secure administrator credentials." onClose={() => setPasswordDialog(false)}><form className="af-detail-fields" onSubmit={changePassword}><label>Current password<input type="password" required value={passwordFields.currentPassword} onChange={(event) => setPasswordFields({ ...passwordFields, currentPassword: event.target.value })} /></label><label>New password<input type="password" required minLength="12" value={passwordFields.newPassword} onChange={(event) => setPasswordFields({ ...passwordFields, newPassword: event.target.value })} /></label><div className="af-drawer-actions"><Button onClick={() => setPasswordDialog(false)}>Cancel</Button><button className="af-button primary">Update password</button></div></form></Drawer>}
    {confirm && <div className="af-confirm-backdrop"><section className="af-confirm" role="alertdialog" aria-modal="true"><span>!</span><h2>{confirm.title}</h2><p>{confirm.message}</p><div><Button onClick={() => setConfirm(null)}>Cancel</Button><Button primary onClick={confirm.action}>Confirm payment</Button></div></section></div>}
    {toast && <div className="af-toast"><span>✓</span>{toast}<button onClick={() => setToast('')}>×</button></div>}
  </div>;
}

export default AdminPortal;
