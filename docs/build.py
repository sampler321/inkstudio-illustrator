# Render manual.html to A5, fill contents page numbers, impose 2-up on landscape A4.
import re, subprocess, os
from pypdf import PdfReader, PdfWriter, PageObject, Transformation
D=os.path.dirname(os.path.abspath(__file__)); H=D+'/'+os.environ.get('MANUAL','manual.html'); A5=D+'/a5.pdf'; OUT=os.environ.get('OUT',D+'/InkStudio-manual.pdf')
CH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
def render(): subprocess.run([CH,'--headless=new','--disable-gpu','--no-pdf-header-footer','--print-to-pdf='+A5,'file://'+H],capture_output=True)
def norm(s): return re.sub(r'\s+',' ',s.replace('&amp;','&')).strip().lower()
for _ in range(3):
  h=open(H).read()
  toc=re.search(r'<div class="toc">(.*?)\n</div>',h,re.S)
  names=[re.sub(r'<span class="pg">.*?</span>','',re.sub(r'^<div>|</div>$','',x.strip())) for x in toc.group(1).strip().split('\n')]
  names=[re.sub(r'<.*?>','',n) for n in names]
  render(); pages=[norm(subprocess.run(['pdftotext','-f',str(i+1),'-l',str(i+1),'-layout',A5,'-'],capture_output=True,text=True).stdout) for i in range(len(PdfReader(A5).pages))]
  lines=[[norm(l) for l in subprocess.run(['pdftotext','-f',str(i+1),'-l',str(i+1),A5,'-'],capture_output=True,text=True).stdout.split('\n')] for i in range(len(pages))]
  num={}
  for n in names:
    for i in range(1,len(lines)):
      if norm(n) in lines[i]: num[n]=i+1; break
    else:
      if sum(norm(n)==l for l in lines[0])>1: num[n]=1
  new='\n'+'\n'.join('  <div><span>%s</span><span class="pg">%s</span></div>'%(n.replace('&','&amp;'),num.get(n,'?')) for n in names)
  h2=h[:toc.start(1)]+new+h[toc.end(1):]
  if h2==h: break
  open(H,'w').write(h2)
missing=[n for n in names if n not in num]; print('pages',len(pages),'missing',missing)
r=PdfReader(A5); w=PdfWriter(); W,Hh=float(r.pages[0].mediabox.width),float(r.pages[0].mediabox.height)
ps=list(r.pages)
if len(ps)%2: ps.append(None)
for k in range(0,len(ps),2):
  sheet=PageObject.create_blank_page(width=2*W,height=Hh)
  for j,p in enumerate(ps[k:k+2]):
    if p is not None: sheet.merge_transformed_page(p,Transformation().translate(j*W,0))
  w.add_page(sheet)
w.write(OUT); print('sheets',len(w.pages))
