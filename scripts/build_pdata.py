"""Writes static/pdata/<shard>.json: every product's data, split into 4096 small files.
The 404 page uses it to show any product whose page was not built (local `hugo server` sample,
Netlify test build). With the full production build every product has its own page and this is not needed.
usage: python3 scripts/build_pdata.py [site_dir]   (run after build_products.py)"""
import json, glob, os, sys, shutil

site = sys.argv[1] if len(sys.argv) > 1 else '.'


def shard(slug):
    # FNV-1a 32-bit, same function as in layouts/404.html
    h = 0x811c9dc5
    for b in slug.encode('utf-8'):
        h = ((h ^ b) * 0x01000193) & 0xffffffff
    return '%03x' % (h % 4096)


# products saved in the CMS (content/product/*.md) always have a real page (or are hidden on purpose)
cms = {os.path.splitext(os.path.basename(f))[0] for f in glob.glob(site + '/content/product/*.md') if not f.endswith('_index.md')}
out = {}
for f in glob.glob(site + '/data/products/*.json'):
    for p in json.load(open(f, encoding='utf-8')):
        if p['slug'] in cms:
            continue
        q = {k: v for k, v in p.items() if k not in ('slug', 'id')}
        out.setdefault(shard(p['slug']), {})[p['slug']] = q

d = site + '/static/pdata'
shutil.rmtree(d, ignore_errors=True)
os.makedirs(d)
for k, v in out.items():
    with open(f'{d}/{k}.json', 'w', encoding='utf-8') as fh:
        json.dump(v, fh, ensure_ascii=False, separators=(',', ':'))
print(sum(len(v) for v in out.values()), 'products in', len(out), 'files')
