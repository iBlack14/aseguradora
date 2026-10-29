"""Capture public presentation assets for the local consultation reference.
Run: python tools/capture-consulta.py (requires requests and beautifulsoup4).
The official query iframe remains external; no captcha or private API is copied.
"""
from pathlib import Path
from urllib.parse import urljoin, urlsplit, unquote
from concurrent.futures import ThreadPoolExecutor
import hashlib, json, re, time
import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / 'apps/consulta'
SOURCE = 'https://www.apeseg.org.pe/consultas-soat/'
ASSETS = APP / 'public/assets/apeseg'
ASSETS.mkdir(parents=True, exist_ok=True)
HEADERS = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'}
original = APP / 'reference/original.html'
if not original.exists():
    original.write_text(requests.get(SOURCE, headers=HEADERS, timeout=30).text, encoding='utf-8')
soup = BeautifulSoup(original.read_text(encoding='utf-8'), 'html.parser')
assets, failures, text_files = {}, [], {}
url_re = re.compile(r'url\(\s*([\'"]?)(.*?)\1\s*\)', re.I)
import_re = re.compile(r'(@import\s+)([\'"])(.*?)\2', re.I)

def register(raw, base=SOURCE):
    raw = raw.strip()
    if not raw or raw.startswith(('data:', '#', 'blob:', 'javascript:')): return raw
    url = urljoin(base, raw)
    if urlsplit(url).scheme not in ('http', 'https'): return raw
    if url not in assets:
        name = re.sub(r'[^a-zA-Z0-9._-]', '-', unquote(urlsplit(url).path.rsplit('/', 1)[-1])) or 'asset'
        if urlsplit(url).hostname == 'fonts.googleapis.com': name = 'google-fonts.css'
        digest = hashlib.sha256(url.encode()).hexdigest()[:10]
        assets[url] = f'/assets/apeseg/{digest}-{name}'
    return assets[url]

# Keep the original visual scripts but exclude analytics and speculative navigation.
for script in list(soup.find_all('script')):
    src = script.get('src', '')
    content = script.get_text()
    if any(word in src + content for word in ['googletagmanager', 'gtag(', 'hotjar', '_wpemojiSettings', 'wp-emoji-settings']) or script.get('type') == 'speculationrules' or script.get('id') == 'wp-emoji-settings':
        script.decompose()
    elif src:
        script['src'] = register(src)
for link in list(soup.find_all('link')):
    rel = link.get('rel', [])
    if 'stylesheet' in rel or 'icon' in rel or 'apple-touch-icon' in rel:
        link['href'] = register(link['href'])
    else:
        link.decompose()
for image in soup.find_all(['img', 'source']):
    for attr in ['src', 'data-src', 'data-lazy-src']:
        if image.get(attr): image[attr] = register(image[attr])
    for attr in ['srcset', 'data-srcset']:
        if image.get(attr):
            image[attr] = ', '.join(' '.join([register(part.strip().split()[0]), *part.strip().split()[1:]]) for part in image[attr].split(',') if part.strip())
for tag in soup.find_all(True):
    if tag.get('style'):
        tag['style'] = url_re.sub(lambda m: f'url("{register(m[2])}")', tag['style'])
    for attr in ['href', 'action']:
        if tag.name in ['a', 'form'] and tag.get(attr) and not tag[attr].startswith(('#', 'mailto:', 'tel:', 'javascript:')):
            url = urljoin(SOURCE, tag[attr])
            tag[attr] = '/' if url.rstrip('/') in [SOURCE.rstrip('/'), 'https://www.apeseg.org.pe/consulta-soat'] else url
for style in soup.find_all('style'):
    text = style.get_text()
    # Leave embedded SVG data URLs untouched.
    style.string = url_re.sub(lambda m: m[0] if m[2].startswith('data:') else f'url("{register(m[2])}")', text)
for frame in soup.find_all('iframe'):
    frame['src'] = '/consulta-interna.html'
    frame['title'] = 'Consulta del registro interno'
    frame['referrerpolicy'] = 'strict-origin-when-cross-origin'

pending, downloaded = set(assets), set()
def download(url):
    dest = APP / 'public' / assets[url].lstrip('/')
    # Cached CSS has rewritten URLs, so always fetch its original before recapturing.
    if dest.exists() and dest.suffix != '.css': return url, dest.read_bytes(), ''
    response = requests.get(url, headers=HEADERS, timeout=25)
    response.raise_for_status()
    dest.write_bytes(response.content)
    return url, response.content, response.headers.get('content-type', '')

with ThreadPoolExecutor(max_workers=8) as pool:
    while pending:
        batch = list(pending)
        pending.clear()
        futures = {pool.submit(download, url): url for url in batch}
        for future, url in futures.items():
            downloaded.add(url)
            try:
                _, data, content_type = future.result()
                if 'text/css' in content_type or urlsplit(url).path.endswith('.css') or 'fonts.googleapis.com' in url:
                    css = data.decode('utf-8-sig', errors='replace')
                    css = url_re.sub(lambda m: m[0] if m[2].startswith('data:') else f'url("{register(m[2], url)}")', css)
                    css = import_re.sub(lambda m: f'{m[1]}"{register(m[3], url)}"', css)
                    text_files[url] = css
            except Exception as error:
                failures.append({'url': url, 'error': str(error)})
        pending.update(set(assets) - downloaded)
        print(f'Captured {len(downloaded)} resources; {len(pending)} dependencies pending; {len(failures)} unavailable', flush=True)
for url, css in text_files.items():
    (APP / 'public' / assets[url].lstrip('/')).write_text(css, encoding='utf-8')
# An unavailable asset keeps its original URL, matching the source site's fallback behavior.
html = str(soup)
for failure in failures:
    html = html.replace(assets[failure['url']], failure['url'])
(APP / 'reference/page.html').write_text(html, encoding='utf-8')
(APP / 'reference/manifest.json').write_text(json.dumps({'source': SOURCE, 'capturedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'assets': assets, 'unavailable': failures, 'externalQuery': 'https://webapp.apeseg.org.pe/consulta-soat/?source=apeseg'}, indent=2, ensure_ascii=False), encoding='utf-8')
print(f'Finished: {len(assets) - len(failures)} downloaded; {len(failures)} unavailable.')
