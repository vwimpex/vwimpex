"""Converts the storefront crawl (vwimpex-product-slugs.json from the browser) into data/catalog/product-slugs.json.
usage: slugs_from_crawl.py crawl.json [orphans.json] out.json
crawl.json : {"subs": {"cat/sub": [[slug, title, type, specs, img], ...]}}
orphans    : {"Brand|Part": [slug, CATEGORY, Subcat]}  (products not listed in any sub-category)"""
import json, sys, re
args = sys.argv[1:]; out = args[-1]
crawl = json.load(open(args[0]))['subs']
rows = []
for key, items in crawl.items():
    for slug, title, typ, specs, img in items:
        brand, _, rest = title.partition(' - ')
        part = rest.split(' | ')[0].strip()
        rows.append([slug, key, brand.strip(), part, img or ''])
if len(args) == 3:
    catslug = {'HOUSINGS': 'housings', 'SPECIAL BEARINGS': 'special-bearings'}
    for bp, (slug, cat, sub) in json.load(open(args[1])).items():
        brand, part = bp.split('|', 1)
        rows.append([slug, catslug.get(cat.upper(), cat.lower().replace(' ', '-')) + '/', brand, part, ''])
json.dump(rows, open(out, 'w'), ensure_ascii=False, separators=(',', ':'))
print(len(rows), 'slugs')
