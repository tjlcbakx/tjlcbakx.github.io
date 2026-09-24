// Exercise the real page in a real browser: tick bands, read the outputs back.
const CASES=[
 {bands:[4],       fmt:'latex'},
 {bands:[4,6],     fmt:'latex'},
 {bands:[3,6],     fmt:'plain'},
 {bands:[2],       fmt:'latex'},
 {bands:[1,2],     fmt:'plain'},
 {bands:[1,2,3,4,5,6,7,8,9,10], fmt:'latex'},
];
function run(){
  const errs=[]; const out=[];
  const grid=document.querySelector('#bands');
  for(const c of CASES){
    grid.querySelectorAll('input').forEach(i=>i.checked=c.bands.includes(+i.value));
    document.querySelector(`input[name=fmt][value=${c.fmt}]`).checked=true;
    grid.dispatchEvent(new Event('change',{bubbles:true}));
    const sen=document.querySelector('#sentence').textContent;
    const bib=document.querySelector('#bibtex').textContent;
    const notes=[...document.querySelectorAll('#notes .note')].map(n=>n.textContent.trim().slice(0,60));
    const nEntries=(bib.match(/^@/gm)||[]).length;
    const keys=[...bib.matchAll(/^@\w+\{([^,]+),/gm)].map(m=>m[1]);
    out.push({...c, sen, nEntries, keys, notes:notes.length});
    // invariants
    if(!sen) errs.push(`[${c.bands}] empty sentence`);
    if(!nEntries) errs.push(`[${c.bands}] no bibtex`);
    if(/undefined|NaN|\[object/.test(sen+bib)) errs.push(`[${c.bands}] junk in output`);
    // a citation must never sit directly against its subject with no "by"
    if(/(?:mixers|system) (?:\\cite|[A-Z][a-z]+ et al)/.test(sen))
      errs.push(`[${c.bands}] missing "by" before citation`);
    if(/ (?:is|are) described(?! by)/.test(sen))
      errs.push(`[${c.bands}] "described" not followed by "by"`);
    // every \citep key must exist as a bibtex entry
    if(c.fmt==='latex'){
      const cited=new Set();
      [...sen.matchAll(/\\cite[pt]\{([^}]+)\}/g)].forEach(m=>m[1].split(',').forEach(k=>cited.add(k.trim())));
      for(const k of cited) if(!keys.includes(k)) errs.push(`[${c.bands}] cited ${k} but no bibtex entry`);
      for(const k of keys) if(!cited.has(k)) errs.push(`[${c.bands}] bibtex ${k} never cited`);
    }
    // LO rule: Bryerton present iff some band != 2
    const wantLO=c.bands.some(b=>b!==2);
    if(wantLO !== keys.includes('Bryerton2013')) errs.push(`[${c.bands}] LO rule violated`);
    // Kerr2014 iff band 3 or 6
    const wantK=c.bands.some(b=>b===3||b===6);
    if(wantK !== keys.includes('Kerr2014')) errs.push(`[${c.bands}] Kerr2014 rule violated`);
    // preliminary note iff band 1 or 2
    const wantP=c.bands.some(b=>b===1||b===2);
    if(wantP && notes.length===0) errs.push(`[${c.bands}] missing preliminary note`);
  }
  // duplicate bibtex keys anywhere?
  return {errs,out};
}
const r=run();
r.out.forEach(o=>{console.log('### bands='+o.bands.join(',')+' fmt='+o.fmt+' entries='+o.nEntries+' notes='+o.notes);console.log('    '+o.sen);});
console.log(r.errs.length? 'FAIL '+r.errs.length : 'ALL CHECKS PASS');
