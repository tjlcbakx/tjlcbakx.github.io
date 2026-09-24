#!/bin/sh
# Regenerate ../index.html from the verified reference data. Run from this folder.
# Fails loudly rather than silently leaving a stale page.
set -e
[ -f harvested.json ] || python3 harvest.py   # rescan ~/Dropbox/**/*.bib if absent
python3 mkrefs.py                             # refs.json — verified BibTeX only
python3 mkpage.py                             # data.json — + Memo 627 Tables 1 & 2
python3 - <<'PY'
tpl=open('page.tpl.html',encoding='utf-8').read(); data=open('data.json').read()
assert tpl.count('/*__DATA__*/')==1, 'template lost its data placeholder'
open('../index.html','w',encoding='utf-8').write(tpl.replace('/*__DATA__*/',data))
print('wrote ../index.html')
PY
python3 runtest.py 2>&1 | grep -E "CONSOLE" | sed 's/.*CONSOLE:[0-9]*\] //;s/, source: file.*//;s/^"//;s/"$//'
