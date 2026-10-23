#!/usr/bin/env python3
"""Rights-gated local crawler for approved automotive document sources.

It never authenticates, solves a CAPTCHA, bypasses access controls, or changes source status.
"""
from __future__ import annotations

import argparse, hashlib, json, logging, re, sqlite3, sys, time
from dataclasses import dataclass
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from typing import Iterable
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlparse, urldefrag
from urllib.request import Request, urlopen
from urllib.robotparser import RobotFileParser

ROOT=Path(__file__).resolve().parents[1]
REGISTRY=ROOT/'mvp'/'data'/'source-registry.json'
STATE=ROOT/'acquisition'/'state.sqlite3'
DOWNLOADS=ROOT/'acquisition'/'downloads'
USER_AGENT='GarageAtlasAcquisition/0.1 (+local rights-gated crawler)'
ALLOWED_MIME={'application/pdf':'pdf','image/svg+xml':'svg','image/png':'png','image/jpeg':'jpg'}
MAX_BYTES=40*1024*1024

class LinkParser(HTMLParser):
    def __init__(self): super().__init__(); self.links=[]
    def handle_starttag(self, tag, attrs):
        if tag=='a':
            href=dict(attrs).get('href')
            if href: self.links.append(href)

def now(): return datetime.now(timezone.utc).isoformat()
def db():
    con=sqlite3.connect(STATE); con.row_factory=sqlite3.Row
    con.executescript('''create table if not exists jobs(id integer primary key, source_key text, status text, started_at text, finished_at text, message text);
    create table if not exists seen(url text primary key, source_key text, depth integer, state text, discovered_at text, fetched_at text, error text);
    create table if not exists documents(sha256 text primary key, source_key text, source_url text, local_path text, mime_type text, byte_size integer, acquired_at text, metadata_json text);''')
    return con

def load_source(key):
    entries=json.loads(REGISTRY.read_text(encoding='utf-8'))['sources']
    source=next((x for x in entries if x['id']==key),None)
    if not source: raise ValueError(f'Unknown source: {key}')
    return source

def preflight(source):
    required=source.get('status')=='APPROVED' and source.get('crawl_enabled') and source.get('storage_allowed') and source.get('redistribution_allowed')
    if not required: raise PermissionError(f"Source {source['id']} is {source['status']}; crawl requires APPROVED + crawl/storage/redistribution permission.")
    if not source.get('base_url') or not source.get('robots_url') or not source.get('terms_url'): raise PermissionError('Missing base URL, robots URL or terms URL.')
    rp=RobotFileParser(); rp.set_url(source['robots_url']); rp.read()
    return rp

def is_allowed(source, url):
    base=urlparse(source['base_url']); target=urlparse(url)
    return target.scheme=='https' and target.netloc==base.netloc and any(target.path.startswith(p) for p in source.get('allowed_path_prefixes',[]))

def request(url): return urlopen(Request(url,headers={'User-Agent':USER_AGENT,'Accept':'text/html,application/pdf,image/*;q=0.9'}),timeout=25)
def fetch(url, retries=3):
    error=None
    for attempt in range(retries):
        try: return request(url)
        except HTTPError as exc:
            if exc.code in {401,403,407,429}: raise PermissionError(f'Access control or rate limit at {url}: HTTP {exc.code}') from exc
            error=exc
        except URLError as exc: error=exc
        time.sleep(2**attempt)
    raise RuntimeError(f'Fetch failed for {url}: {error}')

def signature_mime(data, declared):
    prefix=data[:1024].lstrip().lower()
    actual='application/pdf' if data.startswith(b'%PDF-') else 'image/png' if data.startswith(b'\x89PNG\r\n\x1a\n') else 'image/jpeg' if data.startswith(b'\xff\xd8\xff') else 'image/svg+xml' if b'<svg' in prefix else None
    if actual not in ALLOWED_MIME or (declared and declared not in ALLOWED_MIME): raise ValueError('Unsupported or MIME/signature mismatch.')
    return actual

def classify(url, data, mime):
    text=(url+' '+data[:8192].decode('utf-8','ignore')).lower()
    makers=[name for name in ['toyota','ford','kia','vinfast','honda','hyundai'] if re.search(rf'\b{name}\b',text)]
    years=sorted({int(x) for x in re.findall(r'\b(?:19|20)\d{2}\b',text)})
    types=[label for label,terms in {'EWD':['ewd','wiring diagram','electrical diagram'],'Service Manual':['service manual'],'Repair Manual':['repair manual'],'DTC':['dtc','diagnostic trouble code'],'ECU Pinout':['ecu pinout'],'Fuse Diagram':['fuse diagram'],'TSB':['technical service bulletin','tsb']}.items() if any(term in text for term in terms)]
    lang='vi' if any(token in text for token in ['sơ đồ','hướng dẫn','động cơ']) else 'en' if re.search(r'\b(the|service|vehicle)\b',text) else None
    return {'manufacturer':makers[0] if len(makers)==1 else None,'year_from':years[0] if years else None,'year_to':years[-1] if years else None,'document_type':types[0] if len(types)==1 else None,'language':lang,'page_count':data.count(b'/Type /Page') if mime=='application/pdf' else None,'needs_admin_review':not bool(makers or years or types)}

def save_document(con, source, url, response):
    declared=response.headers.get_content_type(); data=bytearray()
    while chunk:=response.read(65536):
        data.extend(chunk)
        if len(data)>MAX_BYTES: raise ValueError('Document exceeds byte limit.')
    payload=bytes(data); mime=signature_mime(payload,declared); digest=hashlib.sha256(payload).hexdigest()
    existing=con.execute('select local_path from documents where sha256=?',(digest,)).fetchone()
    if existing: return 'duplicate',digest
    path=DOWNLOADS/source['id']; path.mkdir(parents=True,exist_ok=True); file_path=path/f'{digest}.{ALLOWED_MIME[mime]}'; file_path.write_bytes(payload)
    metadata=classify(url,payload,mime)
    con.execute('insert into documents values(?,?,?,?,?,?,?,?)',(digest,source['id'],url,str(file_path.relative_to(ROOT)),mime,len(payload),now(),json.dumps(metadata)))
    return 'stored',digest

def crawl(source, max_pages, max_depth, resume, pause_file):
    robots=preflight(source); con=db(); job=con.execute('insert into jobs(source_key,status,started_at,message) values(?,?,?,?)',(source['id'],'running',now(),'')).lastrowid; con.commit()
    queue=[(source['base_url'],0)] if not resume else [(r['url'],r['depth']) for r in con.execute("select url,depth from seen where source_key=? and state='queued'",(source['id'],))]
    count=0
    try:
        while queue and count<max_pages:
            if pause_file and Path(pause_file).exists(): raise InterruptedError('Pause file detected.')
            url,depth=queue.pop(0); url=urldefrag(url).url
            if not is_allowed(source,url) or not robots.can_fetch(USER_AGENT,url): continue
            prior=con.execute('select state from seen where url=?',(url,)).fetchone()
            if prior and prior['state']=='done': continue
            con.execute('insert or replace into seen(url,source_key,depth,state,discovered_at) values(?,?,?,?,?)',(url,source['id'],depth,'queued',now())); con.commit()
            time.sleep(1); response=fetch(url); content_type=response.headers.get_content_type()
            if content_type in ALLOWED_MIME or url.lower().split('?')[0].endswith(('.pdf','.svg','.png','.jpg','.jpeg')):
                result,digest=save_document(con,source,url,response); logging.info('%s %s %s',result,digest,url)
            else:
                page=response.read(2*1024*1024).decode(response.headers.get_content_charset() or 'utf-8','ignore'); parser=LinkParser(); parser.feed(page)
                if depth<max_depth:
                    for href in parser.links:
                        child=urljoin(url,href)
                        if is_allowed(source,child): queue.append((child,depth+1))
            con.execute("update seen set state='done',fetched_at=? where url=?",(now(),url)); con.commit(); count+=1
        con.execute('update jobs set status=?,finished_at=?,message=? where id=?',('completed',now(),f'processed {count}',job)); con.commit()
    except InterruptedError as exc:
        con.execute('update jobs set status=?,finished_at=?,message=? where id=?',('paused',now(),str(exc),job)); con.commit(); logging.warning('%s',exc)
    except Exception as exc:
        con.execute('update jobs set status=?,finished_at=?,message=? where id=?',('failed',now(),str(exc),job)); con.commit(); raise
    finally: con.close()

def main():
    parser=argparse.ArgumentParser(); parser.add_argument('--source',required=True); parser.add_argument('--max-pages',type=int,default=25); parser.add_argument('--max-depth',type=int,default=1); parser.add_argument('--resume',action='store_true'); parser.add_argument('--pause-file'); args=parser.parse_args()
    logging.basicConfig(level=logging.INFO,format='%(levelname)s %(message)s')
    crawl(load_source(args.source),args.max_pages,args.max_depth,args.resume,args.pause_file)
if __name__=='__main__':
    try: main()
    except Exception as exc: logging.error('%s',exc); sys.exit(2)
