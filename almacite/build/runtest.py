import subprocess,tempfile,os,re,json
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
page=os.path.join(os.path.dirname(os.path.abspath(__file__)),os.pardir,'index.html')
html=open(page,encoding='utf-8').read()
test=open('test.js',encoding='utf-8').read()
# inject the test into a copy of the page so it runs in the same document
inj=html.replace('</body>', '<script>\n'+test+'\n</script>\n</body>')
d=tempfile.mkdtemp()
p=os.path.join(d,'t.html'); open(p,'w',encoding='utf-8').write(inj)
r=subprocess.run([CHROME,'--headless=new','--disable-gpu','--no-sandbox','--mute-audio',
   '--virtual-time-budget=4000','--dump-dom','--enable-logging=stderr','--v=0',
   'file://'+p],capture_output=True,text=True,timeout=120)
log=r.stderr
for line in log.splitlines():
    if 'CONSOLE' in line or 'ERROR' in line.upper():
        print(line[:4000])
