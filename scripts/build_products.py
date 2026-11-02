"""Builds data/products/<category>.json from the admin export (+ crawl slugs when available).
usage: build_products.py export.csv site_dir [crawl_slugs.json] [--only=<cat-slug>]"""
import csv, sys, json, re, collections, yaml, os
exp, site = sys.argv[1], sys.argv[2]
crawl_path = next((a for a in sys.argv[3:] if not a.startswith('--') and os.path.exists(a)), None)
only = next((a.split('=',1)[1] for a in sys.argv[3:] if a.startswith('--only=')), None)
norm = lambda s: re.sub(r'[^a-z0-9]', '', (s or '').lower())
def sl(s):
    s = re.sub(r"[./'\"()+,®*]", '', s.lower()); return re.sub(r'[^a-z0-9]+', '-', s).strip('-')
import glob as _g
cats = sorted((yaml.safe_load(open(f)) for f in _g.glob(site + '/data/categories/*.yaml')), key=lambda c: c.get('weight', 0))
crawl = json.load(open(site + '/data/catalog/categories.json'))
catmap, submap = {}, {}
for c in cats:
    catmap[norm(c['name'])] = c['slug']
    for s in c['subcategories']:
        h1 = (crawl.get(f"/products/category/{c['slug']}/{s['slug']}", {}).get('h1') or '').split('/')[-1].strip()
        for n in {s['name'], h1, s.get('heading') or ''} - {''}:
            if n: submap.setdefault((c['slug'], norm(n)), set()).add(s['slug'])
catmap.update({norm('Seals/Snap Rings'): 'sealssnap-rings', norm('Roller and Inline Skates Accessories'): 'roller-and-inline-skates-accessories'})
# Old-site slugs: data/catalog/product-slugs.json = [[slug, "cat/sub", brand, part, img], ...]
# (made once from the storefront crawl by scripts/slugs_from_crawl.py)
real = {}; crawl_titles = {}
if crawl_path:
    for slug, key, brand, part, img in json.load(open(crawl_path)):
        cat, _, sub = key.partition('/')
        crawl_titles[slug] = f"{brand} - {part}"
        real.setdefault((norm(brand), norm(part), cat), []).append((slug, sub, img))
NA = {'', 'n/a', 'na', '-', 'none', 'null'}
clean = lambda v: '' if (v or '').strip().lower() in NA else re.sub(r'(&nbsp;|\u00a0)+', ' ', v).strip()
num = lambda v: v if v not in ('', '0', '0.0') else ''
include_hidden = '--include-hidden' in sys.argv
out = collections.defaultdict(list); stats = collections.Counter(); used = set()
rows = [r for r in csv.DictReader(open(exp, encoding='utf-8'))]

def record(r, cat, slug, sub, img):
    brand, part = r['BRAND'].strip(), r['PART NO'].strip()
    def dim(v, u):
        v = num(re.sub(r'^(\d+),(\d+)$', r'\1.\2', (v or '').strip()))   # "673,1" → "673.1"
        return f"{v} {u.strip().lower() or 'mm'}" if v else ''
    p = {'id': int(r['SERIAL NO.']), 'slug': slug, 'cat': cat, 'sub': sub, 'subName': r['SUB CATEGORY'].strip(),
         'brand': brand, 'part': part, 'desc': clean(r['DESCRIPTION']), 'tech': clean(r['TECHNICAL DETAILS']),
         'di': dim(r['INNER DIAMETER'], r['INNER DIAMETER  MEASURE UNITS']), 'do': dim(r['OUTER DIAMETER'], r['OUTER DIAMETER MEASURE UNITS']),
         'w': dim(r['WIDTH'], r['WIDTH MEASURE UNITS']), 'l': dim(r['LENGTH'], r['LENGTH  MEASURE UNITS']),
         'kg': num(r['WEIGHT']), 'cage': clean(r['CAGE']), 'seal': clean(r['SEAL']), 'bore': clean(r['BORE']),
         'lub': clean(r['LUBRICATION']), 'moq': num(r['MINIMUM ORDER QTY']), 'hsn': r['HSN CODE'].strip(),
         'price': num(r['MRP'].strip()), 'pdf': r['PDF Link'].strip() if r['PDF Link'].strip() not in ('', 'N/A') else '', 'img': img}
    out[cat].append({k: v for k, v in p.items() if v not in ('', None)})

# index of old-site slugs by (brand, part) for the category-independent fallback
by_bp = collections.defaultdict(list)
for (b, pn, c), lst in real.items():
    for x in lst: by_bp[(b, pn)].append((x[0], x[1], x[2], c))
pending = []
for r in rows:   # pass 1: exact brand + part + category
    cat = catmap.get(norm(r['CATEGORY']))
    if not cat or (only and cat != only): continue
    subs = submap.get((cat, norm(r['SUB CATEGORY'])), set())
    cand = [c for c in real.get((norm(r['BRAND']), norm(r['PART NO']), cat), []) if c[0] not in used]
    if cand:
        best = next((c for c in cand if c[1] and c[1] in subs), cand[0])
        used.add(best[0]); stats['slug_from_old_site'] += 1
        record(r, cat, best[0], best[1] or (sorted(subs)[0] if len(subs) == 1 else ''), best[2])
    else:
        pending.append((r, cat, subs))
for r, cat, subs in pending:   # pass 2: brand + part in any category, then products not listed on the old site
    cand = [c for c in by_bp.get((norm(r['BRAND']), norm(r['PART NO'])), []) if c[0] not in used]
    if cand:
        slug, sub, img, ccat = cand[0]; used.add(slug); stats['slug_from_old_site_fallback'] += 1
        record(r, ccat, slug, sub, img); continue
    # products whose sub-category is not in the old site menu but which DO have pages there (checked via site search)
    orphan = (cat, norm(r['SUB CATEGORY'])) in {('housings', 'locknut'), ('special-bearings', 'ballscrew')}
    if real and not orphan and not include_hidden:
        stats['skipped_not_on_old_site'] += 1; continue
    slug = f"{sl(r['BRAND'])}-{cat}-{sl(r['PART NO'])}"
    if slug in used: slug = f"{slug}-{r['SERIAL NO.'].strip()}"; stats['slug_dup_fixed'] += 1
    used.add(slug); stats['slug_derived'] += 1
    record(r, cat, slug, sorted(subs)[0] if len(subs) == 1 else '', '')
# old-site URLs with no export row left: keep them as basic pages so no old URL breaks
for (b, pn, cat), lst in real.items():
    for slug, sub, img in lst:
        if slug in used or (only and cat != only): continue
        title = crawl_titles.get(slug, '')
        brand, _, rest = title.partition(' - ')
        used.add(slug); stats['old_site_only'] += 1
        out[cat].append({'id': 0, 'slug': slug, 'cat': cat, 'sub': sub, 'brand': brand.strip(), 'part': rest.split(' | ')[0].strip(), 'subName': (rest.split(' | ') + ['', ''])[1].strip(), 'img': img})
os.makedirs(site + '/data/products', exist_ok=True)
for f in os.listdir(site + '/data/products'):
    if f.endswith('.json') and (not only or f == only + '.json'): os.remove(os.path.join(site, 'data/products', f))
for cat, items in out.items():
    json.dump(items, open(f"{site}/data/products/{cat}.json", 'w'), ensure_ascii=False, separators=(',', ':'))
# product sitemaps (static files, 45k URLs each) – base URL from config/_default/hugo.toml
if not only:
    import glob
    base = re.search(r'baseURL\s*=\s*"([^"]+)"', open(site + '/config/_default/hugo.toml').read()).group(1).rstrip('/')
    os.makedirs(site + '/static/sitemaps', exist_ok=True)
    for f in glob.glob(site + '/static/sitemaps/products-*.xml'): os.remove(f)
    slugs = [p['slug'] for items in out.values() for p in items]
    for n, i in enumerate(range(0, len(slugs), 45000), 1):
        with open(f"{site}/static/sitemaps/products-{n}.xml", 'w') as f:
            f.write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n')
            f.writelines(f'<url><loc>{base}/product/{s}</loc></url>\n' for s in slugs[i:i+45000])
            f.write('</urlset>\n')

# Card row for product lists (same format as the Hugo sub-category lists, + fallback image + sub-category title):
# slug, brand, part, type, dims, specs, own image, price, fallback image, sub-category
CDN = 'https://d6qdphvz7to5l.cloudfront.net'
_subimg = {(c['slug'], s_['slug']): (s_.get('image') or c.get('image') or '', s_.get('heading') or s_['name']) for c in cats for s_ in c['subcategories']}
def _url(u): return u if (not u or u.startswith('http') or u.startswith('/images/')) else CDN + u
def _t(v): return ' '.join(w.capitalize() for w in str(v).lower().split())
def dims_text(p):
    vals, unit = [], ''
    for x in (p.get('di', ''), p.get('do', ''), p.get('w', ''), p.get('l', '')):
        if not x: continue
        m = re.match(r'^\s*([0-9.,/\- ]*[0-9])\s*([a-zA-Z]*)\s*$', x)
        vals.append(m.group(1) if m else x); unit = unit or (m.group(2) if m else '')
    return f"{' × '.join(vals)} {(unit or 'mm').lower()}" if vals else ''
def card_row(p):
    dims = dims_text(p)
    specs = [f"{lab}: {_t(p[k])}" for k, lab in (('bore', 'Bore'), ('seal', 'Seal'), ('cage', 'Cage'), ('lub', 'Lubrication')) if p.get(k)]
    if p.get('kg'): specs.append(f"Weight: {p['kg']} Kg")
    fb, subt = _subimg.get((p['cat'], p.get('sub', '')), ('', p.get('subName', '')))
    typ = re.sub(r'\s+', ' ', p.get('desc', ''))[:90]
    return '\t'.join([p['slug'], p.get('brand', ''), p.get('part', ''), typ, dims, '|'.join(specs), _url(p.get('img', '')), str(p.get('price', '')), _url(fb), subt])

# Brand product lists for brand pages: static/data/brand/<brand-slug>.json (same row format as the sub-category lists)
# + data/brandcounts.json {brand-slug: count}. Brand slugs come from content/brand/*.md
if not only:
    import glob as _g2, shutil
    bmap = {}
    for f in _g2.glob(site + '/content/brand/*.md'):
        if f.endswith('_index.md'): continue
        fm = yaml.safe_load(open(f).read().split('---')[1])
        bmap[norm(fm['title'])] = fm.get('slug') or os.path.basename(f)[:-3]
    lists = collections.defaultdict(list)
    for items in out.values():
        for p in items:
            b = bmap.get(norm(p.get('brand')))
            if b: lists[b].append(card_row(p))
    shutil.rmtree(site + '/static/data/brand', ignore_errors=True); os.makedirs(site + '/static/data/brand')
    for b, rows in lists.items():
        json.dump(rows, open(f"{site}/static/data/brand/{b}.json", 'w'), ensure_ascii=False, separators=(',', ':'))
    json.dump({b: len(r) for b, r in lists.items()}, open(site + '/data/brandcounts.json', 'w'), separators=(',', ':'))
    stats['brands_with_products'] = len(lists); stats['products_linked_to_brand'] = sum(len(r) for r in lists.values())

# Site search index: static/search/<prefix>.json (products by the first 2–3 letters/digits of the part number)
# + static/search/meta.json (brands, categories, which prefixes are split into 3 letters)
if not only:
    import shutil as _sh
    catnames = {c['slug']: c['name'] for c in cats}
    subnames = {(c['slug'], s_['slug']): (s_.get('heading') or s_['name']) for c in cats for s_ in c['subcategories']}
    shards = collections.defaultdict(list)
    for items in out.values():
        for p in items:
            key = norm(p.get('part'))[:2]
            if len(key) < 2: key = (key + '_')[:2]
            typ = subnames.get((p['cat'], p.get('sub', '')), p.get('subName') or catnames.get(p['cat'], ''))
            dims = dims_text(p)
            shards[key].append([p['slug'], p.get('brand', ''), p.get('part', ''), typ, dims])
    _sh.rmtree(site + '/static/search', ignore_errors=True); os.makedirs(site + '/static/search')
    split = []
    for key, rows in shards.items():
        if len(rows) > 4000:
            split.append(key); sub3 = collections.defaultdict(list)
            for r in rows: sub3[(norm(r[2]) + '__')[:3]].append(r)
            for k3, r3 in sub3.items(): json.dump(r3, open(f"{site}/static/search/{k3}.json", 'w'), ensure_ascii=False, separators=(',', ':'))
        else:
            json.dump(rows, open(f"{site}/static/search/{key}.json", 'w'), ensure_ascii=False, separators=(',', ':'))
    brands_meta = []
    for f in sorted(_g2.glob(site + '/content/brand/*.md')):
        if f.endswith('_index.md'): continue
        fm = yaml.safe_load(open(f).read().split('---')[1]); sl_ = fm.get('slug') or os.path.basename(f)[:-3]
        brands_meta.append([fm['title'], sl_, len(lists.get(sl_, []))])
    cats_meta = [[c['name'], f"/products/category/{c['slug']}", ''] for c in cats] + \
                [[s_.get('heading') or s_['name'], f"/products/category/{c['slug']}/{s_['slug']}", c['name']] for c in cats for s_ in c['subcategories']]
    json.dump({'split': split, 'brands': brands_meta, 'categories': cats_meta}, open(site + '/static/search/meta.json', 'w'), ensure_ascii=False, separators=(',', ':'))
    stats['search_files'] = len(os.listdir(site + '/static/search'))

print(dict(stats), {k: len(v) for k, v in out.items()})
