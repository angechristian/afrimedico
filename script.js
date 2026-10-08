let PRODUCTS = [
  { id: "amoxicillin", name: "Amoxicillin 500 mg capsules", category: "Medicines", pack: "Box of 100", price: 6500, stock: "In stock", mark: "Rx" },
  { id: "paracetamol", name: "Paracetamol 500 mg tablets", category: "Medicines", pack: "Box of 1,000", price: 9800, stock: "In stock", mark: "500" },
  { id: "ors", name: "Oral rehydration salts", category: "Medicines", pack: "Carton of 100 sachets", price: 12000, stock: "In stock", mark: "ORS" },
  { id: "oximeter", name: "Pulse oximeter, fingertip", category: "Equipment", pack: "Each", price: 18500, stock: "Low stock", mark: "O₂" },
  { id: "malaria-kit", name: "Malaria rapid test kit", category: "Laboratory", pack: "Box of 50 tests", price: 28000, stock: "In stock", mark: "RDT" },
  { id: "gloves", name: "Nitrile examination gloves", category: "Consumables", pack: "Box of 100", price: 7500, stock: "In stock", mark: "N" },
  { id: "masks", name: "3-ply surgical masks", category: "Consumables", pack: "Box of 50", price: 3200, stock: "In stock", mark: "3P" },
  { id: "syringes", name: "Syringes 5 ml with needle", category: "Consumables", pack: "Box of 100", price: 5400, stock: "Low stock", mark: "5ml" },
  { id: "oxygen-refill", name: "Oxygen cylinder refill, 40 L", category: "Oxygen", pack: "Per cylinder", price: 35000, stock: "In stock", mark: "O₂" },
  { id: "flowmeter", name: "Oxygen flowmeter with humidifier", category: "Oxygen", pack: "Each", price: 45000, stock: "In stock", mark: "L/min" },
  { id: "patient-monitor", name: "5-parameter patient monitor", category: "Equipment", pack: "Each · Premium access", price: 1850000, stock: "By request", mark: "ECG", premium: true },
  { id: "ultrasound", name: "Portable ultrasound scanner", category: "Equipment", pack: "Each · Premium access", price: 6400000, stock: "By request", mark: "US", premium: true },
  { id: "microscope", name: "Binocular laboratory microscope", category: "Laboratory", pack: "Each · Premium access", price: 520000, stock: "By request", mark: "×40", premium: true },
  { id: "reagent-pack", name: "Haematology reagent pack", category: "Laboratory", pack: "Pack · Premium access", price: 340000, stock: "By request", mark: "CBC", premium: true }
];

const CATEGORIES = ["All", "Medicines", "Equipment", "Laboratory", "Consumables", "Oxygen"];
const ORDER_STEPS = ["Submitted", "Approved", "Paid", "Dispatched", "Delivered"];
const STORAGE_KEY = "afrimedico-demo-v1";
const defaults = {
  facility: "Kigali Community Clinic",
  cart: {},
  orders: [],
  membership: null,
  nextReference: 148,
  workspace: "client",
  products: PRODUCTS,
  pharmacyVerified: false,
  pharmacyDocumentName: "",
  pharmacyVerifiedAt: ""
};
let state = loadState();
PRODUCTS = state.products;
let route = state.workspace === "admin" ? "admin-home" : "home";
let selectedCategory = "All";
let searchTerm = "";
let activeSlide = 0;
let toastTimer;

function loadState() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!stored || typeof stored !== "object") return { ...defaults, cart: {}, orders: [] };
    return {
      ...defaults,
      ...stored,
      cart: stored.cart && typeof stored.cart === "object" && !Array.isArray(stored.cart) ? stored.cart : {},
      orders: Array.isArray(stored.orders) ? stored.orders : [],
      membership: stored.membership && typeof stored.membership === "object" ? stored.membership : null,
      workspace: stored.workspace === "admin" ? "admin" : "client",
      products: Array.isArray(stored.products) ? stored.products : PRODUCTS,
      pharmacyVerified: Boolean(stored.pharmacyVerified),
      pharmacyDocumentName: typeof stored.pharmacyDocumentName === "string" ? stored.pharmacyDocumentName : "",
      pharmacyVerifiedAt: typeof stored.pharmacyVerifiedAt === "string" ? stored.pharmacyVerifiedAt : ""
    };
  } catch (error) {
    console.warn("Afrimedico demo data could not be read from browser storage.", error);
    return { ...defaults, cart: {}, orders: [] };
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error("Afrimedico demo data could not be saved to browser storage.", error);
    showToast("Your browser could not save this change. Check storage permissions and try again.", "error");
  }
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

function money(value) {
  return `${Number(value || 0).toLocaleString("en-RW")} RWF`;
}

function cartEntries() {
  return Object.entries(state.cart)
    .map(([id, quantity]) => ({ product: PRODUCTS.find((item) => item.id === id), quantity: Number(quantity) }))
    .filter((entry) => entry.product && Number.isFinite(entry.quantity) && entry.quantity > 0);
}

function cartCount() {
  return cartEntries().reduce((total, entry) => total + entry.quantity, 0);
}

function linePrice(product) {
  return state.membership ? Math.round(product.price * 0.94) : product.price;
}

function cartSubtotal() {
  return cartEntries().reduce((total, entry) => total + linePrice(entry.product) * entry.quantity, 0);
}

function updateChrome() {
  const admin = state.workspace === "admin";
  document.body.classList.toggle("admin-mode", admin);
  document.querySelector("#workspace-label").textContent = admin ? "OPERATIONS" : "WORKSPACE";
  document.querySelector("#secondary-workspace-label").textContent = admin ? "WORKSPACE" : "YOUR ACCOUNT";
  document.querySelector("#primary-navigation").innerHTML = admin
    ? `<button class="nav-item" type="button" data-route="admin-home"><span class="nav-icon" aria-hidden="true">▦</span><span>Overview</span></button>
       <button class="nav-item" type="button" data-route="admin-orders"><span class="nav-icon" aria-hidden="true">⇢</span><span>Orders</span><span class="nav-count">${state.orders.filter((order) => order.statusIndex === 0).length}</span></button>
       <button class="nav-item" type="button" data-route="admin-products"><span class="nav-icon" aria-hidden="true">▤</span><span>Catalogue</span><span class="nav-count">${PRODUCTS.filter((product) => product.active !== false).length}</span></button>`
    : `<button class="nav-item" type="button" data-route="home"><span class="nav-icon" aria-hidden="true">⌂</span><span>Overview</span></button>
       <button class="nav-item" type="button" data-route="catalog"><span class="nav-icon" aria-hidden="true">▦</span><span>Shop catalogue</span><span class="nav-count">${PRODUCTS.filter((product) => product.active !== false).length}</span></button>
       <button class="nav-item" type="button" data-route="proforma"><span class="nav-icon" aria-hidden="true">▤</span><span>Proforma</span><span class="nav-count">${cartCount()}</span></button>
       <button class="nav-item" type="button" data-route="orders"><span class="nav-icon" aria-hidden="true">⇢</span><span>Orders & delivery</span></button>`;
  document.querySelector("#secondary-navigation").innerHTML = admin
    ? `<button class="nav-item" type="button" data-action="toggle-workspace"><span class="nav-icon" aria-hidden="true">↗</span><span>Client workspace</span></button>`
    : `<button class="nav-item" type="button" data-route="premium"><span class="nav-icon" aria-hidden="true">✳</span><span>Premium access</span><span class="premium-dot" aria-hidden="true"></span></button>
       <button class="nav-item" type="button" data-route="about"><span class="nav-icon" aria-hidden="true">i</span><span>How it works</span></button>`;
  document.querySelectorAll("[data-route]").forEach((button) => {
    button.classList.toggle("active", button.dataset.route === route);
  });

  const sidebarCartCount = document.querySelector("#sidebar-cart-count");
  const topbarCartCount = document.querySelector("#topbar-cart-count");
  const sidebarFacility = document.querySelector("#sidebar-facility");
  const profileCopySmall = document.querySelector(".profile-copy small");
  const profileButton = document.querySelector(".profile-button");
  const workspaceSwitch = document.querySelector("#workspace-switch");
  const topbarProforma = document.querySelector(".topbar-proforma");
  const globalSearch = document.querySelector(".global-search");

  if (sidebarCartCount) sidebarCartCount.textContent = String(cartCount());
  if (topbarCartCount) topbarCartCount.textContent = String(cartCount());
  if (sidebarFacility) sidebarFacility.textContent = state.facility;
  if (profileCopySmall) profileCopySmall.textContent = admin ? "Afrimedico operations" : state.membership ? "Premium member" : "Procurement team";
  if (profileButton) profileButton.dataset.route = admin ? "admin-home" : "account";
  if (workspaceSwitch) {
    workspaceSwitch.textContent = admin ? "Client view" : "Admin demo";
    workspaceSwitch.setAttribute("aria-label", admin ? "Switch to client workspace" : "Switch to demo admin workspace");
  }
  if (topbarProforma) topbarProforma.hidden = admin;
  if (globalSearch) globalSearch.hidden = admin;
}

function routeTo(nextRoute) {
  route = nextRoute;
  render();
  document.querySelector("#app-content").focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showToast(message, kind = "success") {
  const region = document.querySelector("#toast-region");
  const toast = document.createElement("div");
  toast.className = `toast${kind === "error" ? " error" : ""}`;
  toast.setAttribute("role", kind === "error" ? "alert" : "status");
  toast.textContent = message;
  region.append(toast);
  window.setTimeout(() => toast.remove(), 3800);
}

function emptyState(icon, title, copy, actionLabel, action) {
  return `<section class="empty-state">
    <div><div class="empty-cart-icon" aria-hidden="true">${icon}</div>
      <h2>${title}</h2><p>${copy}</p>
      <button class="button button-primary" type="button" data-action="${action}">${actionLabel}</button>
    </div>
  </section>`;
}

function renderHome() {
  const totalSpend = state.orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const pending = state.orders.filter((order) => order.statusIndex < 4).length;
  const slides = [
    { kicker: "SUPPLY YOU CAN COUNT ON", badge: "Made for Rwanda", title: "Healthcare supplies, delivered with confidence.", copy: "Find trusted essentials for your facility, request a proforma, and keep every order moving from one place.", primary: "Explore catalogue", secondary: "How it works" },
    { kicker: "OXYGEN, WHEN YOU NEED IT", badge: "Reliable supply", title: "Keep essential oxygen flowing.", copy: "Order cylinder refills and oxygen equipment with clear pricing and delivery updates for your care team.", primary: "Shop oxygen", secondary: "Track orders" },
    { kicker: "BETTER ACCESS FOR YOUR TEAM", badge: "Afrimedico Premium", title: "Get more from every procurement.", copy: "Unlock contract pricing, priority delivery and specialist equipment with a flexible Premium membership.", primary: "Explore Premium", secondary: "Browse equipment" }
  ];
  const slide = slides[activeSlide];
  return `<div class="eyebrow"><span class="eyebrow-mark"></span> GOOD DAY, ${escapeHTML(state.facility.toUpperCase())}</div>
    <h1 class="page-heading">Your healthcare supply hub</h1>
    <p class="page-subtitle">Source essential medical supplies, build proformas and follow each delivery from Kigali to your facility.</p>
    <section class="hero" aria-label="Afrimedico highlights">
      <div class="hero-copy">
        <div class="hero-kicker">${slide.kicker}<span>${slide.badge}</span></div>
        <h2>${slide.title}</h2><p>${slide.copy}</p>
        <div class="hero-buttons">
          <button class="button button-primary" type="button" data-action="slide-primary">${slide.primary}<span aria-hidden="true">→</span></button>
          <button class="button button-secondary" type="button" data-action="slide-secondary">${slide.secondary}</button>
        </div>
      </div>
      <div class="hero-art" aria-hidden="true"><div class="art-orbit"><span class="art-spark one">+</span><span class="art-spark two">RW</span><div class="medical-cross"><span></span></div></div></div>
      <div class="hero-pagination">${slides.map((_, index) => `<button class="${index === activeSlide ? "active" : ""}" type="button" aria-label="Show highlight ${index + 1}" data-action="set-slide" data-index="${index}"></button>`).join("")}<button class="hero-next" type="button" aria-label="Next highlight" data-action="next-slide">→</button></div>
    </section>
    <section class="metric-grid" aria-label="Procurement overview">
      <article class="metric-card"><span class="metric-icon" aria-hidden="true">▤</span><div><div class="metric-label">Items in proforma</div><div class="metric-value">${cartCount()}</div></div><div class="metric-note"><strong>${cartCount() ? "Ready to review" : "Start a request"}</strong>Draft estimate</div></article>
      <article class="metric-card"><span class="metric-icon" aria-hidden="true">⇢</span><div><div class="metric-label">Active orders</div><div class="metric-value">${pending}</div></div><div class="metric-note"><strong>Live updates</strong>Order progress</div></article>
      <article class="metric-card"><span class="metric-icon" aria-hidden="true">R</span><div><div class="metric-label">Total order value</div><div class="metric-value">${money(totalSpend)}</div></div><div class="metric-note"><strong>Rwandan francs</strong>Demo account</div></article>
    </section>
    <div class="section-head"><div><h2>Quick access</h2><p>Browse what your care teams need.</p></div><button class="text-link" type="button" data-route="catalog">View full catalogue <span aria-hidden="true">→</span></button></div>
    <div class="dashboard-grid">
      <section class="panel"><div class="panel-header"><div><h3>Shop by category</h3><p>Carefully selected medical essentials</p></div><button class="text-link" type="button" data-route="catalog">All products →</button></div>
        <div class="panel-body"><div class="category-grid">${[
          ["Medicines", "Rx", "3 essentials"], ["Equipment", "ECG", "4 devices"], ["Laboratory", "LAB", "3 supplies"], ["Consumables", "N", "3 essentials"],
          ["Oxygen", "O₂", "2 supply services"]
        ].map(([name, icon, count]) => `<button class="category-tile" type="button" data-action="open-category" data-category="${name}"><span class="category-icon">${icon}</span><strong>${name}</strong><small>${count}</small></button>`).join("")}</div></div>
      </section>
      <section class="panel"><div class="panel-header"><div><h3>Recent orders</h3><p>Your latest procurement requests</p></div><button class="text-link" type="button" data-route="orders">See all →</button></div>
        <div class="panel-body">${state.orders.length ? state.orders.slice(0, 3).map((order) => `<div class="recent-row"><div><strong>${escapeHTML(order.reference)}</strong><small>${new Date(order.createdAt).toLocaleDateString("en-RW")} · ${money(order.total)}</small></div><span class="status-pill ${ORDER_STEPS[order.statusIndex].toLowerCase()}">${ORDER_STEPS[order.statusIndex]}</span></div>`).join("") : `<div class="recent-empty">Your submitted requests will appear here with status updates. Start by adding products to a proforma.</div><button class="text-link" type="button" data-route="catalog">Start a proforma →</button>`}</div>
      </section>
    </div>`;
}

function filteredProducts() {
  const normalizedSearch = searchTerm.trim().toLowerCase();
  return PRODUCTS.filter((product) => {
    if (product.active === false) return false;
    const categoryMatches = selectedCategory === "All" || product.category === selectedCategory;
    const searchMatches = !normalizedSearch || `${product.name} ${product.category} ${product.pack}`.toLowerCase().includes(normalizedSearch);
    return categoryMatches && searchMatches;
  });
}

function productCard(product) {
  const locked = product.premium && !state.membership;
  const stock = product.stock === "Low stock" ? `<span class="stock-dot low"></span>Low stock` : `<span class="stock-dot"></span>${product.stock}`;
  const price = linePrice(product);
  return `<article class="product-card">
    <div class="product-art"><span class="product-badge ${product.premium ? "premium" : ""}">${product.premium ? "PREMIUM" : stock}</span><span class="product-shape" aria-hidden="true">${product.mark}</span></div>
    <div class="product-info">
      <div class="product-category">${product.category}</div><h3>${product.name}</h3><div class="product-pack">${product.pack}</div>
      <div class="product-bottom"><div class="product-price"><small>${state.membership ? "MEMBER PRICE" : "SAMPLE PRICE"}</small>${money(price)}</div>
        ${locked ? `<button class="add-button locked" type="button" data-route="premium">Unlock Premium</button>` : `<button class="add-button" type="button" data-action="add-product" data-id="${product.id}"><span aria-hidden="true">+</span> Add to proforma</button>`}
      </div>
    </div>
  </article>`;
}

function renderCatalog() {
  const products = filteredProducts();
  return `<div class="page-toolbar"><div><div class="eyebrow"><span class="eyebrow-mark"></span> AFRIMEDICO CATALOGUE</div><h1 class="page-heading">Supplies for better care</h1><p class="page-subtitle">Browse sample prices in RWF. Add what you need to request a proforma.</p></div><button class="button button-secondary" type="button" data-route="proforma"><span aria-hidden="true">▤</span> View proforma (${cartCount()})</button></div>
    <div class="catalog-tools">${CATEGORIES.map((category) => `<button class="category-chip ${category === selectedCategory ? "active" : ""}" type="button" data-action="filter-category" data-category="${category}">${category}</button>`).join("")}<span class="results-count">${products.length} sample products</span></div>
    <div class="product-grid">${products.length ? products.map(productCard).join("") : `<div class="product-empty">No products match “${escapeHTML(searchTerm)}”. Try another search or category.</div>`}</div>
    <aside class="premium-banner"><div><strong>Need equipment or bulk contract pricing?</strong><p>Premium includes 6% off sample catalogue prices, priority delivery and specialist equipment access.</p></div><button class="button button-secondary" type="button" data-route="premium">Explore Premium <span aria-hidden="true">→</span></button></aside>`;
}

function renderCartItems(entries) {
  return entries.map(({ product, quantity }) => `<article class="cart-item">
    <div class="cart-product"><span class="cart-thumb" aria-hidden="true">${product.mark}</span><span><strong>${product.name}</strong><small>${product.pack}</small></span></div>
    <div class="quantity-control" aria-label="Quantity for ${product.name}"><button type="button" aria-label="Decrease quantity" data-action="change-quantity" data-id="${product.id}" data-delta="-1">−</button><span>${quantity}</span><button type="button" aria-label="Increase quantity" data-action="change-quantity" data-id="${product.id}" data-delta="1">+</button></div>
    <div class="cart-line-total">${money(linePrice(product) * quantity)}<button type="button" data-action="remove-product" data-id="${product.id}">Remove</button></div>
  </article>`).join("");
}

function renderProforma() {
  const entries = cartEntries();
  const subtotal = cartSubtotal();
  const discount = state.membership ? entries.reduce((total, entry) => total + Math.max(0, entry.product.price - linePrice(entry.product)) * entry.quantity, 0) : 0;
  const items = entries.length ? `<div class="table-header"><strong>Requested products</strong><span>${cartCount()} item${cartCount() === 1 ? "" : "s"}</span></div>${renderCartItems(entries)}` : `<div class="empty-cart"><div><div class="empty-cart-icon" aria-hidden="true">▤</div><h3>Your proforma is empty</h3><p>Add catalogue products to prepare an itemised request. The Afrimedico team confirms availability and final prices before approval.</p><button class="button button-primary" type="button" data-route="catalog">Browse catalogue</button></div></div>`;
  return `<div class="eyebrow"><span class="eyebrow-mark"></span> REQUEST A QUOTE</div><h1 class="page-heading">Build your proforma</h1><p class="page-subtitle">Review quantities and tell us where to prepare this request. Submission is a demo and does not place a real order.</p>
    <form id="proforma-form" class="proforma-layout">
      <section class="table-card">${items}</section>
      <aside class="summary-card"><h3>Request details</h3>
        <div class="form-group"><label class="field-label" for="facility-name">Facility name</label><input class="form-field" id="facility-name" name="facility" maxlength="80" required value="${escapeHTML(state.facility)}" placeholder="Your registered facility" ${entries.length ? "" : "disabled"}></div>
        <div class="form-group"><label class="field-label" for="request-notes">Notes for our sales desk <span style="font-weight:400;color:#98a39b">(optional)</span></label><textarea class="form-field" id="request-notes" name="notes" maxlength="500" placeholder="Preferred delivery date, substitutions, or other details" ${entries.length ? "" : "disabled"}></textarea></div>
        <div class="summary-divider"></div><div class="summary-row"><span>Products (${cartCount()} units)</span><strong>${money(subtotal + discount)}</strong></div>
        <div class="summary-row"><span>${state.membership ? "Member discount" : "Pricing"} </span><strong>${state.membership ? `−${money(discount)}` : "Indicative only"}</strong></div>
        <div class="summary-total"><span>Estimated total</span><strong>${money(subtotal)}</strong></div>
        ${state.pharmacyVerified && state.pharmacyDocumentName ? `<p class="fine-print"><strong>Verified:</strong> ${escapeHTML(state.pharmacyDocumentName)}</p>` : `<p class="fine-print"><strong>Verification required:</strong> Upload your pharmacy licence before placing medicine orders.</p>`}
        <p class="fine-print">Sample prices only. Final pricing, stock and delivery costs are confirmed by Afrimedico before an invoice is issued.</p>
        <button class="button button-primary button-block" type="submit" ${entries.length ? "" : "disabled"}>Submit for approval <span aria-hidden="true">→</span></button>
        <p class="fine-print">No payment is taken at this stage.</p>
      </aside>
    </form>`;
}

function renderProgress(statusIndex) {
  const progress = Math.max(0, Math.min(100, statusIndex / (ORDER_STEPS.length - 1) * 82));
  return `<div class="order-progress"><span class="progress-fill" style="width:${progress}%"></span>${ORDER_STEPS.map((step, index) => `<div class="progress-step ${index < statusIndex ? "complete" : ""} ${index === statusIndex ? "current" : ""}"><span class="progress-circle">${index < statusIndex ? "✓" : ""}</span><span>${step}</span></div>`).join("")}</div>`;
}

function renderOrder(order) {
  const index = Math.max(0, Math.min(ORDER_STEPS.length - 1, Number(order.statusIndex) || 0));
  const date = new Date(order.createdAt);
  const button = index < ORDER_STEPS.length - 1
    ? `<button class="button button-secondary button-small" type="button" data-action="advance-order" data-id="${escapeHTML(order.id)}">Demo: ${index === 0 ? "Approve" : index === 1 ? "Record payment" : index === 2 ? "Dispatch" : "Confirm delivery"}</button>`
    : `<span class="status-pill delivered">Delivery complete</span>`;
  return `<article class="order-card"><header class="order-card-header"><div><div class="order-ref">${escapeHTML(order.reference)}</div><div class="order-meta">${date.toLocaleDateString("en-RW")} · ${escapeHTML(order.facility)} · ${Array.isArray(order.items) ? order.items.length : 0} products</div></div><span class="status-pill ${ORDER_STEPS[index].toLowerCase()}">${ORDER_STEPS[index]}</span></header>
    <div class="order-card-content">${renderProgress(index)}<div class="order-card-footer"><div><div class="demo-label">INDICATIVE PROFORMA VALUE</div><strong>${money(order.total)}</strong>${order.notes ? `<div class="order-meta">Note: ${escapeHTML(order.notes)}</div>` : ""}</div><div class="demo-controls">${button}</div></div></div></article>`;
}

function renderOrders() {
  return `<div class="eyebrow"><span class="eyebrow-mark"></span> PROCUREMENT TRACKING</div><h1 class="page-heading">Orders & delivery</h1><p class="page-subtitle">See each request move from sales review to a signed delivery. Use the clearly labelled demo controls to preview the workflow.</p>
    <div class="section-head"><div><h2>${state.orders.length ? "Your requests" : "Order workflow"}</h2><p>${state.orders.length ? `${state.orders.length} saved request${state.orders.length === 1 ? "" : "s"} · updates saved on this device` : "Five clear steps, from quote request to delivery confirmation."}</p></div>${state.orders.length ? `<button class="button button-secondary" type="button" data-route="catalog">+ New request</button>` : ""}</div>
    ${state.orders.length ? `<div class="orders-list">${state.orders.slice().reverse().map(renderOrder).join("")}</div>` : `${emptyState("⇢", "Your orders will show up here", "Build a proforma from the catalogue to start. This prototype saves demo requests in this browser so you can preview the end-to-end order journey.", "Browse the catalogue", "open-catalog")}
      <section class="steps-grid" aria-label="Order process">${[
        ["1", "Build a proforma", "Choose products and quantities. Premium members see their member pricing."],
        ["2", "Sales approval", "Afrimedico confirms stock, final pricing and your requested quantities."],
        ["3", "Invoice & payment", "Receive an invoice and pay using MoMo or bank transfer."],
        ["4", "Dispatch", "The warehouse prepares your order and shares a delivery estimate."],
        ["5", "Delivery", "Your facility confirms receipt and keeps a delivery note on file."]
      ].map(([number, title, copy]) => `<article class="step-card"><span class="step-number">${number}</span><h3>${title}</h3><p>${copy}</p></article>`).join("")}</section>`}`;
}

function renderPremium() {
  const benefits = [
    ["%", "6% off every product", "Save on your everyday catalogue orders."],
    ["★", "Priority delivery", "Move essential facility supplies up the queue."],
    ["◎", "Named account manager", "Get procurement help from a consistent contact."],
    ["+", "Specialist equipment", "Access monitors, ultrasound and lab supplies."]
  ];
  return `<div class="eyebrow"><span class="eyebrow-mark"></span> AFRIMEDICO MEMBERSHIP</div><h1 class="page-heading">More value for your care team</h1><p class="page-subtitle">Contract pricing, dedicated support and equipment access for facilities ordering regularly.</p>
    <section class="membership-hero"><div><div class="eyebrow">✳&nbsp; PREMIUM WINDOW</div><h2>Procurement that gives back.</h2><p>One membership for better pricing, priority service and a dependable supply partner. Choose monthly or annual access.</p>${state.membership ? `<span class="member-active">✓ Premium active · ${escapeHTML(state.membership.plan)} plan</span>` : ""}</div><div class="membership-badge">AFRIMEDICO<br>PREMIUM</div></section>
    <div class="section-head"><div><h2>Member benefits</h2><p>Support built around the realities of healthcare procurement.</p></div></div><div class="benefit-grid">${benefits.map(([icon, title, copy]) => `<article class="benefit-card"><span class="benefit-icon">${icon}</span><strong>${title}</strong><p>${copy}</p></article>`).join("")}</div>
    <div class="section-head"><div><h2>Choose your plan</h2><p>All prices below are examples for this interactive prototype.</p></div></div>
    <div class="plan-grid">
      <article class="plan-card"><div class="plan-label">MONTHLY</div><div class="plan-price">50,000 <small>RWF / month</small></div><p class="plan-note">Flexible access, billed monthly. Cancel or change the plan with your account manager.</p><button class="button ${state.membership?.plan === "Monthly" ? "button-quiet" : "button-primary"} button-block" type="button" data-action="choose-plan" data-plan="Monthly" ${state.membership?.plan === "Monthly" ? "disabled" : ""}>${state.membership?.plan === "Monthly" ? "Current plan" : "Choose monthly"}</button></article>
      <article class="plan-card recommended"><span class="plan-ribbon">SAVE 20%</span><div class="plan-label">ANNUAL</div><div class="plan-price">480,000 <small>RWF / year</small></div><p class="plan-note">One annual payment for uninterrupted access and 2 months included.</p><button class="button ${state.membership?.plan === "Annual" ? "button-quiet" : "button-primary"} button-block" type="button" data-action="choose-plan" data-plan="Annual" ${state.membership?.plan === "Annual" ? "disabled" : ""}>${state.membership?.plan === "Annual" ? "Current plan" : "Choose annual"}</button></article>
    </div>`;
}

function renderAbout() {
  const features = [
    ["RETENTION", "Smart reorder reminders", "Suggestions for gloves, reagents and oxygen before your facility runs low."],
    ["SAFETY", "Batch and expiry details", "Keep delivery traceability and supporting documents close to each invoice."],
    ["OXYGEN", "Cylinder refill tracking", "Follow refills and exchanges for dependable oxygen supply."],
    ["ACCESS", "Mobile-ready ordering", "Build and review procurement requests on desktop or mobile."]
  ];
  return `<div class="eyebrow"><span class="eyebrow-mark"></span> HOW AFRIMEDICO WORKS</div><h1 class="page-heading">A dependable partner in every order</h1><p class="page-subtitle">A B2B healthcare marketplace concept designed for hospitals, clinics and pharmacies across Rwanda.</p>
    <section class="steps-grid">${[
      ["1", "Build your proforma", "Browse sample catalogue items and choose the quantities your facility needs."],
      ["2", "Get stock confirmed", "Afrimedico sales reviews your request and confirms availability and final pricing."],
      ["3", "Approve your quote", "Review the confirmed proforma before it becomes an invoice."],
      ["4", "Pay locally", "Settle the final invoice through MoMo or a bank transfer."],
      ["5", "Track dispatch", "Follow fulfilment and receive an estimated arrival update."],
      ["6", "Confirm delivery", "Record receipt at your facility and keep a delivery note."]
    ].map(([number, title, copy]) => `<article class="step-card"><span class="step-number">${number}</span><h3>${title}</h3><p>${copy}</p></article>`).join("")}</section>
    <div class="section-head"><div><h2>More than a catalogue</h2><p>Tools that support a reliable healthcare supply service.</p></div></div>
    <div class="health-grid">${features.map(([tag, title, copy]) => `<article class="health-card"><small>${tag}</small><h3>${title}</h3><p>${copy}</p></article>`).join("")}</div>
    <aside class="premium-banner"><div><strong>Talk to our Kigali team</strong><p>Call +250 788 327 128 · afrimedicorwanda@gmail.com · Kigali, Rwanda</p></div><a class="button button-secondary" href="mailto:afrimedicorwanda@gmail.com">Contact Afrimedico →</a></aside>`;
}

function renderAccount() {
  const pharmacyVerified = Boolean(state.pharmacyVerified && state.pharmacyDocumentName);
  const verificationStatus = pharmacyVerified
    ? `<div class="demo-notice"><strong>Verified pharmacy profile:</strong> ${escapeHTML(state.pharmacyDocumentName)} uploaded${state.pharmacyVerifiedAt ? ` on ${new Date(state.pharmacyVerifiedAt).toLocaleDateString("en-RW")}` : ""}.</div>`
    : `<div class="demo-notice"><strong>Verification required:</strong> Upload your pharmacy licence or business registration before placing medicine orders in Rwanda.</div>`;
  return `<div class="eyebrow"><span class="eyebrow-mark"></span> FACILITY PROFILE</div><h1 class="page-heading">Your procurement details</h1><p class="page-subtitle">Keep your facility name up to date and complete pharmacy verification before requesting medicine orders.</p>
    <form id="account-form" class="summary-card" style="max-width:520px;margin-top:22px">
      <div class="form-group"><label class="field-label" for="account-facility">Facility name</label><input class="form-field" id="account-facility" name="facility" value="${escapeHTML(state.facility)}" maxlength="80" required></div>
      <div class="form-group"><label class="field-label" for="pharmacy-doc">Pharmacy verification document</label><input class="form-field" id="pharmacy-doc" name="pharmacyDoc" type="file" accept=".pdf,.png,.jpg,.jpeg" ${pharmacyVerified ? "" : "required"}></div>
      <div class="form-group"><label class="field-label" for="pharmacy-owner-confirm">Authorised pharmacy owner</label><label class="payment-option" for="pharmacy-owner-confirm" style="margin-top:8px"><input id="pharmacy-owner-confirm" type="checkbox" name="pharmacyOwner" ${pharmacyVerified ? "checked" : ""} required><span><strong>I confirm I am the authorised owner or manager of this pharmacy</strong><small>Required for medicine requests</small></span></label></div>
      ${verificationStatus}
      <div class="form-group"><span class="field-label">Membership</span><p class="page-subtitle">${state.membership ? `Premium · ${escapeHTML(state.membership.plan)} plan` : "Standard access"}</p></div>
      <button class="button button-primary" type="submit">Save facility details</button>
      <div class="demo-notice">This demo stores your preferences and sample orders in local browser storage only. No registration, payment or order is sent to a live service.</div>
    </form>`;
}

function adminNotice() {
  return `<div class="admin-demo-notice"><span aria-hidden="true">i</span><span><strong>Demo admin workspace</strong> This browser-only prototype has no sign-in or backend. Changes are saved locally on this device and are not live.</span></div>`;
}

function renderAdminOverview() {
  const awaiting = state.orders.filter((order) => order.statusIndex === 0).length;
  const activeOrders = state.orders.filter((order) => order.statusIndex < ORDER_STEPS.length - 1).length;
  const lowStock = PRODUCTS.filter((product) => product.active !== false && product.stock === "Low stock").length;
  const totalValue = state.orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const facilities = new Set(state.orders.map((order) => order.facility).filter(Boolean));
  if (state.facility) facilities.add(state.facility);
  const metrics = [
    ["⇢", "Awaiting review", awaiting, `${activeOrders} active orders`],
    ["▤", "Catalogue items", PRODUCTS.filter((product) => product.active !== false).length, `${lowStock} marked low stock`],
    ["◎", "Facilities served", facilities.size, "Demo account records"],
    ["R", "Proforma value", money(totalValue), "Indicative · RWF"]
  ];
  const recentOrders = state.orders.slice().reverse().slice(0, 5);
  return `<div class="eyebrow"><span class="eyebrow-mark"></span> AFRIMEDICO OPERATIONS</div>
    <h1 class="page-heading">Operations overview</h1>
    <p class="page-subtitle">A single place to review incoming requests and keep the sample catalogue up to date.</p>
    ${adminNotice()}
    <section class="admin-metric-grid" aria-label="Operations summary">${metrics.map(([icon, label, value, note]) => `<article class="admin-metric-card"><span class="admin-metric-icon" aria-hidden="true">${icon}</span><div><span>${label}</span><strong>${value}</strong><small>${note}</small></div></article>`).join("")}</section>
    <div class="section-head"><div><h2>Latest requests</h2><p>Review facility requests and move them through the demo workflow.</p></div><button class="button button-secondary" type="button" data-route="admin-orders">All orders <span aria-hidden="true">→</span></button></div>
    ${recentOrders.length ? `<div class="admin-order-list">${recentOrders.map(renderAdminOrder).join("")}</div>` : `<section class="admin-empty"><span class="admin-empty-icon" aria-hidden="true">⇢</span><h2>No requests yet</h2><p>Requests submitted from the client workspace will appear here for review.</p><button class="button button-secondary" type="button" data-action="toggle-workspace">Open client workspace</button></section>`}`;
}

function renderAdminOrders() {
  const orders = state.orders.slice().reverse();
  return `<div class="eyebrow"><span class="eyebrow-mark"></span> REQUEST MANAGEMENT</div>
    <h1 class="page-heading">Orders</h1>
    <p class="page-subtitle">Review submitted proformas and update their demo fulfilment status.</p>
    ${adminNotice()}
    <div class="admin-list-toolbar"><div><strong>${orders.length} request${orders.length === 1 ? "" : "s"}</strong><span>Sorted newest first</span></div><button class="button button-secondary" type="button" data-action="toggle-workspace">Create a client request</button></div>
    ${orders.length ? `<div class="admin-order-list">${orders.map(renderAdminOrder).join("")}</div>` : `<section class="admin-empty"><span class="admin-empty-icon" aria-hidden="true">⇢</span><h2>Nothing to review</h2><p>Requests created from the client workspace will be added to this queue.</p><button class="button button-primary" type="button" data-action="toggle-workspace">Switch to client workspace</button></section>`}`;
}

function renderAdminOrder(order) {
  const index = Math.max(0, Math.min(ORDER_STEPS.length - 1, Number(order.statusIndex) || 0));
  const nextAction = ["Approve request", "Record payment", "Mark dispatched", "Confirm delivery"][index];
  const itemSummary = Array.isArray(order.items)
    ? order.items.map((item) => `${escapeHTML(item.name)} × ${Number(item.quantity) || 0}`).join(" · ")
    : "Item details unavailable";
  return `<article class="admin-order-card">
    <header class="admin-order-header"><div><span class="admin-order-ref">${escapeHTML(order.reference)}</span><span class="admin-order-date">${new Date(order.createdAt).toLocaleDateString("en-RW")}</span></div><span class="status-pill ${ORDER_STEPS[index].toLowerCase()}">${ORDER_STEPS[index]}</span></header>
    <div class="admin-order-body"><div><span class="admin-field-kicker">FACILITY</span><strong>${escapeHTML(order.facility)}</strong></div><div><span class="admin-field-kicker">REQUESTED ITEMS</span><p>${itemSummary || "No items listed"}</p></div>${order.notes ? `<div><span class="admin-field-kicker">CLIENT NOTE</span><p>${escapeHTML(order.notes)}</p></div>` : ""}</div>
    <footer class="admin-order-footer"><div><span>Indicative total</span><strong>${money(order.total)}</strong></div><div>${index < ORDER_STEPS.length - 1 ? `<button class="button button-primary button-small" type="button" data-action="advance-order" data-id="${escapeHTML(order.id)}">${nextAction} <span aria-hidden="true">→</span></button>` : `<span class="admin-complete-label">Delivery completed</span>`}</div></footer>
  </article>`;
}

function renderAdminProducts() {
  const products = PRODUCTS.slice().sort((left, right) => left.name.localeCompare(right.name));
  return `<div class="eyebrow"><span class="eyebrow-mark"></span> CATALOGUE MANAGEMENT</div>
    <div class="page-toolbar"><div><h1 class="page-heading">Product catalogue</h1><p class="page-subtitle">Manage sample pricing and availability shown in the client workspace.</p></div><button class="button button-primary" type="button" data-action="new-product">＋ Add product</button></div>
    ${adminNotice()}
    <div class="admin-list-toolbar"><div><strong>${products.filter((product) => product.active !== false).length} active products</strong><span>${products.length} total in catalogue</span></div><span class="admin-demo-caption">Edits are saved to this browser only</span></div>
    <div class="admin-product-table-wrap"><table class="admin-product-table"><thead><tr><th>Product</th><th>Category</th><th>Pack</th><th>Sample price</th><th>Availability</th><th>Listing</th><th></th></tr></thead>
    <tbody>${products.map((product) => `<tr class="${product.active === false ? "product-inactive" : ""}"><td><strong>${escapeHTML(product.name)}</strong>${product.premium ? `<small>Premium access</small>` : ""}</td><td>${escapeHTML(product.category)}</td><td>${escapeHTML(product.pack)}</td><td>${money(product.price)}</td><td><span class="availability-badge ${product.stock === "Low stock" ? "availability-low" : ""}">${escapeHTML(product.stock)}</span></td><td><span class="listing-badge">${product.active === false ? "Hidden" : "Visible"}</span></td><td><div class="admin-row-actions"><button class="admin-link-button" type="button" data-action="edit-product" data-id="${escapeHTML(product.id)}">Edit</button><button class="admin-link-button" type="button" data-action="toggle-product" data-id="${escapeHTML(product.id)}">${product.active === false ? "Publish" : "Hide"}</button></div></td></tr>`).join("")}</tbody></table></div>`;
}

function openProductModal(id) {
  const product = PRODUCTS.find((item) => item.id === id);
  const editing = Boolean(product);
  const value = product || { name: "", category: "Medicines", pack: "", price: "", stock: "In stock", mark: "", premium: false };
  document.querySelector("#modal-root").innerHTML = `<div class="modal-backdrop" data-action="backdrop-close"><section class="modal-card admin-product-modal" role="dialog" aria-modal="true" aria-labelledby="product-modal-title">
    <header class="modal-header"><div><h2 id="product-modal-title">${editing ? "Edit product" : "Add catalogue product"}</h2><p>Changes apply to this browser's client catalogue.</p></div><button class="modal-close" type="button" aria-label="Close" data-action="close-modal">×</button></header>
    <form id="admin-product-form"><input type="hidden" name="id" value="${editing ? escapeHTML(product.id) : ""}">
      <div class="admin-product-form-grid">
        <div class="form-group admin-form-wide"><label class="field-label" for="product-name">Product name</label><input class="form-field" id="product-name" name="name" maxlength="100" required value="${escapeHTML(value.name)}"></div>
        <div class="form-group"><label class="field-label" for="product-category">Category</label><select class="form-field" id="product-category" name="category">${CATEGORIES.filter((category) => category !== "All").map((category) => `<option ${category === value.category ? "selected" : ""}>${category}</option>`).join("")}</select></div>
        <div class="form-group"><label class="field-label" for="product-pack">Pack / unit</label><input class="form-field" id="product-pack" name="pack" maxlength="80" required value="${escapeHTML(value.pack)}"></div>
        <div class="form-group"><label class="field-label" for="product-price">Sample price (RWF)</label><input class="form-field" id="product-price" name="price" type="number" min="1" step="1" required value="${escapeHTML(value.price)}"></div>
        <div class="form-group"><label class="field-label" for="product-stock">Availability</label><select class="form-field" id="product-stock" name="stock">${["In stock", "Low stock", "By request"].map((stock) => `<option ${stock === value.stock ? "selected" : ""}>${stock}</option>`).join("")}</select></div>
        <div class="form-group"><label class="field-label" for="product-mark">Short label</label><input class="form-field" id="product-mark" name="mark" maxlength="8" required value="${escapeHTML(value.mark)}"></div>
        <label class="admin-premium-option"><input type="checkbox" name="premium" ${value.premium ? "checked" : ""}><span>Premium access required</span></label>
      </div>
      <p class="demo-notice">Demo only: this does not update a live inventory or customer catalogue.</p>
      <div class="modal-actions"><button class="button button-quiet" type="button" data-action="close-modal">Cancel</button><button class="button button-primary" type="submit">${editing ? "Save changes" : "Add product"}</button></div>
    </form></section></div>`;
  document.querySelector("#product-name").focus();
}

function render() {
  updateChrome();
  const content = document.querySelector("#app-content");
  const pages = { home: renderHome, catalog: renderCatalog, proforma: renderProforma, orders: renderOrders, premium: renderPremium, about: renderAbout, account: renderAccount, "admin-home": renderAdminOverview, "admin-orders": renderAdminOrders, "admin-products": renderAdminProducts };
  content.innerHTML = (pages[route] || renderHome)();
}

function addProduct(id) {
  const product = PRODUCTS.find((item) => item.id === id);
  if (!product) return;
  if (product.premium && !state.membership) {
    routeTo("premium");
    showToast("This product is available with Premium access.", "error");
    return;
  }
  state.cart[id] = (Number(state.cart[id]) || 0) + 1;
  saveState();
  render();
  showToast(`${product.name} added to your proforma.`);
}

function changeQuantity(id, delta) {
  const next = (Number(state.cart[id]) || 0) + delta;
  if (next <= 0) delete state.cart[id];
  else state.cart[id] = Math.min(next, 999);
  saveState();
  render();
}

function submitProforma(form) {
  const entries = cartEntries();
  if (!entries.length) {
    showToast("Add at least one product before submitting a proforma.", "error");
    return;
  }
  if (!state.pharmacyVerified || !state.pharmacyDocumentName) {
    routeTo("account");
    showToast("Upload a pharmacy registration document before ordering medicines. Verification is required for licensed pharmacy owners.", "error");
    return;
  }
  const formData = new FormData(form);
  const facility = String(formData.get("facility") || "").trim();
  if (!facility) {
    showToast("Enter your facility name to continue.", "error");
    return;
  }
  const idNumber = Number(state.nextReference) || 148;
  const order = {
    id: `order-${Date.now()}`,
    reference: `PF-${new Date().getFullYear()}-${String(idNumber).padStart(4, "0")}`,
    facility,
    notes: String(formData.get("notes") || "").trim(),
    items: entries.map(({ product, quantity }) => ({ id: product.id, name: product.name, quantity, price: linePrice(product) })),
    total: cartSubtotal(),
    statusIndex: 0,
    createdAt: new Date().toISOString()
  };
  state.facility = facility;
  state.nextReference = idNumber + 1;
  state.orders.push(order);
  state.cart = {};
  saveState();
  routeTo("orders");
  showToast(`${order.reference} submitted for demo sales review.`);
}

function advanceOrder(id) {
  const order = state.orders.find((item) => item.id === id);
  if (!order || order.statusIndex >= ORDER_STEPS.length - 1) return;
  order.statusIndex += 1;
  saveState();
  render();
  showToast(`${order.reference} updated: ${ORDER_STEPS[order.statusIndex]} (demo).`);
}

function toggleWorkspace() {
  state.workspace = state.workspace === "admin" ? "client" : "admin";
  route = state.workspace === "admin" ? "admin-home" : "home";
  saveState();
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openPaymentModal(plan) {
  const price = plan === "Annual" ? 480000 : 50000;
  document.querySelector("#modal-root").innerHTML = `<div class="modal-backdrop" data-action="backdrop-close"><section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="payment-title">
    <header class="modal-header"><div><h2 id="payment-title">Activate ${plan} Premium</h2><p>Choose a payment method to preview membership activation.</p></div><button class="modal-close" type="button" aria-label="Close" data-action="close-modal">×</button></header>
    <div class="summary-row"><span>${plan} plan</span><strong>${money(price)}${plan === "Annual" ? " / year" : " / month"}</strong></div>
    <form id="payment-form"><div class="payment-methods">
      <label class="payment-option"><input type="radio" name="method" value="MoMo" checked><span class="payment-symbol">MoMo</span><span><strong>Mobile Money</strong><small>MTN MoMo or Airtel Money</small></span></label>
      <label class="payment-option"><input type="radio" name="method" value="Bank transfer"><span class="payment-symbol">BANK</span><span><strong>Bank transfer</strong><small>Use the payment instructions from Afrimedico</small></span></label>
    </div><div class="demo-notice">Demo only: no money will be charged and no payment gateway is connected.</div>
      <div class="modal-actions"><button class="button button-quiet" type="button" data-action="close-modal">Cancel</button><button class="button button-primary" type="submit">Simulate payment · ${money(price)}</button></div>
    </form></section></div>`;
  document.querySelector(".modal-close").focus();
}

function confirmMembership(form) {
  const method = new FormData(form).get("method");
  state.membership = { plan: window.pendingPlan || "Monthly", method, activatedAt: new Date().toISOString() };
  saveState();
  document.querySelector("#modal-root").innerHTML = "";
  render();
  showToast(`Premium ${state.membership.plan.toLowerCase()} membership activated in demo mode.`);
}

function handleAction(button) {
  const { action, id, category } = button.dataset;
  if (button.dataset.route) {
    routeTo(button.dataset.route);
    return;
  }
  switch (action) {
    case "toggle-workspace":
      toggleWorkspace();
      break;
    case "backdrop-close":
      document.querySelector("#modal-root").innerHTML = "";
      break;
    case "open-category":
    case "filter-category":
      selectedCategory = category || "All";
      routeTo("catalog");
      break;
    case "open-catalog":
      routeTo("catalog");
      break;
    case "add-product":
      addProduct(id);
      break;
    case "change-quantity":
      changeQuantity(id, Number(button.dataset.delta));
      break;
    case "remove-product":
      delete state.cart[id];
      saveState();
      render();
      showToast("Product removed from your proforma.");
      break;
    case "set-slide":
      activeSlide = Number(button.dataset.index) || 0;
      render();
      break;
    case "next-slide":
      activeSlide = (activeSlide + 1) % 3;
      render();
      break;
    case "slide-primary":
      if (activeSlide === 1) {
        selectedCategory = "Oxygen";
        routeTo("catalog");
      } else if (activeSlide === 2) routeTo("premium");
      else routeTo("catalog");
      break;
    case "slide-secondary":
      if (activeSlide === 0) routeTo("about");
      else if (activeSlide === 1) routeTo("orders");
      else {
        selectedCategory = "Equipment";
        routeTo("catalog");
      }
      break;
    case "choose-plan":
      window.pendingPlan = button.dataset.plan;
      openPaymentModal(button.dataset.plan);
      break;
    case "close-modal":
      document.querySelector("#modal-root").innerHTML = "";
      break;
    case "advance-order":
      advanceOrder(id);
      break;
    case "new-product":
      openProductModal();
      break;
    case "edit-product":
      openProductModal(id);
      break;
    case "toggle-product": {
      const product = PRODUCTS.find((item) => item.id === id);
      if (!product) break;
      product.active = product.active === false;
      state.products = PRODUCTS;
      saveState();
      render();
      showToast(`${product.name} ${product.active ? "published to" : "hidden from"} the client catalogue.`);
      break;
    }
    case "notifications":
      showToast("You’re all caught up. New order updates will appear here.");
      break;
  }
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-route], [data-action]");
  if (!button) return;
  if (button.dataset.action === "backdrop-close" && event.target !== button) return;
  handleAction(button);
});

document.addEventListener("submit", (event) => {
  if (event.target.id === "proforma-form") {
    event.preventDefault();
    submitProforma(event.target);
  } else if (event.target.id === "payment-form") {
    event.preventDefault();
    confirmMembership(event.target);
  } else if (event.target.id === "account-form") {
    event.preventDefault();
    const formData = new FormData(event.target);
    const facility = String(formData.get("facility") || "").trim();
    const pharmacyOwner = formData.get("pharmacyOwner") === "on";
    const pharmacyDoc = event.target.querySelector("#pharmacy-doc")?.files?.[0];
    const pharmacyDocumentName = pharmacyDoc ? pharmacyDoc.name : state.pharmacyDocumentName;
    if (!facility) {
      showToast("Facility name cannot be empty.", "error");
      return;
    }
    if (!pharmacyOwner) {
      showToast("Please confirm that you are the authorised owner or manager of the pharmacy.", "error");
      return;
    }
    if (!pharmacyDocumentName) {
      showToast("Upload a pharmacy registration or licence document before requesting medicine orders.", "error");
      return;
    }
    state.facility = facility;
    state.pharmacyVerified = true;
    state.pharmacyDocumentName = pharmacyDocumentName;
    state.pharmacyVerifiedAt = new Date().toISOString();
    saveState();
    render();
    showToast("Facility and pharmacy verification details saved on this device.");
  } else if (event.target.id === "admin-product-form") {
    event.preventDefault();
    const values = new FormData(event.target);
    const name = String(values.get("name") || "").trim();
    const pack = String(values.get("pack") || "").trim();
    const price = Number(values.get("price"));
    const mark = String(values.get("mark") || "").trim();
    if (!name || !pack || !Number.isFinite(price) || price <= 0 || !mark) {
      showToast("Enter a product name, pack, valid price and short label.", "error");
      return;
    }
    const id = String(values.get("id") || "");
    const existing = PRODUCTS.find((product) => product.id === id);
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const productId = existing ? existing.id : `${slug || "product"}-${Date.now().toString(36)}`;
    const product = {
      ...(existing || {}),
      id: productId,
      name,
      category: String(values.get("category")),
      pack,
      price,
      stock: String(values.get("stock")),
      mark,
      premium: values.get("premium") === "on",
      active: existing ? existing.active !== false : true
    };
    if (existing) Object.assign(existing, product);
    else PRODUCTS.push(product);
    state.products = PRODUCTS;
    saveState();
    document.querySelector("#modal-root").innerHTML = "";
    render();
    showToast(existing ? `${name} updated.` : `${name} added to the catalogue.`);
  }
});

document.querySelector("#global-search").addEventListener("input", (event) => {
  searchTerm = event.target.value;
  if (route === "catalog") render();
});
document.querySelector("#global-search").addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    selectedCategory = "All";
    routeTo("catalog");
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    event.currentTarget.focus();
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") document.querySelector("#modal-root").innerHTML = "";
});
document.querySelector("#global-search").value = searchTerm;
render();
