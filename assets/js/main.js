// VW Impex – site interactions (no dependencies)

// Sticky header shadow
const header = document.querySelector('[data-header]');
if (header) {
  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
}

// Mobile menu
const menuBtn = document.querySelector('[data-menu-toggle]');
menuBtn?.addEventListener('click', () => {
  // place the panel right under the header, wherever the page is scrolled
  document.documentElement.style.setProperty('--nav-top', header.getBoundingClientRect().bottom + 'px');
  const open = document.body.classList.toggle('menu-open');
  menuBtn.setAttribute('aria-expanded', String(open));
  menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
});

// Products mega menu (click / keyboard; hover handled in CSS on desktop)
document.querySelectorAll('[data-mega-toggle]').forEach((btn) => {
  const item = btn.closest('.has-mega');
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = item.classList.toggle('is-open');
    btn.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('click', (e) => {
    if (!item.contains(e.target)) { item.classList.remove('is-open'); btn.setAttribute('aria-expanded', 'false'); }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { item.classList.remove('is-open'); btn.setAttribute('aria-expanded', 'false'); }
  });
});

// Brands: search + A–Z filter
const grid = document.querySelector('[data-brand-grid]');
if (grid) {
  const items = [...grid.children];
  const search = document.querySelector('[data-brand-search]');
  const count = document.querySelector('[data-brand-count]');
  const empty = document.querySelector('[data-brand-empty]');
  const letters = document.querySelectorAll('[data-letter]:is(button)');
  let letter = 'all';

  const apply = () => {
    const q = (search?.value || '').trim().toLowerCase();
    let shown = 0;
    items.forEach((li) => {
      const ok = (letter === 'all' || li.dataset.letter === letter) && (!q || li.dataset.name.includes(q));
      li.hidden = !ok;
      if (ok) shown++;
    });
    if (count) count.textContent = shown;
    if (empty) empty.hidden = shown !== 0;
  };

  search?.addEventListener('input', apply);
  letters.forEach((b) => b.addEventListener('click', () => {
    letters.forEach((x) => x.classList.remove('is-active'));
    b.classList.add('is-active');
    letter = b.dataset.letter;
    apply();
  }));
}

// Product browser (sub-category + brand pages): JSON rows → old-site style cards, search + brand filter + pages of 15
// row = slug \t brand \t part \t type \t dims \t specs(a|b) \t image \t price
document.querySelectorAll('[data-product-browser]').forEach(async (box) => {
  const listEl = box.querySelector('[data-list]'), pager = box.querySelector('[data-pager]');
  const q = box.querySelector('[data-q]'), brandSel = box.querySelector('[data-brand]'), countEl = box.querySelector('[data-count]');
  const PER = 15, quote = box.dataset.quote, defImg = box.dataset.img || '', sub = box.dataset.sub || '';
  let page = 1, rows = [], view = [];
  try { rows = (await (await fetch(box.dataset.src)).json()).map((r) => r.split('\t')); } catch (e) { return; }
  if (brandSel) [...new Set(rows.map((r) => r[1]))].sort().forEach((b) => brandSel.add(new Option(b, b)));
  const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const icon = (n) => { const u = document.querySelector('use[href*="#i-"]'); const sp = u ? u.getAttribute('href').split('#')[0] : ''; return `<svg class="icon" width="15" height="15" aria-hidden="true"><use href="${sp}#i-${n}"/></svg>`; };
  const card = (r) => {
    const [slug, brand, part, type, dims, specs, img, price] = r, url = '/product/' + slug, src = img || r[8] || defImg;
    const title = `${brand} - ${part}${(r[9] || sub) ? ' | ' + (r[9] || sub) : ''}${dims ? ' | ' + dims : ''}`;
    return `<article class="pcard"><a class="pcard-media" href="${url}">${src ? `<img src="${esc(src)}" alt="${esc(brand + ' ' + part)}" loading="lazy" width="240" height="240" onerror="this.remove()">` : ''}</a>` +
      `<div class="pcard-body"><h3><a href="${url}">${esc(title)}</a></h3>${type ? `<p class="pcard-type">${esc(type)}</p>` : ''}` +
      (specs ? `<ul class="spec-list">${specs.split('|').map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '') +
      (price ? `<p class="price" data-inr="${esc(price)}">₹${Number(price).toLocaleString('en-IN')}</p>` : '') +
      `<ul class="pcard-points"><li>${icon('check')} Availability: <strong>Sourced to Order</strong></li><li>${icon('truck')} <strong>Standard Dispatch:</strong> 7–9 Business Days</li><li>${icon('tag')} <strong>Get a Quote</strong> for Exact Pricing &amp; Lead Time</li></ul>` +
      `<a class="btn btn-primary" href="${quote}/${esc(slug)}">Get A Quote</a></div></article>`;
  };
  function filter() {
    const t = norm(q && q.value), b = brandSel ? brandSel.value : '';
    view = rows.filter((r) => (!b || r[1] === b) && (!t || norm(r[1] + r[2] + r[4]).includes(t) || norm(r[2]).includes(t)));
    if (countEl) countEl.textContent = view.length.toLocaleString('en-IN');
    page = 1; render(false);
  }
  function render(scroll) {
    const pages = Math.max(1, Math.ceil(view.length / PER));
    listEl.innerHTML = view.slice((page - 1) * PER, page * PER).map(card).join('') || '<p class="muted">No products match.</p>';
    const cur = (localStorage.getItem && (() => { try { return localStorage.getItem('vw-cur'); } catch (e) { return null; } })());
    if (cur === 'USD') document.querySelector('[data-cur="USD"]')?.click();
    const btn = (p, label, c) => `<button type="button" data-p="${p}"${c ? ' aria-current="page" class="is-active"' : ''}>${label}</button>`;
    let h = '';
    if (pages > 1) {
      if (page > 1) h += btn(page - 1, '‹ Prev');
      const s = Math.max(1, page - 2), e = Math.min(pages, page + 2);
      if (s > 1) h += btn(1, '1') + (s > 2 ? '<span>…</span>' : '');
      for (let i = s; i <= e; i++) h += btn(i, i, i === page);
      if (e < pages) h += (e < pages - 1 ? '<span>…</span>' : '') + btn(pages, pages);
      if (page < pages) h += btn(page + 1, 'Next ›');
    }
    pager.innerHTML = h;
    if (scroll) box.scrollIntoView({ behavior: 'smooth' });
  }
  pager.addEventListener('click', (e) => { const p = e.target.closest('[data-p]'); if (!p) return; page = +p.dataset.p; render(true); });
  let tmr; q && q.addEventListener('input', () => { clearTimeout(tmr); tmr = setTimeout(filter, 150); });
  brandSel && brandSel.addEventListener('change', filter);
  filter();
});

// /getQuote/<slug>: pre-fill the product field from the URL
const qProduct = document.getElementById('q-product');
if (qProduct) {
  const m = location.pathname.match(/\/getQuote\/([^/]+)/);
  if (m && !qProduct.value) qProduct.value = decodeURIComponent(m[1]).replace(/-/g, ' ').toUpperCase();
}

// Editors: visiting /admin sets this flag, which reveals "Edit in CMS" links on the site
try { if (localStorage.getItem('vw-editor')) document.querySelectorAll('[data-editor-only]').forEach((a) => (a.hidden = false)); } catch (e) {}

// Currency switch (prices are stored in INR; USD = INR × rate from Settings)
(function () {
  const box = document.querySelector('[data-usd-rate]');
  if (!box) return;
  const rate = parseFloat(box.dataset.usdRate) || 0;
  const fmt = (n, cur) => cur === 'USD'
    ? '$' + (n * rate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  const apply = (cur) => {
    document.querySelectorAll('[data-inr]').forEach((el) => (el.textContent = fmt(parseFloat(el.dataset.inr), cur)));
    box.querySelectorAll('[data-cur]').forEach((b) => b.classList.toggle('is-active', b.dataset.cur === cur));
    try { localStorage.setItem('vw-cur', cur); } catch (e) {}
  };
  box.addEventListener('click', (e) => { const b = e.target.closest('[data-cur]'); if (b) apply(b.dataset.cur); });
  let saved = 'INR'; try { saved = localStorage.getItem('vw-cur') || 'INR'; } catch (e) {}
  if (saved !== 'INR') apply(saved);
})();

// Site search (/search?q=…): brands + categories from meta.json, products from small index files by part-number prefix
(function () {
  const box = document.querySelector('[data-site-search]');
  if (!box) return;
  const base = box.dataset.base, input = box.querySelector('[data-sq]');
  const metaEl = box.querySelector('[data-s-meta]'), prodEl = box.querySelector('[data-s-products]'), status = box.querySelector('[data-s-status]');
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const cache = {};
  const getJSON = async (f) => { if (!(f in cache)) { try { cache[f] = await (await fetch(base + f + '.json')).json(); } catch (e) { cache[f] = []; } } return cache[f]; };
  let meta = null, seq = 0;
  async function run(q) {
    const my = ++seq; q = q.trim();
    history.replaceState(null, '', q ? '?q=' + encodeURIComponent(q) : location.pathname);
    if (!q) { metaEl.innerHTML = prodEl.innerHTML = status.textContent = ''; return; }
    meta = meta || await getJSON('meta');
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    // a word that is a brand name filters products by that brand
    let brandFilter = null, partWords = [];
    for (const w of words) { const b = meta.brands.find((x) => norm(x[0]) === norm(w)); if (b && !brandFilter) brandFilter = b; else partWords.push(w); }
    const nq = norm(q);
    const brands = meta.brands.filter((b) => norm(b[0]).includes(nq) || (brandFilter && b === brandFilter)).slice(0, 8);
    const cats = meta.categories.filter((c) => words.every((w) => c[0].toLowerCase().includes(w))).slice(0, 8);
    let html = '';
    if (brands.length) html += '<div class="sg"><h3>Brands</h3><div class="chip-list">' + brands.map((b) => `<a class="chip" href="/brand/${esc(b[1])}">${esc(b[0])}${b[2] ? ` <span class="muted">${b[2].toLocaleString('en-IN')}</span>` : ''}</a>`).join('') + '</div></div>';
    if (cats.length) html += '<div class="sg"><h3>Categories</h3><div class="chip-list">' + cats.map((c) => `<a class="chip" href="${esc(c[1])}">${esc(c[0])}${c[2] ? ` <span class="muted">· ${esc(c[2])}</span>` : ''}</a>`).join('') + '</div></div>';
    metaEl.innerHTML = html;
    // products: by part number prefix (2–3 characters pick the index file)
    const part = norm(partWords.join(''));
    let rows = [];
    if (part.length >= 2) {
      const k2 = part.slice(0, 2);
      const file = meta.split.includes(k2) ? (part.length >= 3 ? part.slice(0, 3) : null) : k2;
      if (file) rows = await getJSON(file);
      else { status.textContent = 'Type one more character of the part number…'; prodEl.innerHTML = ''; return; }
      rows = rows.filter((r) => norm(r[2]).startsWith(part) && (!brandFilter || norm(r[1]) === norm(brandFilter[0])));
    } else if (brandFilter) {
      status.innerHTML = `Open the <a href="/brand/${esc(brandFilter[1])}">${esc(brandFilter[0])} page</a> to browse all its products, or add a part number.`;
      prodEl.innerHTML = ''; return;
    }
    if (my !== seq) return;
    rows.sort((a, b) => a[2].length - b[2].length);
    const shown = rows.slice(0, 100);
    prodEl.innerHTML = shown.length ? '<h3 class="sg-title">Products</h3><ul class="browser-list">' + shown.map((r) =>
      `<li class="browser-item"><a class="browser-name" href="/product/${esc(r[0])}"><strong>${esc(r[1])}</strong> ${esc(r[2])} <span class="muted">· ${esc(r[3])}</span></a>` +
      `<span class="browser-dims">${r[4] ? esc(r[4]) : ''}</span><a class="btn btn-ghost btn-sm" href="${box.dataset.quote}/${esc(r[0])}">Get a Quote</a></li>`).join('') + '</ul>' : '';
    status.textContent = rows.length ? (rows.length > 100 ? `Showing 100 of ${rows.length.toLocaleString('en-IN')} parts – type more of the part number to narrow down.` : `${rows.length} part${rows.length > 1 ? 's' : ''} found.`)
      : (part.length >= 2 ? 'No part number starts with “' + q + '”.' : '');
  }
  let t;
  input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => run(input.value), 200); });
  box.querySelector('form').addEventListener('submit', (e) => { e.preventDefault(); run(input.value); });
  const q0 = new URLSearchParams(location.search).get('q') || '';
  input.value = q0; if (q0) run(q0); input.focus();
})();

// Scroll reveal (IntersectionObserver, no library)
(function () {
  const els = document.querySelectorAll('.reveal');
  if (!els.length) return;
  if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) { els.forEach((e) => e.classList.add('in')); return; }
  const io = new IntersectionObserver((list) => list.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  els.forEach((e) => io.observe(e));
})();
