# VW Impex – Hugo website + Decap CMS

New static version of vwimpex.com (old site: PHP CodeIgniter). Same URLs as the old site, same CMS as the Bionic site (Decap CMS).

## 1. Run locally
```bash
hugo server                          # http://localhost:1313  (50 sample products per category)
HUGO_PRODUCTS=gearbox hugo server    # or pick categories
```
Hugo **extended v0.146+** (tested 0.152.2). All links work locally as on the live site (`/about-us`, `/brand/skf-bearings`):
`config/development/hugo.toml` switches `hugo server` to folder URLs; production builds (`hugo`, Netlify) still write `about-us.html`.

CMS locally: in a 2nd terminal run `npx decap-server`, then open http://localhost:1313/admin/ (no login needed locally).
After adding a product in the CMS locally, restart `hugo server` to see it.

### Easiest: ./dev.sh
```bash
./dev.sh                                        # normal (50 products per category)
./dev.sh rexroth-ball-bearings-r0531-212-10     # opens with that product built
./dev.sh gearbox                                # one whole category
```

### See every product locally (same as the live site)
`hugo server` builds a sample (fast, low memory): the first 50 products per category and the first 24 of every sub-category (so the first page of every product list works). Other `/product/...` URLs give 404 there.
- One category: `HUGO_PRODUCTS=ball-bearings hugo server`
- Whole site exactly like Netlify (all ~234k products, clean URLs from `static/serve.json`):
  ```bash
  ./build.sh                 # ~25 min, ~4 GB in public/
  npx serve@14 public        # http://localhost:3000/product/rexroth-ball-bearings-r0531-212-10
  ```
  Faster test: `HUGO_PRODUCTS="ball-bearings@59000-59100,gearbox" hugo --minify && npx serve@14 public`

## 2. Deploy on Netlify (testing)
1. Push this folder to a GitHub repo (branch `main`).
2. Netlify → **Add new site → Import from Git** → pick the repo. Build settings come from `netlify.toml`.
3. **CMS login (same as Bionic):** Netlify → Site → **Identity → Enable**. Registration: **Invite only**.
   Then **Identity → Services → Git Gateway → Enable**. Invite your email under **Identity → Invite users**.
4. Open the invite email → set password → you land on `/admin/`.

The Netlify build is a **test build** (`netlify.toml`): Netlify allows ~54,000 files per folder, so it builds
~51,000 of the ~239,000 product pages and the site is `noindex` (Google ignores it).
For production with all products use AWS S3 + CloudFront or an own server and run `./build.sh` (see 6).

## 3. What you can edit in the CMS (`/admin/`)
| CMS section | What | File(s) |
| --- | --- | --- |
| Pages | Home (all texts), About, Brands intro, Contact, Get a Quote, Sign in/up, Thank you, 4 policies | `content/*.md` |
| Shared sections | Feature strip, numbers, values, benefits, specialities, featured brands | `data/content.yaml` |
| Catalog · Categories | 16 categories + 251 sub-categories: name, description, image, icon, order. Add new ones too | `data/categories/*.yaml` |
| Catalog · Brands | 277 brands: name, logo, description. Add new brands | `content/brand/*.md` |
| Catalog · Products | **Add a new product**, or **edit an existing one** (price, weight, sizes, description, image, PDF, hide) | `content/product/*.md` |
| Settings | Phone, email, offices, logo, menus | `config/_default/params.yaml`, `menus.yaml` |

**Edit an existing product:** open `/admin/` once in your browser (this unlocks editor links), then open any product
page on the site and click **“✎ Edit this product in CMS”**. The CMS opens with all current data filled in →
change price / weight / text → **Publish**. Netlify rebuilds in a few minutes.
A product saved in the CMS always wins over the bulk data. **Hide this product** removes it from the site.

**Price:** leave empty → page shows “Get a Quote”. Filled → shows “₹ … excl. GST”.

## 3b. Search, brand lists, currency, SEO
- **Search** `/search?q=` (header icon + home search box): part number (prefix), brand and category. Index: `static/search/` (built by the script below).
- **Brand pages** list all products of that brand (search + pages). Lists: `static/data/brand/<slug>.json`.
- **Sub-category pages** list all products (search, brand filter, pages). Lists are made by Hugo (`data/list/...`).
- **Currency switch** INR / USD in the top bar. Rate: CMS → Settings → USD rate.
- **SEO**: product titles like the old site (`BRAND - PART | Sub-category | d × D × B mm`), generated meta descriptions,
  JSON-LD (Product, BreadcrumbList, Organization), sitemap index. Logic: `layouts/_partials/seo.html`.
- Products added in the CMS appear on their page, category list and sitemap at once; in **search and brand lists**
  only after the next run of `build_products.py` (step 4).

## 4. Bulk product updates (Excel)
For changes to hundreds/thousands of products use the admin export (Excel) instead of the CMS:
```bash
# 1. Admin panel → Manage Products → Advance Search → Range 1–4000 → Export (repeat per range), put the .xlsx files in exports/
python3 scripts/merge_export.py exports/ products_export.csv
# 2. Rebuild product data, product sitemaps, search index and brand lists
#    (old URLs are kept via data/catalog/product-slugs.json = 233,557 slugs crawled from the old site)
python3 scripts/build_products.py products_export.csv . data/catalog/product-slugs.json
# add --include-hidden to also publish the 5,210 admin products that were not visible on the old site
```
Writes: `data/products/*.json`, `static/sitemaps/`, `static/search/`, `static/data/brand/`, `data/brandcounts.json`.

### Old-site extras and redirects
- `data/catalog/old-site-extra.json`: 5,214 products that are live on the old site and in its sitemap but not in its category/brand lists.
  They get a page, sitemap entry and search entry, but are not shown in category/brand lists (field `unlisted: true`, same as the old site).
- `data/catalog/redirects.json`: 336 old URLs that the old site redirected to another product (duplicates, e.g. `…-1` → `…`).
  No page is built for them. Netlify: 301 rules in `static/_redirects` (written by `build_products.py`); other hosts: Hugo alias redirect pages; locally: the 404 page redirects.

## 5. URLs (same as the old site)
| Page | URL | Source |
| --- | --- | --- |
| Static pages | `/`, `/about-us`, `/brands`, `/contact-us`, `/getQuote`, `/signin`, `/signup`, `/terms-and-condition`, `/privacy-policy`, `/return-policy`, `/cookies-policy` | `content/*.md` |
| Categories | `/products/category/<cat>`, `/products/category/<cat>/<sub>` | `content/products/_content.gotmpl` + `data/categories/` |
| Brands | `/brand/<slug>` | `content/brand/*.md` |
| Products | `/product/<slug>` | `content/product/_content.gotmpl` + `data/products/*.json` + CMS files |
| Product quote | `/getQuote/<slug>` → quote form with product pre-filled | `static/_redirects` |
| Sitemaps | `/sitemap.xml` (index) → `sitemap-pages.xml` + `sitemaps/products-N.xml` | |

Hugo writes `about-us.html` (`uglyURLs`); `static/_redirects` serves it at `/about-us`. Full old ↔ new list: `vwimpex-url-list.csv`.

## 6. Production build (all products)
Hugo keeps every page in memory (~240k pages need >8 GB), so `build.sh` builds in chunks via `HUGO_PRODUCTS`:
```bash
./build.sh        # ~15 min, ~3.5 GB in public/
```
`HUGO_PRODUCTS`: `sample` (default) · `none` · `all` · `ball-bearings@0-33000,gearbox` (categories / index ranges).

## 7. Where things are
- Styles `assets/css/` · JS `assets/js/main.js` (menu, brand filter, product list, quote pre-fill, editor links)
- Icons `data/icons.yaml` (one SVG sprite) · Templates `layouts/`
- Not static (stays on the old backend for now): cart, checkout, login. Sign in / Sign up forms post to `shopURL` (client decision pending).
