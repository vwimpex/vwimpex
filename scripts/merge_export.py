import sys, glob, csv, os, openpyxl
src, out = sys.argv[1], sys.argv[2]
rows = 0; header = None
with open(out, 'w', newline='', encoding='utf-8') as f:
    w = csv.writer(f)
    for p in sorted(glob.glob(os.path.join(src, '*.xlsx'))):
        wb = openpyxl.load_workbook(p, read_only=True, data_only=True)
        ws = wb.active
        for i, r in enumerate(ws.iter_rows(values_only=True)):
            if i == 0:
                if header is None:
                    header = [str(c).strip() for c in r]; w.writerow(header)
                continue
            if r is None or all(c is None for c in r): continue
            w.writerow(['' if c is None else str(c).strip() for c in r]); rows += 1
        wb.close()
print('rows', rows); print(header)
