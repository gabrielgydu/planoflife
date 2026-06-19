#!/usr/bin/env python3
"""Print top Commons file results in RELEVANCE order for targeted queries,
so we can hand-pick exact masterpiece filenames."""
import json, sys, urllib.parse, urllib.request, time
UA = "planoflife-rosary-image-fetch/1.0 (https://github.com/; gbrl.schutz@gmail.com)"
API = "https://commons.wikimedia.org/w/api.php"

QUERIES = [
    "El Greco Pentecost Prado",
    "Tiziano Assunta Frari Assumption Virgin",
    "Verrocchio Leonardo Baptism of Christ Uffizi",
    "Juan de Juanes Santa Cena Last Supper Prado",
    "Mariotto Albertinelli Visitation Uffizi",
    "Carl Heinrich Bloch Resurrection",
    "Piero della Francesca Resurrection Sansepolcro",
    "Cosimo Rosselli Sermon on the Mount Sistine",
    "Gerard David Marriage at Cana Louvre",
    "Fra Angelico Annunciation Prado",
]
def get(q):
    p = {"action":"query","format":"json","generator":"search","gsrnamespace":6,
         "gsrlimit":6,"gsrsearch":q,"prop":"imageinfo","iiprop":"url|size|mime"}
    url = API+"?"+urllib.parse.urlencode(p)
    req = urllib.request.Request(url, headers={"User-Agent":UA})
    d = json.load(urllib.request.urlopen(req, timeout=30))
    pages = d.get("query",{}).get("pages",{})
    # keep search index order
    rows = sorted(pages.values(), key=lambda x: x.get("index",99))
    return rows

for q in QUERIES:
    print(f"\n## {q}")
    for p in get(q):
        ii=(p.get("imageinfo") or [{}])[0]
        print(f"   {ii.get('width')}x{ii.get('height')} {ii.get('mime')}  {p.get('title')}")
    time.sleep(0.25)
