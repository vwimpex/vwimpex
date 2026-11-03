// Sub-category product list: old-site style cards, 15 per page, with
//  - search box (part number, brand, size)
//  - sidebar filters like the old site: dimensions (MM / INCH, inner / outer / width) + brand checkboxes (several at once)
// row = slug, brand, part, type, dims, specs(a|b), image, price, fallback image, sub title, inner mm, outer mm, width mm (tab separated)
(function () {
  const box = document.querySelector('[data-product-list]');
  if (!box) return;
  const form = document.querySelector('[data-pf-form]');
  const listEl = box.querySelector('[data-list]'), pager = box.querySelector('[data-pager]');
  const q = box.querySelector('[data-q]'), countEl = box.querySelector('[data-count]');
  const PER = 15, SHOW = 6, quote = box.dataset.quote, defImg = box.dataset.img || '', sub = box.dataset.sub || '';
  let page = 1, rows = [], view = [], checked = new Set(), dims = {}, showAll = false;

  const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const sprite = (() => { const u = document.querySelector('use[href*="#i-"]'); return u ? u.getAttribute('href').split('#')[0] : ''; })();
  const icon = (n) => `<svg class="icon" width="15" height="15" aria-hidden="true"><use href="${sprite}#i-${n}"/></svg>`;

  const card = (r) => {
    const [slug, brand, part, type, dimsTxt, specs, img, price] = r, url = '/product/' + slug, src = img || r[8] || defImg;
    const title = `${brand} - ${part}${(r[9] || sub) ? ' | ' + (r[9] || sub) : ''}${dimsTxt ? ' | ' + dimsTxt : ''}`;
    return `<article class="pcard"><a class="pcard-media" href="${url}">${src ? `<img src="${esc(src)}" alt="${esc(brand + ' ' + part)}" loading="lazy" width="240" height="240" onerror="this.remove()">` : ''}</a>` +
      `<div class="pcard-body"><h3><a href="${url}">${esc(title)}</a></h3>${type ? `<p class="pcard-type">${esc(type)}</p>` : ''}` +
      (specs ? `<ul class="spec-list">${specs.split('|').map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '') +
      (price ? `<p class="price" data-inr="${esc(price)}">₹${Number(price).toLocaleString('en-IN')}</p>` : '') +
      `<ul class="pcard-points"><li>${icon('check')} Availability: <strong>Sourced to Order</strong></li><li>${icon('truck')} <strong>Standard Dispatch:</strong> 7–9 Business Days</li><li>${icon('tag')} <strong>Get a Quote</strong> for Exact Pricing &amp; Lead Time</li></ul>` +
      `<a class="btn btn-primary" href="${quote}/${esc(slug)}">Get A Quote</a></div></article>`;
  };

  // ---- brand checkboxes (only brands that are in this list, with counts) ----
  const brandsEl = form && form.querySelector('[data-pf-brands]');
  const moreBtn = form && form.querySelector('[data-pf-more]');
  const bsearch = form && form.querySelector('[data-pf-bsearch]');
  let brands = [];
  function drawBrands() {
    if (!brandsEl) return;
    const t = norm(bsearch && bsearch.value);
    const list = brands.filter(([b]) => !t || norm(b).includes(t));
    const shown = showAll || t ? list : list.filter(([b], i) => i < SHOW || checked.has(b));
    brandsEl.innerHTML = shown.map(([b, n]) =>
      `<li><label><input type="checkbox" value="${esc(b)}"${checked.has(b) ? ' checked' : ''}> <span>${esc(b)}</span> <small>(${n})</small></label></li>`).join('') ||
      '<li class="muted">No brand found</li>';
    if (moreBtn) { moreBtn.hidden = !!t || list.length <= SHOW; moreBtn.textContent = showAll ? '− Less' : `+ More (${list.length - SHOW})`; }
  }

  // ---- filtering ----
  const TOL = 0.06; // mm: 15.8 matches 15.80; inch values are converted to mm
  function readDims() {
    dims = {};
    if (!form) return;
    const inch = form.querySelector('[data-pf-unit]').value === 'INCH';
    form.querySelectorAll('[data-pf-dim]').forEach((el) => {
      const v = parseFloat(String(el.value).replace(',', '.'));
      if (!isNaN(v)) dims[el.dataset.pfDim] = inch ? v * 25.4 : v;
    });
  }
  function filter() {
    const t = norm(q && q.value);
    view = rows.filter((r) => {
      if (checked.size && !checked.has(r[1])) return false;
      for (const k in dims) { const v = parseFloat(r[k]); if (isNaN(v) || Math.abs(v - dims[k]) > TOL + dims[k] * 0.001) return false; }
      return !t || norm(r[1] + r[2] + r[4]).includes(t) || norm(r[2]).includes(t);
    });
    if (countEl) countEl.textContent = view.length.toLocaleString('en-IN');
    page = 1; render(false);
  }
  function render(scroll) {
    const pages = Math.max(1, Math.ceil(view.length / PER));
    listEl.innerHTML = view.slice((page - 1) * PER, page * PER).map(card).join('') ||
      '<div class="card empty-card"><h3>No products match these filters</h3><p class="muted">Clear a filter, or send us the size and we will source it.</p></div>';
    try { if (localStorage.getItem('vw-cur') === 'USD') document.querySelector('[data-cur="USD"]')?.click(); } catch (e) {}
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

  (async () => {
    try { rows = (await (await fetch(box.dataset.src)).json()).map((r) => r.split('\t')); } catch (e) { return; }
    const cnt = {}; rows.forEach((r) => { cnt[r[1]] = (cnt[r[1]] || 0) + 1; });
    brands = Object.entries(cnt).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    if (bsearch) bsearch.hidden = brands.length <= 12;
    drawBrands();
    filter();
  })();

  pager.addEventListener('click', (e) => { const p = e.target.closest('[data-p]'); if (!p) return; page = +p.dataset.p; render(true); });
  let tmr; q && q.addEventListener('input', () => { clearTimeout(tmr); tmr = setTimeout(filter, 150); });
  if (form) {
    brandsEl.addEventListener('change', (e) => {
      const c = e.target.closest('input[type=checkbox]'); if (!c) return;
      c.checked ? checked.add(c.value) : checked.delete(c.value);
      filter();
    });
    moreBtn.addEventListener('click', () => { showAll = !showAll; drawBrands(); });
    bsearch && bsearch.addEventListener('input', drawBrands);
    form.addEventListener('submit', (e) => { e.preventDefault(); readDims(); filter(); box.scrollIntoView({ behavior: 'smooth' }); });
    form.addEventListener('reset', () => { setTimeout(() => { checked.clear(); dims = {}; showAll = false; drawBrands(); filter(); }, 0); });
  }
})();
