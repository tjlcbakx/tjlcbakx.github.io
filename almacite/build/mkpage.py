import json
refs=json.load(open('refs.json'))
# The page never renders provenance, and refs.json's `src` fields name the local
# .bib paths each entry came from. That is a build record for this machine, not
# something to inline into a public page, so it is dropped here.
for r in refs.values(): r.pop('src',None)

# ---- authoritative structure, ALMA Memo 627 Table 1 ---------------------
BANDS=[
 (1,"35-50","Huang2022",["Huang2022"],True),
 (2,"67-116","Yagoubov2020",["Yagoubov2020"],True),
 (3,"84-116","Claude2008",["Claude2008"],False),
 (4,"125-163","Asayama2014",["Asayama2014"],False),
 (5,"163-211","Belitsky2018",["Belitsky2018"],False),
 (6,"211-275","Ediss2004",["Ediss2004","Kerr2004"],False),
 (7,"275-373","Mahieu2012",["Mahieu2012"],False),
 (8,"385-500","Sekimoto2008",["Sekimoto2008"],False),
 (9,"602-720","Baryshev2015",["Baryshev2015"],False),
 (10,"787-950","Uzawa2013",["Uzawa2013"],False),
]
META={ # key -> (authors, year, memo citation count, link)
 "Bryerton2013":("Bryerton et al.","2013",6,"http://ieeexplore.ieee.org/stamp/stamp.jsp?tp=&arnumber=6697622"),
 "Huang2022":("Huang et al.","2022",1,"https://ui.adsabs.harvard.edu/abs/2022SPIE12190E..0KH/abstract"),
 "Yagoubov2020":("Yagoubov et al.","2020",24,"https://ui.adsabs.harvard.edu/abs/2020A%26A...634A..46Y/abstract"),
 "Claude2008":("Claude et al.","2008",10,"https://ui.adsabs.harvard.edu/abs/2008SPIE.7020E..1BC/abstract"),
 "Kerr2014":("Kerr et al.","2014",31,"https://ui.adsabs.harvard.edu/abs/2014ITTST...4..201K/abstract"),
 "Asayama2014":("Asayama et al.","2014",20,"https://ui.adsabs.harvard.edu/abs/2014PASJ...66...57A/abstract"),
 "Belitsky2018":("Belitsky et al.","2018",18,"https://ui.adsabs.harvard.edu/abs/2018A%26A...611A..98B/abstract"),
 "Ediss2004":("Ediss et al.","2004",15,"https://ui.adsabs.harvard.edu/abs/2004stt..conf..181E/abstract"),
 "Kerr2004":("Kerr et al.","2004",9,"http://www.nrao.edu/meetings/isstt/papers/2004/2004055061.pdf"),
 "Mahieu2012":("Mahieu et al.","2012",17,"https://ui.adsabs.harvard.edu/abs/2012ITTST...2...29M/abstract"),
 "Sekimoto2008":("Sekimoto et al.","2008",16,"https://ui.adsabs.harvard.edu/abs/2008stt..conf..253S/abstract"),
 "Baryshev2015":("Baryshev et al.","2015",52,"https://ui.adsabs.harvard.edu/abs/2015A%26A...577A.129B/abstract"),
 "Uzawa2013":("Uzawa et al.","2013",13,"https://ui.adsabs.harvard.edu/abs/2013PhyC..494..189U/abstract"),
 "Claude2006":("Claude et al.","2006",10,"https://ui.adsabs.harvard.edu/abs/2006stt..conf..154C/abstract"),
}
# Memo Table 2, verbatim. bib=None -> link only, no BibTeX shipped.
APPENDIX=[
 ("all","Effland et al. 2013","General North-American receiver papers",0,None,"http://ieeexplore.ieee.org/stamp/stamp.jsp?tp=&arnumber=6697565"),
 ("all","Kerr et al. 2013","North-American SIS mixers",4,None,"http://ieeexplore.ieee.org/stamp/stamp.jsp?tp=&arnumber=6697439"),
 ("3","Pan et al. 2004","Additional Band 3 receiver paper",9,None,"http://www.nrao.edu/meetings/isstt/papers/2004/2004062069.pdf"),
 ("3","Claude et al. 2006","Additional Band 3 receiver paper",10,"Claude2006","https://ui.adsabs.harvard.edu/abs/2006stt..conf..154C/abstract"),
 ("3","Claude et al. 2005","Additional Band 3 receiver paper",6,None,"http://ieeexplore.ieee.org/stamp/stamp.jsp?tp=&arnumber=1572585"),
 ("3","Dindo et al. 2005","Additional Band 3 receiver paper",5,None,"http://ieeexplore.ieee.org/stamp/stamp.jsp?tp=&arnumber=1572586"),
 ("3","Chin et al. 2004","Additional Band 3 side-band receiver paper",9,None,"https://link.springer.com/article/10.1023/B:IJIM.0000020748.89086.e9"),
 ("5","Billade et al. 2012","Additional Band 5 receiver",35,None,"https://ui.adsabs.harvard.edu/abs/2012ITTST...2..208B/abstract"),
 ("7","Maier et al. 2005","Additional Band 7 receiver paper",15,None,"https://ui.adsabs.harvard.edu/abs/2005stt..conf..428M/abstract"),
 ("7","Mahieu et al. 2005","Additional Band 7 receiver paper",10,None,"https://ui.adsabs.harvard.edu/abs/2005stt..conf...99M/abstract"),
 ("8","Shan et al. 2005","Additional Band 8 receiver paper",15,None,"https://ui.adsabs.harvard.edu/abs/2005ITAS...15..503S/abstract"),
 ("8","Sekimoto et al. 2009","Additional Band 8 receiver paper",2,None,"https://ui.adsabs.harvard.edu/abs/2009stt..conf....6S/abstract"),
 ("8","Tamura et al. 2014","Additional Band 8 receiver paper",5,None,"http://ieeexplore.ieee.org/stamp/stamp.jsp?tp=&arnumber=6945347"),
 ("9","Baryshev et al. 2007","Additional Band 9 receiver paper",4,None,"https://ui.adsabs.harvard.edu/abs/2007stt..conf..164B/abstract"),
 ("9","Mena et al. 2008","Additional Band 9 receiver paper",3,None,"https://ui.adsabs.harvard.edu/abs/2008stt..conf...90M/abstract"),
 ("9","Baryshev et al. 2008","Additional Band 9 receiver paper",1,None,"https://ui.adsabs.harvard.edu/abs/2008stt..conf..258B/abstract"),
 ("9","Hesper et al. 2018","Additional Band 9 receiver paper",None,None,"http://www.nrao.edu/meetings/isstt/papers/2018/2018098103.pdf"),
 ("10","Gonzalez et al. 2014","Additional Band 10 paper (summary of production)",6,None,"https://ui.adsabs.harvard.edu/abs/2014SPIE.9153E..0NG/abstract"),
 ("10","Uzawa et al. 2009","Additional Band 10 receiver paper",2,None,"https://ui.adsabs.harvard.edu/abs/2009stt..conf...12U/abstract"),
 ("10","Fujii et al. 2011","Additional Band 10 receiver paper",13,None,"https://ui.adsabs.harvard.edu/abs/2011ITAS...21..606F/abstract"),
 ("10","Fujii et al. 2013","Additional Band 10 receiver paper",26,None,"http://ieeexplore.ieee.org/stamp/stamp.jsp?tp=&arnumber=6423869"),
]
DATA={"refs":refs,"bands":BANDS,"meta":META,"appendix":APPENDIX}
open('data.json','w').write(json.dumps(DATA,indent=None))
print('data.json',len(json.dumps(DATA)),'bytes')
