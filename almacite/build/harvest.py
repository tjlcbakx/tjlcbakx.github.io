import re,glob,os,json,collections

ROOT=os.path.expanduser('~/Dropbox')
AUTH=['Yagoubov','Belitsky','Asayama','Bryerton','Ediss','Mahieu','Sekimoto',
      'Baryshev','Uzawa','Billade','Claude','Huang','Kerr','Effland','Pan',
      'Dindo','Chin','Maier','Shan','Tamura','Mena','Hesper','Gonzalez','Fujii']

def entries(txt):
    """Split a .bib into top-level @entries by brace balance."""
    out=[]
    for m in re.finditer(r'@\w+\s*\{', txt):
        i=m.end()-1; d=0
        for j in range(i,len(txt)):
            if txt[j]=='{': d+=1
            elif txt[j]=='}':
                d-=1
                if d==0:
                    out.append(txt[m.start():j+1]); break
    return out

found={}
nfiles=0
for p in glob.glob(os.path.join(ROOT,'**','*.bib'),recursive=True):
    try: txt=open(p,encoding='utf-8',errors='replace').read()
    except Exception: continue
    if not txt.strip(): continue
    nfiles+=1
    for e in entries(txt):
        if not any(a in e for a in AUTH): continue
        bc=re.search(r'adsurl\s*=\s*\{[^}]*?/abs/([^}\s]+)\}',e,re.I)
        bc=bc.group(1).replace('%26','&') if bc else None
        km=re.match(r'@\w+\s*\{\s*([^,\n]+)',e)
        key=bc or (km.group(1).strip() if km else None)
        if not key: continue
        # prefer the longest version (most complete entry)
        if key not in found or len(e)>len(found[key][0]):
            found[key]=(e,p,bc)

# The bibcodes carried by ALMA Memo 627's own links (Tables 1 and 2).
WANT={'2022SPIE12190E..0KH','2020A&A...634A..46Y','2008SPIE.7020E..1BC',
 '2014ITTST...4..201K','2014PASJ...66...57A','2018A&A...611A..98B',
 '2004stt..conf..181E','2012ITTST...2...29M','2008stt..conf..253S',
 '2015A&A...577A.129B','2013PhyC..494..189U','2006stt..conf..154C',
 '2012ITTST...2..208B','2005stt..conf..428M','2005stt..conf...99M',
 '2005ITAS...15..503S','2009stt..conf....6S','2007stt..conf..164B',
 '2008stt..conf...90M','2008stt..conf..258B','2014SPIE.9153E..0NG',
 '2009stt..conf...12U','2011ITAS...21..606F',
 # Kerr et al. 2004: memo links .../2004055061.pdf, i.e. ISSTT XV pp. 55-61
 '2004stt..conf...55K'}
found={k:v for k,v in found.items() if k in WANT}
print(f'scanned {nfiles} non-empty .bib files; {len(found)} of {len(WANT)} wanted bibcodes found\n')
json.dump({k:{'bib':v[0],'src':v[1],'bibcode':v[2]} for k,v in found.items()},
          open('harvested.json','w'),indent=1)
for k,(e,p,bc) in sorted(found.items()):
    t=re.search(r'title\s*=\s*\{+(.+?)\}+,\s*$',e,re.M|re.S)
    t=' '.join(t.group(1).split())[:62] if t else '?'
    print(f'{(bc or k)[:30]:32s} {t}')
