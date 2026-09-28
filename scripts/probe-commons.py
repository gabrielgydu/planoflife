#!/usr/bin/env python3
"""Print top Commons file results in RELEVANCE order for targeted queries,
so we can hand-pick exact masterpiece filenames for fetch-rosary-images.py.

Usage: probe-commons.py "Mantegna Death of the Virgin Prado" "Maino Pentecost" ...
       (or one query per line on stdin)
"""
import json, sys, urllib.parse, urllib.request, time
UA = "planoflife-rosary-image-fetch/1.0 (https://github.com/; gbrl.schutz@gmail.com)"
API = "https://commons.wikimedia.org/w/api.php"
LIMIT = 8


def get(q):
    p = {"action": "query", "format": "json", "generator": "search", "gsrnamespace": 6,
         "gsrlimit": LIMIT, "gsrsearch": q, "prop": "imageinfo", "iiprop": "size|mime"}
    url = API + "?" + urllib.parse.urlencode(p)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    d = json.load(urllib.request.urlopen(req, timeout=30))
    pages = d.get("query", {}).get("pages", {})
    # keep search index order
    return sorted(pages.values(), key=lambda x: x.get("index", 99))


queries = sys.argv[1:] or [l.strip() for l in sys.stdin if l.strip()]
for q in queries:
    print(f"\n## {q}")
    for p in get(q):
        ii = (p.get("imageinfo") or [{}])[0]
        print(f"   {ii.get('width')}x{ii.get('height')} {ii.get('mime')}  {p.get('title')}")
    time.sleep(0.3)
