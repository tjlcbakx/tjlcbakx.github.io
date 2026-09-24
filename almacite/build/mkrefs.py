import json,re,textwrap
h=json.load(open('harvested.json'))

def clean(e,newkey):
    """Re-key a bibtex entry, leave every field untouched."""
    return re.sub(r'^(@\w+\s*\{\s*)[^,\n]+', lambda m: m.group(1)+newkey, e, count=1)

LOCAL={ # bibcode -> desired key
 '2008SPIE.7020E..1BC':'Claude2008','2014ITTST...4..201K':'Kerr2014',
 '2014PASJ...66...57A':'Asayama2014','2018A&A...611A..98B':'Belitsky2018',
 '2004stt..conf..181E':'Ediss2004','2004stt..conf...55K':'Kerr2004',
 '2012ITTST...2...29M':'Mahieu2012','2008stt..conf..253S':'Sekimoto2008',
 '2015A&A...577A.129B':'Baryshev2015','2013PhyC..494..189U':'Uzawa2013',
 '2006stt..conf..154C':'Claude2006',
}
out={}
for bc,key in LOCAL.items():
    out[key]={'bib':clean(h[bc]['bib'].strip(),key),'bibcode':bc,
              'src':'ADS export, harvested from '+h[bc]['src'].split('Dropbox/')[1]}

# Fetched by DOI (content negotiation, doi.org -> Crossref) 2026-09-08.
FETCHED={
'Yagoubov2020':('2020A&A...634A..46Y','10.1051/0004-6361/201936777',
 r'''@article{Yagoubov2020, title="{Wideband 67-116 GHz receiver development for ALMA Band 2}", volume={634}, ISSN={1432-0746}, DOI={10.1051/0004-6361/201936777}, journal={\aap}, publisher={EDP Sciences}, author={Yagoubov, P. and Mroczkowski, T. and Belitsky, V. and Cuadrado-Calle, D. and Cuttaia, F. and Fuller, G. A. and Gallego, J.-D. and Gonzalez, A. and Kaneko, K. and Mena, P. and Molina, R. and Nesti, R. and Tapia, V. and Villa, F. and Beltr\'an, M. and Cavaliere, F. and Ceru, J. and Chesmore, G. E. and Coughlin, K. and De Breuck, C. and Fredrixon, M. and George, D. and Gibson, H. and Golec, J. and Josaitis, A. and Kemper, F. and Kotiranta, M. and Lapkin, I. and L\'opez-Fern\'andez, I. and Marconi, G. and Mariotti, S. and McGenn, W. and McMahon, J. and Murk, A. and Pezzotta, F. and Phillips, N. and Reyes, N. and Ricciardi, S. and Sandri, M. and Strandberg, M. and Terenzi, L. and Testi, L. and Thomas, B. and Uzawa, Y. and Vigan\`o, D. and Wadefalk, N.}, year={2020}, month={Feb}, pages={A46} }'''),
'Huang2022':('2022SPIE12190E..0KH','10.1117/12.2629766',
 r'''@inproceedings{Huang2022, title="{ALMA Band-1 receiver: first light, performance, and road to completion}", DOI={10.1117/12.2629766}, booktitle={Millimeter, Submillimeter, and Far-Infrared Detectors and Instrumentation for Astronomy XI}, series={Proc. SPIE}, volume={12190}, publisher={SPIE}, author={Huang, Yau De and Hwang, Yuh-Jing and Chiong, Chau-Ching and Yen, Hsi-Wei and Koch, Patrick M. and Huang, Chi-Den and Liu, Bill and Chen, Cheng Lin and Tsai, Jwu Jiunn and Hsiung, Wei-Ling and Chi, Li-Pin and Ho, Chin-Ting and Wang, Chao-Chin and Chien, Chen and Chu, You-Hua and Ho, Paul and Kemper, Francisca and Gonzalez, Alvaro and Iguchi, Satoru and Uzawa, Yoshi and Iono, Daisuke and Nagai, Hiroshi and Effland, John and Saini, Kamaljeet and Pospieszalski, Marian and Henke, Doug and Yeung, Keith K. and Finger, Ricardo and Tapia, Valeria and Reyes, Nicolas and Siringo, Giorgio and Marconi, Gianni and Cabezas, Rodrigo}, editor={Zmuidzinas, Jonas and Gao, Jian-Rong}, year={2022}, month={Sep}, pages={121900K} }'''),
'Bryerton2013':(None,'10.1109/MWSYM.2013.6697622',
 r'''@inproceedings{Bryerton2013, title="{Low-noise sub-millimeter wave local oscillators for ALMA}", DOI={10.1109/MWSYM.2013.6697622}, booktitle={2013 IEEE MTT-S International Microwave Symposium Digest (MTT)}, publisher={IEEE}, author={Bryerton, Eric and Saini, Kamaljeet and Muehlberg, Jim and Vaselaar, Dustin and Thacker, Dorsey}, year={2013}, month={Jun}, pages={1--3} }'''),
}
def fmt(bib):
    """Re-lay-out a flat one-line BibTeX entry into the ADS field-per-line style.
    Splits only at top-level commas, so braces and quotes inside values survive."""
    import re
    m=re.match(r'\s*@(\w+)\s*\{\s*([^,]+),(.*)\}\s*$', bib.strip(), re.S)
    if not m: return bib.strip()
    typ,key,body = m.group(1),m.group(2).strip(),m.group(3)
    fields,buf,d,q = [],'',0,False
    for ch in body:
        if ch=='"' and d==0: q=not q
        if ch=='{': d+=1
        elif ch=='}': d-=1
        if ch==',' and d==0 and not q:
            fields.append(buf); buf=''
        else: buf+=ch
    if buf.strip(): fields.append(buf)
    out=[f'@{typ}{{{key},']
    for f in fields:
        f=f.strip()
        if not f: continue
        k,_,v = f.partition('=')
        out.append(f'{k.strip():>13} = {v.strip()},')
    out[-1]=out[-1].rstrip(',')
    out.append('}')
    return '\n'.join(out)

for k,(bc,doi,bib) in FETCHED.items():
    out[k]={'bib':fmt(bib),'bibcode':bc,'doi':doi,
            'src':f'doi.org content negotiation ({doi}), fetched 2026-09-08'}

json.dump(out,open('refs.json','w'),indent=1)
print(f'{len(out)} verified entries:')
for k in sorted(out): print('  ',k, '|', out[k]['bibcode'] or out[k].get('doi'))
