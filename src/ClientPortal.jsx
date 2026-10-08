import { useEffect, useMemo, useRef, useState } from 'react';
import './client.css';
import { apiUrl } from './api';

const USER_KEY = 'afrimedico-client-user';
const TOKEN_KEY = 'afrimedico-client-token';
const CART_KEY = 'afrimedico-premium-cart';
const DRAFT_KEY = 'afrimedico-premium-drafts';
const money = (amount) => `${Number(amount || 0).toLocaleString('en-US')} RWF`;
const discounted = (amount) => Math.round(Number(amount || 0) * 0.94);
const memberPrice = (amount, isPremium) => isPremium ? discounted(amount) : Number(amount || 0);
const tabs = [['Home', '⌂'], ['Shop', '▦'], ['Proformas', '▤'], ['Orders', '⇢'], ['Invoices', '▧'], ['Account', '♙']];
const categories = ['Medicines', 'Equipment', 'Laboratory', 'Consumables', 'Oxygen'];

const sampleProducts = [
  { id: 'amoxicillin', name: 'Amoxicillin 500 mg capsules', category: 'Medicines', brand: 'Afrimedico Select', pack: 'Box of 100', price: 6500, stock: 'In stock', mark: 'AMX', batch: 'RW-AMX-2408', expiry: '18 Mar 2027', premiumOnly: false, description: 'Quality-assured antibiotic capsules for registered healthcare facilities.' },
  { id: 'paracetamol', name: 'Paracetamol 500 mg tablets', category: 'Medicines', brand: 'Rwanda Pharma', pack: 'Box of 1,000', price: 9800, stock: 'In stock', mark: 'PAR', batch: 'PAR-2609-14', expiry: '25 Aug 2028', premiumOnly: false, description: 'Reliable everyday analgesic supply in wholesale packaging.' },
  { id: 'malaria-kit', name: 'Malaria rapid test kit', category: 'Laboratory', brand: 'SD Biosensor', pack: 'Box of 50 tests', price: 28000, stock: 'Low stock', mark: 'RDT', batch: 'RDT-2026-041', expiry: '12 Dec 2026', premiumOnly: false, description: 'Rapid diagnostic test kits with quality documentation.' },
  { id: 'gloves', name: 'Nitrile examination gloves', category: 'Consumables', brand: 'Medline', pack: 'Box of 100', price: 7500, stock: 'In stock', mark: 'N', batch: 'NG-0826-RW', expiry: '09 Jun 2028', premiumOnly: false, description: 'Powder-free nitrile examination gloves, assorted sizes.' },
  { id: 'oxygen-refill', name: 'Oxygen cylinder refill, 40 L', category: 'Oxygen', brand: 'Afrimedico Oxygen', pack: 'Per cylinder', price: 35000, stock: 'In stock', mark: 'O₂', batch: 'O2-40L-0926', expiry: '30 Nov 2026', premiumOnly: false, description: 'Medical-grade oxygen refill with cylinder safety check.' },
  { id: 'patient-monitor', name: 'Patient monitor, 5-parameter', category: 'Equipment', brand: 'Mindray', pack: 'Each · warranty included', price: 1480000, stock: 'In stock', mark: 'PM', batch: 'MN-2409-07', expiry: 'N/A', premiumOnly: true, description: 'Portable monitor for ECG, SpO₂, NIBP, temperature and respiration.' },
  { id: 'oxygen-concentrator', name: 'Oxygen concentrator, 10 L', category: 'Oxygen', brand: 'Yuwell', pack: 'Each · Premium bulk price', price: 920000, stock: 'Low stock', mark: 'O₂', batch: 'YW-10L-110', expiry: 'N/A', premiumOnly: true, description: 'High-capacity concentrator supplied with accessories and documentation.' },
  { id: 'pulse-oximeter', name: 'Pulse oximeter, fingertip', category: 'Equipment', brand: 'ChoiceMMed', pack: 'Each', price: 18500, stock: 'Low stock', mark: 'SpO₂', batch: 'CM-PO-101', expiry: 'N/A', premiumOnly: false, description: 'Compact fingertip oxygen saturation and pulse-rate monitor.' },
  { id: 'syringes', name: 'Syringes 5 ml with needle', category: 'Consumables', brand: 'BD', pack: 'Box of 100', price: 5400, stock: 'In stock', mark: '5ml', batch: 'BD-5ML-0082', expiry: '21 Jan 2029', premiumOnly: false, description: 'Sterile single-use syringes in sealed wholesale cartons.' }
];

const sampleOrders = [
  { id: 'ORD-2026-0918', facility_name: 'Kigali Community Clinic', total: 276000, status: 'Dispatched', created_at: '2026-10-08T08:00:00Z', eta: 'Today, 14:30', driver: 'Jean Bosco', vehicle: 'RAC 482 B' },
  { id: 'ORD-2026-0891', facility_name: 'Kigali Community Clinic', total: 184500, status: 'Delivered', created_at: '2026-10-02T10:30:00Z', eta: 'Delivered 09:42', driver: 'Patrick M.', vehicle: 'RAD 105 A' },
  { id: 'ORD-2026-0844', facility_name: 'Kigali Community Clinic', total: 420000, status: 'Delivered', created_at: '2026-09-24T12:00:00Z', eta: 'Delivered 15:16', driver: 'Emmanuel N.', vehicle: 'RAB 226 C' }
];

const sampleInvoices = [
  { id: 'INV-2026-0731', facility: 'Kigali Community Clinic', amount: 420000, method: 'MTN MoMo', status: 'Paid', date: '08 Oct 2026', due: '08 Oct 2026' },
  { id: 'INV-2026-0730', facility: 'Kigali Community Clinic', amount: 276000, method: 'Bank transfer', status: 'Awaiting payment', date: '08 Oct 2026', due: '15 Oct 2026' },
  { id: 'INV-2026-0714', facility: 'Kigali Community Clinic', amount: 184500, method: 'Airtel Money', status: 'Paid', date: '02 Oct 2026', due: '09 Oct 2026' }
];

function useSavedState(key, fallback) {
  const [state, setState] = useState(() => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(state)); } catch { /* Keep the current session usable if storage is full. */ }
  }, [key, state]);
  return [state, setState];
}

function Pill({ children }) {
  const status = String(children).toLowerCase();
  const color = /paid|delivered|approved|active|invoiced/.test(status) ? 'green' : /overdue|rejected|cancelled|out of stock/.test(status) ? 'red' : /submitted|dispatched|in transit|awaiting|low stock|pending/.test(status) ? 'amber' : 'blue';
  return <span className={`cp-pill ${color}`}><i />{children}</span>;
}

function Money({ children, className = '' }) {
  return <span className={`cp-money ${className}`}>{money(children)}</span>;
}

function ActionButton({ children, primary = false, onClick, ...props }) {
  return <button type="button" onClick={onClick} className={`cp-button ${primary ? 'primary' : ''}`} {...props}>{children}</button>;
}

function Sheet({ title, onClose, children }) {
  useEffect(() => {
    const onKeyDown = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);
  return <div className="cp-sheet-overlay" onMouseDown={onClose}><section className="cp-sheet" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}><header><h2>{title}</h2><button onClick={onClose} aria-label="Close">×</button></header>{children}</section></div>;
}

function SignaturePad({ onChange }) {
  const canvas = useRef(null);
  const drawing = useRef(false);
  const point = (event) => {
    const bounds = canvas.current.getBoundingClientRect();
    return { x: (event.clientX - bounds.left) * (canvas.current.width / bounds.width), y: (event.clientY - bounds.top) * (canvas.current.height / bounds.height) };
  };
  const start = (event) => {
    drawing.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    const context = canvas.current.getContext('2d');
    const position = point(event);
    context.beginPath(); context.moveTo(position.x, position.y);
  };
  const draw = (event) => {
    if (!drawing.current) return;
    const context = canvas.current.getContext('2d');
    const position = point(event);
    context.lineWidth = 2.5; context.lineCap = 'round'; context.strokeStyle = '#12783A';
    context.lineTo(position.x, position.y); context.stroke();
  };
  const stop = () => {
    if (!drawing.current) return;
    drawing.current = false;
    onChange(canvas.current.toDataURL());
  };
  const clear = () => {
    const context = canvas.current.getContext('2d');
    context.clearRect(0, 0, canvas.current.width, canvas.current.height);
    onChange('');
  };
  return <div className="cp-signature-canvas-wrap"><canvas ref={canvas} width="600" height="140" onPointerDown={start} onPointerMove={draw} onPointerUp={stop} onPointerCancel={stop} aria-label="Draw recipient signature" /><button type="button" onClick={clear}>Clear signature</button></div>;
}

function ClientPortal() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || '');
  const [user, setUser] = useState(() => { try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; } });
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({ facilityName: '', email: '', password: '', document: null });
  const [page, setPage] = useState('Home');
  const [products, setProducts] = useState(sampleProducts);
  const [serverOrders, setServerOrders] = useState([]);
  const [cart, setCart] = useSavedState(CART_KEY, {});
  const [drafts, setDrafts] = useSavedState(DRAFT_KEY, []);
  const [proformaDetails, setProformaDetails] = useSavedState('afrimedico-client-proforma-details', { address: 'KN 4 Ave, Nyarugenge, Kigali', notes: '' });
  const [savedOrders, setSavedOrders] = useSavedState('afrimedico-client-sample-orders', sampleOrders);
  const [invoices, setInvoices] = useSavedState('afrimedico-client-invoices', sampleInvoices);
  const [membership, setMembership] = useSavedState('afrimedico-client-membership', { status: 'Active', renewal: '03 Nov 2026', fee: 10000, discount: 6 });
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [brand, setBrand] = useState('All brands');
  const [availability, setAvailability] = useState('Any availability');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [loading, setLoading] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [detailProduct, setDetailProduct] = useState(null);
  const [paymentInvoice, setPaymentInvoice] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('MTN MoMo');
  const [slide, setSlide] = useState(0);
  const [profileMenu, setProfileMenu] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [supportDraft, setSupportDraft] = useState('');
  const [supportMessages, setSupportMessages] = useSavedState('afrimedico-client-support', [
    { author: 'Alice Uwimana · Account manager', text: 'Welcome to your Premium workspace. Let me know if you need help with a supply request.', date: 'Today, 09:15', mine: false }
  ]);
  const [signatureOpen, setSignatureOpen] = useState(false);
  const [recipientName, setRecipientName] = useState('');
  const [signatureDrawn, setSignatureDrawn] = useState('');
  const [dark, setDark] = useSavedState('afrimedico-client-dark-mode', false);

  const notify = (message) => { setToast(message); window.setTimeout(() => setToast(''), 3200); };
  const pharmacyName = user?.facilityName || user?.facility_name || 'Kigali Community Clinic';
  const isPremium = membership.status === 'Active';

  useEffect(() => {
    document.title = 'Afrimedico | Premium partner';
    const onlineHandler = () => setOnline(true);
    const offlineHandler = () => setOnline(false);
    window.addEventListener('online', onlineHandler);
    window.addEventListener('offline', offlineHandler);
    return () => {
      window.removeEventListener('online', onlineHandler);
      window.removeEventListener('offline', offlineHandler);
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.cpTheme = dark ? 'dark' : 'light';
  }, [dark]);

  useEffect(() => {
    let active = true;
    async function loadClientData() {
      try {
        const response = await fetch(apiUrl('/api/products'));
        if (!response.ok) throw new Error('Unable to load the current product catalogue.');
        const liveProducts = await response.json();
        if (!active || !Array.isArray(liveProducts)) return;
        const merged = liveProducts.map((product) => {
          const sample = sampleProducts.find((item) => item.id === product.id);
          return sample ? { ...sample, ...product, brand: sample.brand, batch: sample.batch, expiry: sample.expiry, premiumOnly: sample.premiumOnly, description: sample.description } : { ...product, brand: 'Afrimedico verified', batch: 'Available on confirmation', expiry: 'See certificate', premiumOnly: false, description: 'Quality-assured medical supply available to verified facilities.' };
        });
        const moreSamples = sampleProducts.filter((sample) => !liveProducts.some((product) => product.id === sample.id));
        setProducts([...merged, ...moreSamples]);
      } catch (requestError) {
        if (active) setError(requestError.message);
      }
    }
    loadClientData();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    if (!token || user?.role !== 'pharmacy') return undefined;
    setLoading(true);
    fetch(apiUrl('/api/orders'), { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        if (response.status === 401) throw new Error('Your session expired. Please sign in again.');
        if (!response.ok) throw new Error('Unable to load your orders.');
        return response.json();
      })
      .then((orders) => { if (active && Array.isArray(orders)) setServerOrders(orders); })
      .catch((requestError) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, user?.role]);

  useEffect(() => {
    const interval = window.setInterval(() => setSlide((current) => (current + 1) % 3), 7000);
    return () => window.clearInterval(interval);
  }, []);

  const cartLines = useMemo(() => Object.entries(cart).map(([id, quantity]) => {
    const product = products.find((item) => item.id === id);
    return product ? { ...product, quantity: Number(quantity) || 0 } : null;
  }).filter(Boolean), [cart, products]);
  const cartCount = cartLines.reduce((count, item) => count + item.quantity, 0);
  const subtotal = cartLines.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const savings = isPremium ? Math.round(subtotal * 0.06) : 0;
  const total = subtotal - savings;
  const visibleProducts = products.filter((product) => (
    (category === 'All' || product.category === category)
    && (brand === 'All brands' || product.brand === brand)
    && (availability === 'Any availability' || product.stock === availability)
    && `${product.name} ${product.category} ${product.brand} ${product.pack}`.toLowerCase().includes(search.toLowerCase())
  ));
  const orders = serverOrders.length ? serverOrders : savedOrders;
  const frequentProducts = [products.find((item) => item.id === 'amoxicillin'), products.find((item) => item.id === 'gloves'), products.find((item) => item.id === 'malaria-kit')].filter(Boolean);

  const signIn = async (event) => {
    event.preventDefault(); setError(''); setNotice('');
    const body = new FormData();
    if (authMode === 'register') {
      body.append('facilityName', authForm.facilityName);
      body.append('email', authForm.email);
      body.append('password', authForm.password);
      if (authForm.document) body.append('document', authForm.document);
    }
    try {
      const response = await fetch(apiUrl(authMode === 'login' ? '/api/auth/login' : '/api/auth/register'), {
        method: 'POST',
        headers: authMode === 'login' ? { 'Content-Type': 'application/json' } : undefined,
        body: authMode === 'login' ? JSON.stringify({ email: authForm.email, password: authForm.password }) : body
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'Unable to sign in.');
      if (payload.user?.role !== 'pharmacy' || !payload.token) throw new Error('Use a pharmacy partner account to access this portal.');
      setUser(payload.user); setToken(payload.token);
      localStorage.setItem(USER_KEY, JSON.stringify(payload.user)); localStorage.setItem(TOKEN_KEY, payload.token);
      setAuthForm({ facilityName: '', email: '', password: '', document: null });
      notify(authMode === 'register' ? 'Your pharmacy application is submitted for verification.' : 'Welcome to your Premium partner workspace.');
    } catch (requestError) { setError(requestError.message || 'Unable to connect to Afrimedico.'); }
  };

  const signOut = async () => {
    try { if (token) await fetch(apiUrl('/api/auth/logout'), { method: 'POST', headers: { Authorization: `Bearer ${token}` } }); }
    catch { setError('Could not confirm sign out with the server. Your local session has been cleared.'); }
    finally {
      localStorage.removeItem(USER_KEY); localStorage.removeItem(TOKEN_KEY);
      setUser(null); setToken(''); setServerOrders([]); setProfileMenu(false);
    }
  };

  const changeQuantity = (id, delta) => setCart((current) => {
    const next = (Number(current[id]) || 0) + delta;
    if (next <= 0) { const { [id]: _, ...rest } = current; return rest; }
    return { ...current, [id]: Math.min(next, 1000) };
  });

  const addToCart = (product) => {
    if (product.premiumOnly && !isPremium) { notify('Renew your Premium membership to access this product.'); return; }
    setCart((current) => ({ ...current, [product.id]: (Number(current[product.id]) || 0) + 1 }));
    notify(`${product.name} added to your proforma.`);
  };

  const saveDraft = () => {
    if (!cartLines.length) { notify('Add products to your proforma before saving a draft.'); return; }
    const draft = {
      id: `PF-DRAFT-${String(Date.now()).slice(-6)}`,
      date: new Date().toLocaleDateString('en-GB'),
      status: 'Draft',
      items: cartLines.map(({ id, name, quantity, price }) => ({ id, name, quantity, price })),
      subtotal, discount: savings, total,
      deliveryAddress: proformaDetails.address, notes: proformaDetails.notes
    };
    setDrafts((current) => [draft, ...current]);
    notify(online ? 'Proforma draft saved on this device.' : 'Draft saved locally. Live draft sync is not connected yet.');
  };

  const submitProforma = () => {
    if (!cartLines.length) { notify('Add at least one product before submitting.'); return; }
    if (user?.verificationStatus !== 'approved') { setError('Your pharmacy account must be approved before placing a wholesale request.'); return; }
    const record = {
      id: `PF-2026-${String(148 + drafts.length).padStart(4, '0')}`,
      date: new Date().toLocaleDateString('en-GB'),
      status: 'Submitted',
      facility: pharmacyName,
      items: cartLines.map(({ id, name, quantity, price }) => ({ id, name, quantity, price })),
      subtotal, discount: savings, total,
      deliveryAddress: proformaDetails.address, notes: proformaDetails.notes,
      preview: true
    };
    setDrafts((current) => [record, ...current]);
    setCart({});
    setPage('Proformas');
    setNotice('Your proforma is saved in this workspace preview. Live proforma submission will be enabled when the approval service is connected.');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const duplicateProforma = (draft) => {
    setCart(Object.fromEntries(draft.items.map((item) => [item.id, item.quantity])));
    setProformaDetails({ address: draft.deliveryAddress || proformaDetails.address, notes: draft.notes || '' });
    setPage('Proformas');
    notify('Proforma copied into your builder.');
  };

  const openPayment = (invoice) => { setPaymentInvoice(invoice); setPaymentMethod('MTN MoMo'); };
  const startPayment = async () => {
    setPaymentInvoice(null);
    setNotice(`Payment for ${paymentInvoice.id} is unavailable: a payment provider is not connected. No payment was taken.`);
  };

  const signDelivery = () => {
    if (!recipientName.trim()) { notify('Enter the recipient name to confirm delivery.'); return; }
    const orderId = orders[0]?.id;
    setSavedOrders((list) => list.map((order) => order.id === orderId ? { ...order, status: 'Delivered', signedBy: recipientName.trim(), signature: signatureDrawn, eta: 'Delivered just now' } : order));
    setSignatureOpen(false); setRecipientName(''); setSignatureDrawn('');
    notify('Delivery confirmation saved in this preview.');
  };

  const sendSupportMessage = () => {
    if (!supportDraft.trim()) return;
    setSupportMessages((list) => [...list, { author: pharmacyName, text: supportDraft.trim(), date: 'Just now', mine: true }]);
    setSupportDraft('');
    notify('Message saved to your support thread.');
  };

  const renderAuth = () => <div className="cp-auth-screen"><a className="cp-auth-brand" href="#home"><span className="cp-logo-mark">a<span>+</span></span><strong>afri<span>medico</span></strong></a><div className="cp-auth-card"><div className="cp-auth-mark">✚</div><p className="cp-kicker">PREMIUM PARTNER PORTAL</p><h1>{authMode === 'login' ? 'Your supply network, simplified.' : 'Join the Afrimedico network.'}</h1><p className="cp-auth-intro">{authMode === 'login' ? 'Sign in to reorder essential healthcare supplies and manage your facility.' : 'Register your pharmacy or facility for verified wholesale access.'}</p>{error && <div className="cp-error">{error}</div>}<form onSubmit={signIn}>
    {authMode === 'register' && <label>Facility name<input required value={authForm.facilityName} onChange={(event) => setAuthForm({ ...authForm, facilityName: event.target.value })} placeholder="e.g. Musanze District Hospital" /></label>}
    <label>Facility email<input type="email" required autoComplete="username" value={authForm.email} onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })} placeholder="procurement@facility.rw" /></label>
    <label>Password<input type="password" required minLength={authMode === 'register' ? 12 : undefined} autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} value={authForm.password} onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })} placeholder={authMode === 'register' ? 'At least 12 characters' : 'Your password'} /></label>
    {authMode === 'register' && <label>Pharmacy licence / registration<input type="file" required accept=".pdf,.jpg,.jpeg,.png" onChange={(event) => setAuthForm({ ...authForm, document: event.target.files?.[0] || null })} /></label>}
    <button className="cp-button primary cp-auth-submit">{authMode === 'login' ? 'Sign in securely' : 'Submit registration'}</button></form><div className="cp-auth-toggle"><span>{authMode === 'login' ? 'New to Afrimedico?' : 'Already have an account?'}</span><button onClick={() => { setError(''); setAuthMode(authMode === 'login' ? 'register' : 'login'); }}>{authMode === 'login' ? 'Register your facility' : 'Sign in'}</button></div></div><small className="cp-auth-foot">A trusted supply partner for Rwanda’s healthcare community</small></div>;

  const home = () => <div className="cp-page">
    <div className="cp-greeting"><div><p className="cp-eyebrow">THURSDAY, 08 OCTOBER 2026 <span>· KIGALI</span></p><h1>Good morning, {pharmacyName.split(' ')[0]}.</h1><p>Your trusted supply partner is ready when you are.</p></div><div className="cp-account-manager"><div className="cp-manager-photo" role="img" aria-label="Account manager Alice Uwimana">AU</div><div><small>YOUR ACCOUNT MANAGER</small><strong>Alice Uwimana</strong><span>Partner Success · Kigali</span></div><div className="cp-contact-menu"><a href="tel:+250788123456" aria-label="Call Alice Uwimana">☎</a><a href="https://wa.me/250788123456" target="_blank" rel="noreferrer" aria-label="Message Alice on WhatsApp">◉</a></div></div></div>
    {!isPremium && <div className="cp-renew-banner"><span>✦</span><div><strong>Keep your Premium benefits active</strong><p>Your membership needs renewal to continue enjoying 6% savings and Premium-only supplies.</p></div><ActionButton primary onClick={() => setPage('Account')}>Renew now</ActionButton></div>}
    {notice && <div className="cp-notice"><span>✓</span>{notice}<button onClick={() => setNotice('')}>×</button></div>}
    <div className={`cp-advert slide-${slide}`}><div className="cp-ad-copy"><span>AFRIMEDICO PREMIUM · MEMBER OFFER</span><h2>{['Care essentials, delivered with confidence.', 'Premium access to trusted medical equipment.', 'Better value for your next supply order.'][slide]}</h2><p>{['Save 6% on every order with your member benefit.', 'Explore verified equipment and bulk supply pricing.', 'Reorder essentials for your facility in a few taps.'][slide]}</p><button onClick={() => setPage('Shop')}>Explore member offers <span>→</span></button></div><div className="cp-ad-illustration"><span>✚</span><i /><b>6%</b></div><button className="cp-ad-arrow previous" onClick={() => setSlide((slide + 2) % 3)} aria-label="Previous offer">‹</button><button className="cp-ad-arrow next" onClick={() => setSlide((slide + 1) % 3)} aria-label="Next offer">›</button><div className="cp-ad-dots">{[0, 1, 2].map((index) => <button key={index} className={slide === index ? 'active' : ''} onClick={() => setSlide(index)} aria-label={`Offer ${index + 1}`} />)}</div></div>
    <div className="cp-kpis"><article><span className="cp-kpi-icon green">↗</span><small>SPEND THIS MONTH</small><strong>1,284,500 <i>RWF</i></strong><em>Across 4 orders</em></article><article><span className="cp-kpi-icon gold">✦</span><small>PREMIUM SAVINGS THIS YEAR</small><strong>184,000 <i>RWF</i></strong><em>6% member savings</em></article><article><span className="cp-kpi-icon blue">▤</span><small>OPEN PROFORMAS</small><strong>{drafts.filter((draft) => draft.status !== 'Paid').length.toString().padStart(2, '0')}</strong><em>Awaiting next step</em></article><article><span className="cp-kpi-icon amber">⇢</span><small>ORDERS IN TRANSIT</small><strong>{orders.filter((order) => /dispatched|transit/i.test(order.status)).length.toString().padStart(2, '0')}</strong><em>Priority delivery</em></article></div>
    <div className="cp-home-columns"><section className="cp-panel cp-reorder"><div className="cp-section-heading"><div><h2>Reorder in one tap</h2><p>Your frequently purchased essentials</p></div><button onClick={() => setPage('Orders')}>Order history →</button></div><div className="cp-reorder-list">{frequentProducts.map((product) => <div className="cp-reorder-row" key={product.id}><span className={`cp-product-mark mark-${product.category.toLowerCase()}`}>{product.mark}</span><div className="cp-reorder-info"><strong>{product.name}</strong><small>{product.pack} · Last ordered 24 Sep</small></div><div className="cp-reorder-price"><del>{money(product.price)}</del><strong>{money(discounted(product.price))}</strong></div><button className="cp-quick-add" onClick={() => addToCart(product)} aria-label={`Add ${product.name} to proforma`}>＋</button></div>)}</div></section>
      <section className="cp-panel cp-low-stock"><div className="cp-section-heading"><div><h2>Running low?</h2><p>Suggested based on your past orders</p></div><span className="cp-soft-alert">2 suggestions</span></div><div className="cp-suggestion"><span className="cp-suggestion-icon">RDT</span><div><strong>Malaria rapid test kit</strong><small>Last ordered 2 weeks ago</small></div><button onClick={() => addToCart(products.find((product) => product.id === 'malaria-kit'))}>Add</button></div><div className="cp-suggestion"><span className="cp-suggestion-icon blue">O₂</span><div><strong>Oxygen cylinder refill, 40 L</strong><small>Usual reorder: 12 units</small></div><button onClick={() => { const item = products.find((product) => product.id === 'oxygen-refill'); if (item) setCart((current) => ({ ...current, [item.id]: (Number(current[item.id]) || 0) + 12 })); notify('12 oxygen refills added to your proforma.'); }}>＋12</button></div><div className="cp-suggestion-foot">Suggestions are based on your recent purchasing pattern.</div></section></div>
    <section className="cp-panel cp-recent-orders"><div className="cp-section-heading"><div><h2>Recent orders</h2><p>Stay up to date with your facility’s supply requests</p></div><button onClick={() => setPage('Orders')}>All orders →</button></div><div className="cp-order-cards">{orders.slice(0, 2).map((order) => <button key={order.id} className="cp-order-preview" onClick={() => setPage('Orders')}><div><strong>{order.id}</strong><Pill>{order.status}</Pill></div><span>{order.facility_name || pharmacyName}</span><div><Money>{order.total}</Money><small>{new Date(order.created_at || Date.now()).toLocaleDateString('en-GB')}</small></div></button>)}</div></section>
  </div>;

  const shop = () => <div className="cp-page"><div className="cp-page-head"><div><p className="cp-eyebrow">VERIFIED WHOLESALE CATALOGUE</p><h1>Supply, made simpler.</h1><p>Quality essentials, thoughtfully sourced for your facility.</p></div><button className="cp-cart-button" onClick={() => setPage('Proformas')}>▤ Proforma <b>{cartCount}</b></button></div>
    <div className="cp-shop-toolbar"><label className="cp-search"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products, category or brand" /></label><select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filter category"><option>All</option>{categories.map((item) => <option key={item}>{item}</option>)}</select><select value={brand} onChange={(event) => setBrand(event.target.value)} aria-label="Filter brand"><option>All brands</option>{[...new Set(products.map((product) => product.brand))].map((item) => <option key={item}>{item}</option>)}</select><select value={availability} onChange={(event) => setAvailability(event.target.value)} aria-label="Filter availability"><option>Any availability</option><option>In stock</option><option>Low stock</option></select></div>
    <div className="cp-category-tiles">{categories.map((item, index) => <button key={item} className={category === item ? 'selected' : ''} onClick={() => setCategory(category === item ? 'All' : item)}><span>{['✚', '⌖', '⌬', '▦', '◉'][index]}</span><strong>{item}</strong><small>{products.filter((product) => product.category === item).length} products</small></button>)}</div>
    <div className="cp-shop-title"><div><h2>Open catalogue</h2><p>Member pricing is applied automatically to eligible orders.</p></div><span>{visibleProducts.filter((product) => !product.premiumOnly).length} products</span></div>
    <div className="cp-product-grid">{visibleProducts.filter((product) => !product.premiumOnly).map((product) => <ProductCard key={product.id} product={product} isPremium={isPremium} onAdd={() => addToCart(product)} onDetails={() => setDetailProduct(product)} />)}</div>
    <div className="cp-premium-window-head"><span>✦</span><div><h2>Premium window</h2><p>Exclusive equipment and bulk supplies, reserved for members.</p></div><b>PREMIUM ONLY</b></div><div className="cp-product-grid cp-premium-grid">{visibleProducts.filter((product) => product.premiumOnly).map((product) => <ProductCard key={product.id} product={product} isPremium={isPremium} onAdd={() => addToCart(product)} onDetails={() => setDetailProduct(product)} premium />)}</div>
    {!visibleProducts.length && <div className="cp-empty"><span>⌕</span><strong>No products match your search</strong><p>Try clearing filters or search by a different medicine or supply.</p><button onClick={() => { setSearch(''); setCategory('All'); setBrand('All brands'); setAvailability('Any availability'); }}>Clear filters</button></div>}
  </div>;

  const proformas = () => <div className="cp-page"><div className="cp-page-head"><div><p className="cp-eyebrow">YOUR WHOLESALE REQUESTS</p><h1>Proforma builder</h1><p>Build your next supply request and track each approval milestone.</p></div><button className="cp-cart-button" onClick={() => setPage('Shop')}>＋ Add products</button></div>
    {cartLines.length === 0 ? <div className="cp-empty cp-empty-panel"><span>▤</span><strong>Your proforma is ready when you are.</strong><p>Add products from the catalogue to create a quote for your facility.</p><button onClick={() => setPage('Shop')}>Explore catalogue →</button></div> : <div className="cp-builder-layout"><section className="cp-panel cp-builder-items"><div className="cp-section-heading"><div><h2>Items for {pharmacyName}</h2><p>{cartCount} units selected · Premium pricing shown</p></div><span className="cp-premium-badge">✦ Premium pricing</span></div>{cartLines.map((product) => <div className="cp-builder-line" key={product.id}><span className="cp-product-mark">{product.mark}</span><div className="cp-builder-product"><strong>{product.name}</strong><small>{product.pack}</small><span><del>{money(product.price)}</del> <b>{money(discounted(product.price))} / pack</b></span></div><div className="cp-quantity"><button onClick={() => changeQuantity(product.id, -1)} aria-label={`Decrease ${product.name}`}>−</button><span>{product.quantity}</span><button onClick={() => changeQuantity(product.id, 1)} aria-label={`Increase ${product.name}`}>＋</button></div><strong className="cp-line-total">{money(discounted(product.price) * product.quantity)}</strong><button className="cp-remove-line" onClick={() => changeQuantity(product.id, -product.quantity)} aria-label={`Remove ${product.name}`}>×</button></div>)}
      <div className="cp-builder-details"><label>Delivery address<input value={proformaDetails.address} onChange={(event) => setProformaDetails({ ...proformaDetails, address: event.target.value })} /></label><label>Order notes<textarea value={proformaDetails.notes} onChange={(event) => setProformaDetails({ ...proformaDetails, notes: event.target.value })} placeholder="Delivery instructions or procurement notes…" /></label></div></section>
      <aside className="cp-panel cp-total-card"><div className="cp-section-heading"><div><h2>Order summary</h2><p>Premium discount applied</p></div></div><div className="cp-summary-line"><span>Subtotal · {cartCount} units</span><strong>{money(subtotal)}</strong></div><div className="cp-summary-line cp-discount-line"><span>✦ Premium member discount (6%)</span><strong>− {money(savings)}</strong></div><div className="cp-summary-line"><span>Delivery</span><strong className="cp-included">Priority · Included</strong></div><div className="cp-summary-total"><span>Estimated total</span><strong>{money(total)}</strong></div><p className="cp-preview-disclaimer">Price preview only. Final quotation is confirmed by Afrimedico staff. This workspace does not submit live proformas yet.</p><button className="cp-button cp-full-button" onClick={saveDraft}>Save draft {online ? '' : 'offline'}</button><button className="cp-button primary cp-full-button" disabled={user?.verificationStatus !== 'approved'} onClick={submitProforma}>Submit for approval</button>{user?.verificationStatus !== 'approved' && <small className="cp-verification-hint">Your pharmacy must be approved before submitting requests.</small>}</aside></div>}
    <section className="cp-panel cp-saved-proformas"><div className="cp-section-heading"><div><h2>Saved proformas</h2><p>Drafts and recent requests for this facility</p></div><span>{drafts.length} records</span></div>{drafts.length === 0 ? <div className="cp-inline-empty">Your saved drafts will appear here. Start with the catalogue above.</div> : drafts.map((draft) => <div className="cp-saved-row" key={draft.id}><div><strong>{draft.id}</strong><small>{draft.date} · {draft.items.length} line items</small></div><Pill>{draft.status}</Pill><Money>{draft.total}</Money><button onClick={() => duplicateProforma(draft)}>Duplicate</button></div>)}</section>
  </div>;

  const orderPage = () => <div className="cp-page"><div className="cp-page-head"><div><p className="cp-eyebrow">FULFILMENT & DELIVERY</p><h1>Orders and delivery</h1><p>Follow every order from dispatch to your facility.</p></div><button className="cp-cart-button" onClick={() => setPage('Shop')}>＋ Reorder supplies</button></div>{loading && <div className="cp-skeleton-list">{[1, 2].map((item) => <div key={item} className="cp-skeleton" />)}</div>}{orders.map((order, index) => <section className="cp-panel cp-tracking-card" key={order.id}><div className="cp-section-heading"><div><h2>{order.id}</h2><p>{order.facility_name || pharmacyName} · {new Date(order.created_at || Date.now()).toLocaleDateString('en-GB')}</p></div><Pill>{order.status}</Pill></div><div className="cp-track-steps">{['Approved', 'Packed', 'Dispatched', 'Delivered'].map((status, step) => <div className={`cp-track-step ${step <= (index === 0 && /dispatched/i.test(order.status) ? 2 : /delivered/i.test(order.status) ? 3 : 1) ? 'complete' : ''}`} key={status}><i />{status}</div>)}</div><div className="cp-delivery-meta"><div><span>DRIVER</span><strong>{order.driver || 'Assigned after dispatch'}</strong></div><div><span>VEHICLE</span><strong>{order.vehicle || '—'}</strong></div><div><span>ESTIMATED ARRIVAL</span><strong>{order.eta || 'To be confirmed'}</strong></div><div><span>ORDER TOTAL</span><Money>{order.total}</Money></div></div>{/dispatched|transit/i.test(order.status) && <div className="cp-order-actions"><ActionButton onClick={() => setSignatureOpen(true)}>✍ Confirm delivery</ActionButton><ActionButton onClick={() => notify('Delivery note is available after a live delivery is confirmed.')}>↓ Delivery note</ActionButton></div>}</section>)}{!orders.length && <Empty title="No orders to track" description="Once your facility’s request is approved, order progress will appear here." action="Browse catalogue" onAction={() => setPage('Shop')} />}</div>;

  const invoicePage = () => <div className="cp-page"><div className="cp-page-head"><div><p className="cp-eyebrow">PAYMENTS & STATEMENTS</p><h1>Invoices and payments</h1><p>Review account balances and payment history.</p></div><ActionButton onClick={() => notify('Statement of account prepared for download.')}>↓ Statement</ActionButton></div><div className="cp-invoice-summary"><article><small>OUTSTANDING</small><strong>{money(invoices.filter((invoice) => invoice.status !== 'Paid').reduce((sum, invoice) => sum + invoice.amount, 0))}</strong><span>Across {invoices.filter((invoice) => invoice.status !== 'Paid').length} invoices</span></article><article><small>PAID THIS YEAR</small><strong>{money(1845000)}</strong><span>Thank you for your payments</span></article><article><small>PAYMENT OPTIONS</small><strong>3 channels</strong><span>MTN · Airtel · Bank</span></article></div><section className="cp-panel cp-invoice-list"><div className="cp-section-heading"><div><h2>Facility invoices</h2><p>Sample account statement · RWF</p></div><span className="cp-sample-tag">PREVIEW</span></div>{invoices.map((invoice) => <div className="cp-invoice-row" key={invoice.id}><div className="cp-invoice-ref"><strong>{invoice.id}</strong><small>Issued {invoice.date} · Due {invoice.due}</small></div><div className="cp-invoice-method"><small>PAYMENT METHOD</small><span>{invoice.method}</span></div><Money>{invoice.amount}</Money><Pill>{invoice.status}</Pill><div className="cp-invoice-actions"><button onClick={() => notify('Invoice PDF downloads become available with live invoice records.')}>↓ Invoice</button>{invoice.status === 'Paid' ? <button onClick={() => notify('Receipt downloads become available with live payment records.')}>↓ Receipt</button> : <button className="cp-pay-now" onClick={() => openPayment(invoice)}>Pay now →</button>}</div></div>)}</section><p className="cp-payment-caveat">Online payment collection is not connected yet. Payment buttons show the supported channels, but no funds are taken in this preview.</p></div>;

  const accountPage = () => <div className="cp-page"><div className="cp-page-head"><div><p className="cp-eyebrow">YOUR FACILITY PROFILE</p><h1>Account and membership</h1><p>Manage your facility details, users, addresses and preferences.</p></div><ActionButton primary onClick={() => notify('Facility changes saved to this preview.')}>Save changes</ActionButton></div><div className="cp-account-grid"><section className="cp-panel cp-profile-card"><div className="cp-section-heading"><div><h2>Facility profile</h2><p>Verified purchasing account</p></div><Pill>{user?.verificationStatus || 'Preview account'}</Pill></div><div className="cp-profile-fields"><label>Facility name<input defaultValue={pharmacyName} /></label><label>Registration email<input defaultValue={user?.email || 'procurement@kigaliclinic.rw'} /></label><label>Account manager<input value="Alice Uwimana · +250 788 123 456" readOnly /></label><label>Default delivery address<input value={proformaDetails.address} onChange={(event) => setProformaDetails({ ...proformaDetails, address: event.target.value })} /></label></div><div className="cp-account-subhead"><h3>Authorised staff</h3><button onClick={() => notify('Staff invitation is available in the full account service.')}>＋ Invite user</button></div>{[['Dr. Diane Uwase', 'Approver', 'diane@kigaliclinic.rw'], ['Jeanine Mukamana', 'Buyer', 'purchasing@kigaliclinic.rw'], ['Eric Niyonzima', 'Finance', 'finance@kigaliclinic.rw']].map(([name, role, email]) => <div className="cp-staff-row" key={email}><span>{name.slice(0, 2).toUpperCase()}</span><div><strong>{name}</strong><small>{email}</small></div><Pill>{role}</Pill></div>)}</section><aside className="cp-membership-card"><div className="cp-membership-top"><span>✦ AFRIMEDICO</span><b>PREMIUM</b></div><div className="cp-membership-main"><small>MEMBERSHIP</small><h2>{membership.status}</h2><p>Premium partner · Kigali, Rwanda</p></div><div className="cp-membership-benefits"><div><span>MONTHLY MEMBERSHIP</span><strong>{money(membership.fee)}</strong></div><div><span>MEMBER DISCOUNT</span><strong>{membership.discount}%</strong></div><div><span>NEXT RENEWAL</span><strong>{membership.renewal}</strong></div></div><button onClick={() => setPaymentInvoice({ id: 'PREMIUM-RENEWAL', amount: membership.fee, status: membership.status })}>{membership.status === 'Active' ? 'Renew membership' : 'Renew now'} →</button><small className="cp-membership-preview">Sample membership preview</small></aside></div><div className="cp-account-bottom"><section className="cp-panel"><div className="cp-section-heading"><div><h2>Membership payment history</h2><p>Monthly Premium plan · 6% member savings</p></div></div>{[['03 Oct 2026', 'MTN MoMo', 'Paid'], ['03 Sep 2026', 'Bank transfer', 'Paid'], ['03 Aug 2026', 'MTN MoMo', 'Paid']].map(([date, method, status]) => <div className="cp-history-row" key={date}><span>{date}</span><span>{method}</span><Pill>{status}</Pill><Money>{membership.fee}</Money></div>)}</section><section className="cp-panel cp-notification-settings"><div className="cp-section-heading"><div><h2>Notifications</h2><p>Stay informed about your orders</p></div></div>{[['Order updates', 'SMS and email'], ['Invoice reminders', 'Email'], ['Premium offers', 'Email']].map(([label, sub]) => <label className="cp-toggle-row" key={label}><span><strong>{label}</strong><small>{sub}</small></span><input type="checkbox" defaultChecked /></label>)}</section></div>    <div className="cp-connectivity-note"><span>{online ? '● Online' : '● Offline'}</span><p>Proforma drafts save on this device while you are offline.</p><label className="cp-dark-toggle">Dark mode<input type="checkbox" checked={dark} onChange={(event) => setDark(event.target.checked)} /></label><button onClick={() => setPage('Support')}>Contact support →</button></div></div>;

  const supportPage = () => <div className="cp-page"><div className="cp-page-head"><div><p className="cp-eyebrow">HERE WHEN YOU NEED US</p><h1>Partner support</h1><p>Get help from your named account manager.</p></div><a className="cp-button" href="tel:+250788123456">☎ Call account manager</a></div><div className="cp-support-grid"><section className="cp-panel cp-message-panel"><div className="cp-section-heading"><div><h2>Alice Uwimana</h2><p>Account manager · usually replies within 2 hours</p></div><a href="https://wa.me/250788123456" target="_blank" rel="noreferrer" className="cp-whatsapp">◉ WhatsApp</a></div><div className="cp-chat-thread">{supportMessages.map((message, index) => <div key={`${message.date}-${index}`} className={`cp-message ${message.mine ? 'mine' : ''}`}><span>{message.author}</span><p>{message.text}</p><small>{message.date}</small></div>)}</div><div className="cp-message-compose"><input value={supportDraft} onChange={(event) => setSupportDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') sendSupportMessage(); }} placeholder="Write a message to your account manager…" /><button onClick={sendSupportMessage} aria-label="Send message">Send →</button></div></section><section className="cp-panel cp-faq"><div className="cp-section-heading"><div><h2>Common questions</h2><p>Quick answers for your team</p></div></div>{[['How does Premium pricing work?', 'Your 6% discount is shown on eligible catalogue products and applied to this proforma preview.'], ['How do I place a bulk order?', 'Add products to a proforma, include a delivery address and submit it for approval.'], ['When will my order arrive?', 'Dispatch updates include your assigned driver, vehicle and estimated arrival.'], ['Can I update my facility details?', 'Send your account manager a message to update registered facility details.']].map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}<button className="cp-report-issue" onClick={() => notify('Delivery report form opened below the support thread.')}>Report a delivery issue ↓</button><textarea className="cp-issue-box" placeholder="Describe the delivery problem and include the order reference…" /></section></div></div>;

  const pageRender = { Home: home, Shop: shop, Proformas: proformas, Orders: orderPage, Invoices: invoicePage, Account: accountPage, Support: supportPage };
  const current = pageRender[page] ? page : 'Home';

  if (!user || user.role !== 'pharmacy' || !token) return renderAuth();

  return <div className={`cp-app ${dark ? 'theme-dark' : ''}`}>
    <aside className="cp-sidebar"><a className="cp-brand" href="#home"><span className="cp-logo-mark">a<span>+</span></span><span><strong>afri<span>medico</span></strong><small>PREMIUM PARTNER</small></span></a><div className="cp-facility-switch"><span>{pharmacyName.slice(0, 2).toUpperCase()}</span><div><strong>{pharmacyName}</strong><small>Verified facility</small></div><button aria-label="Facility options">⌄</button></div><nav aria-label="Partner portal navigation">{tabs.map(([name, icon]) => <button key={name} className={current === name ? 'active' : ''} onClick={() => { setPage(name); setNotice(''); }}><span>{icon}</span>{name}{name === 'Proformas' && cartCount > 0 && <i>{cartCount}</i>}</button>)}<button className={current === 'Support' ? 'active' : ''} onClick={() => setPage('Support')}><span>?</span>Support</button></nav><div className="cp-sidebar-premium"><span>✦</span><div><strong>Premium member</strong><small>6% off every order</small></div><b>✓</b></div><div className="cp-sidebar-bottom"><span className="cp-manager-mini">AU</span><div><strong>{user.facilityName || 'Pharmacy partner'}</strong><small>Procurement account</small></div><button onClick={signOut} aria-label="Sign out">↗</button></div></aside>
    <div className="cp-main"><header className="cp-topbar"><label className="cp-global-search"><span>⌕</span><input value={search} onChange={(event) => { setSearch(event.target.value); if (event.target.value) setPage('Shop'); }} placeholder="Search medicines, equipment and supplies" /><kbd>⌘ K</kbd></label><div className="cp-top-actions"><button className="cp-icon-button" onClick={() => setNotificationsOpen((open) => !open)} aria-label="Notifications">♧<i>2</i></button><button className="cp-cart-button" onClick={() => setPage('Proformas')}>▤ <span>Proforma</span><b>{cartCount}</b></button><div className="cp-profile-wrap"><button className="cp-profile-button" onClick={() => setProfileMenu((open) => !open)}><span className="cp-user-avatar">{pharmacyName.slice(0, 2).toUpperCase()}</span><span><strong>{pharmacyName}</strong><small><i /> Premium member</small></span><b>⌄</b></button>{profileMenu && <div className="cp-profile-menu"><button onClick={() => { setProfileMenu(false); setPage('Account'); }}>Account settings</button><button onClick={signOut}>Sign out</button></div>}</div></div></header>
      {notificationsOpen && <div className="cp-notification-popover"><strong>Notifications</strong><button onClick={() => { setNotificationsOpen(false); setPage('Orders'); }}>Order ORD-2026-0918 is out for delivery today.</button><button onClick={() => { setNotificationsOpen(false); setPage('Invoices'); }}>INV-2026-0730 payment is due 15 Oct.</button></div>}
      <main className="cp-content"><div className="cp-workspace-strip"><span>{online ? '● Connected' : '● Offline · Drafts saved locally'}</span><i />Premium partner workspace <span className="cp-preview-note">Sample account data</span></div>{error && <div className="cp-error">{error}<button onClick={() => setError('')}>×</button></div>}{notice && <div className="cp-notice"><span>✓</span>{notice}<button onClick={() => setNotice('')}>×</button></div>}{pageRender[current]() }<footer className="cp-footer"><span>© 2026 Afrimedico Rwanda</span><span>Supporting trusted healthcare supply · Kigali, Rwanda</span><button onClick={() => setPage('Support')}>Partner support</button></footer></main>
    </div>
    <nav className="cp-mobile-tabs" aria-label="Mobile navigation">{tabs.map(([name, icon]) => <button key={name} className={current === name ? 'active' : ''} onClick={() => { setPage(name); setNotice(''); }}><span>{icon}</span><small>{name}</small>{name === 'Proformas' && cartCount > 0 && <i>{cartCount}</i>}</button>)}</nav>
    {detailProduct && <Sheet title={detailProduct.name} onClose={() => setDetailProduct(null)}><div className="cp-product-detail"><span className="cp-product-mark">{detailProduct.mark}</span><Pill>{detailProduct.stock}</Pill><p>{detailProduct.description}</p><div><span>Category</span><strong>{detailProduct.category}</strong></div><div><span>Brand</span><strong>{detailProduct.brand}</strong></div><div><span>Pack size</span><strong>{detailProduct.pack}</strong></div><div><span>Batch</span><strong>{detailProduct.batch}</strong></div><div><span>Expiry</span><strong>{detailProduct.expiry}</strong></div><div className="cp-detail-pricing"><span><del>{money(detailProduct.price)}</del><strong>{money(discounted(detailProduct.price))}</strong></span><small>6% Premium member price</small></div><button className="cp-button primary cp-full-button" onClick={() => { addToCart(detailProduct); setDetailProduct(null); }}>Add to proforma</button><button className="cp-cert-link" onClick={() => { const blob = new Blob([`Afrimedico product certificate preview\nProduct: ${detailProduct.name}\nBatch: ${detailProduct.batch}\nExpiry: ${detailProduct.expiry}\nCertificate verification is available on confirmed orders.`], { type: 'text/plain' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `${detailProduct.id}-certificate-preview.txt`; link.click(); URL.revokeObjectURL(url); }}>↓ Download product certificate preview</button></div></Sheet>}
    {paymentInvoice && <Sheet title={paymentInvoice.id === 'PREMIUM-RENEWAL' ? 'Renew Premium membership' : `Pay ${paymentInvoice.id}`} onClose={() => setPaymentInvoice(null)}><div className="cp-pay-sheet"><div className="cp-pay-amount"><small>AMOUNT DUE</small><strong>{money(paymentInvoice.amount)}</strong></div><label>Choose payment method<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}><option>MTN MoMo</option><option>Airtel Money</option><option>Bank transfer</option></select></label><p>Payments are not connected in this preview. Continuing will not charge your account.</p><button className="cp-button primary cp-full-button" onClick={startPayment}>Continue with {paymentMethod}</button></div></Sheet>}
    {signatureOpen && <Sheet title="Confirm delivery" onClose={() => setSignatureOpen(false)}><div className="cp-signature-sheet"><p>Enter the name of the authorised recipient accepting this delivery.</p><label>Recipient full name<input value={recipientName} onChange={(event) => setRecipientName(event.target.value)} placeholder="e.g. Diane Uwase" /></label><label>Recipient signature (optional)<SignaturePad onChange={setSignatureDrawn} /></label><button className="cp-button primary cp-full-button" onClick={signDelivery}>Confirm delivery received</button><small>Confirmation is saved to this preview only.</small></div></Sheet>}
    {toast && <div className="cp-toast"><span>✓</span>{toast}<button onClick={() => setToast('')}>×</button></div>}
  </div>;
}

function ProductCard({ product, isPremium, onAdd, onDetails, premium = false }) {
  const locked = product.premiumOnly && !isPremium;
  return <article className={`cp-product-card ${premium ? 'premium' : ''} ${locked ? 'locked' : ''}`}><button className="cp-product-art" onClick={onDetails} aria-label={`View details for ${product.name}`}><span>{product.mark}</span>{premium && <b>✦ PREMIUM</b>}</button><div className="cp-product-info"><div className="cp-product-category">{product.category}<span className={`cp-stock-dot ${product.stock === 'Low stock' ? 'low' : ''}`} />{product.stock}</div><button className="cp-product-name" onClick={onDetails}>{product.name}</button><small className="cp-product-pack">{product.pack}</small><div className="cp-product-prices">{isPremium && <del>{money(product.price)}</del>}<strong>{money(memberPrice(product.price, isPremium))}</strong>{isPremium && <span>Save 6%</span>}</div><button className="cp-add-button" disabled={product.stock === 'Out of stock'} onClick={onAdd}>{locked ? 'Renew to unlock' : product.stock === 'Out of stock' ? 'Out of stock' : '＋ Add to proforma'}</button></div></article>;
}

function Empty({ title, description, action, onAction }) {
  return <div className="cp-empty"><span>▤</span><strong>{title}</strong><p>{description}</p>{action && <button onClick={onAction}>{action} →</button>}</div>;
}

export default ClientPortal;
