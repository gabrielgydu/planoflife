#!/usr/bin/env python3
"""Fetch curated, high-quality public-domain paintings for the 20 Rosary
mysteries from Wikimedia Commons into a local review folder.

Each mystery has 2 candidates. Each candidate is an exact Commons File: title
(hand-picked masterpiece) with a search-query fallback in case the title moved.
Images are downloaded as Commons-rendered JPEG thumbnails (width-capped) so they
are web/PWA friendly. Nothing is wired into the app — review only.

Output: rosary-images-review/<setkey>/<n>-<slug>__<rank>__<commonsfile>.jpg
        rosary-images-review/manifest.json
"""
import json, os, re, shutil, time, urllib.parse, urllib.request

UA = "planoflife-rosary-image-fetch/1.0 (https://github.com/; gbrl.schutz@gmail.com)"
API = "https://commons.wikimedia.org/w/api.php"
THUMB_WIDTH = 1400
OUT_ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "rosary-images-review")

# setkey, label, [ (idx, slug, [ (exact_title, fallback_query), (exact_title, fallback_query) ]) ]
SPEC = [
 ("gozosos", "Mistérios Gozosos", [
  (1, "a-anunciacao", [
    ("File:Fra Angelico - Annunciation.jpg", "Fra Angelico Annunciation Prado"),
    ("File:Henry Ossawa Tanner, American (active France) - The Annunciation - Google Art Project.jpg", "Henry Ossawa Tanner Annunciation"),
  ]),
  (2, "visitacao", [
    ("File:La Visitation avec Marie-Jacobie et Marie-Salomé - Domenico Ghirlandaio - Musée du Louvre Peintures INV 297 ; MR 240.jpg", "Ghirlandaio Visitation Louvre"),
    ("File:Mariotto albertinelli, visitazione, 1503 (uffizi) 02.jpg", "Mariotto Albertinelli Visitation Uffizi"),
  ]),
  (3, "nascimento-de-jesus", [
    ("File:Geertgen tot Sint Jans - Nativity, at Night - WGA08514.jpg", "Geertgen tot Sint Jans Nativity at Night"),
    ("File:Antonio Allegri, called Correggio - The Holy Night - Google Art Project.jpg", "Correggio Holy Night Adoration Shepherds Dresden"),
  ]),
  (4, "purificacao", [
    ("File:Den Haag - Mauritshuis - Rembrandt Harmensz. van Rijn (1606-1669) - Simeon’s song of praise 1631.jpg", "Rembrandt Simeon Song of Praise"),
    ("File:Presentation in the Temple Prado Master.jpg", "Presentation in the Temple painting Prado"),
  ]),
  (5, "o-menino-perdido", [
    ("File:Albrecht Dürer - Jesus among the Doctors - Google Art Project.jpg", "Durer Jesus among the Doctors"),
    ("File:Albrecht Dürer, Christ among the Doctors, c. 1503-1504, NGA 6708.jpg", "Durer Christ among the Doctors NGA"),
  ]),
 ]),
 ("dolorosos", "Mistérios Dolorosos", [
  (1, "oracao-no-horto", [
    ("File:Mantegna, Andrea - Agony in the Garden - National Gallery, London.jpg", "Mantegna Agony in the Garden National Gallery"),
    ("File:Bellini,Giovanni - Agony in the Garden - National Gallery.jpg", "Giovanni Bellini Agony in the Garden"),
  ]),
  (2, "flagelacao", [
    ("File:The Flagellation of Christ-Caravaggio (1607).jpg", "Caravaggio Flagellation of Christ"),
    ("File:William bouguereau, flagellazione di cristo, 1880 (musée d'art la rochelle) 02.jpg", "Bouguereau Flagellation of Christ"),
  ]),
  (3, "coroacao-de-espinhos", [
    ("File:The Crowning with Thorns-Caravaggio (1602).jpg", "Caravaggio Crowning with Thorns"),
    ("File:Michelangelo Merisi, called Caravaggio - The Crowning with Thorns - Google Art Project.jpg", "Caravaggio Crowning with Thorns Google Art"),
  ]),
  (4, "a-cruz-as-costas", [
    ("File:El Greco - Christ Carrying the Cross - Google Art Project.jpg", "El Greco Christ Carrying the Cross"),
    ("File:Christ Carrying the Cross MET DP347296.jpg", "Christ Carrying the Cross painting"),
  ]),
  (5, "morte-de-jesus", [
    ("File:Cristo crucificado.jpg", "Velazquez Christ Crucified"),
    ("File:Crucifixion - Andrea Mantegna - Louvre INV 368.jpg", "Mantegna Crucifixion Louvre"),
  ]),
 ]),
 ("gloriosos", "Mistérios Gloriosos", [
  (1, "ressurreicao", [
    ("File:Piero della Francesca - Resurrection - WGA17609.jpg", "Piero della Francesca Resurrection"),
    ("File:Carl Heinrich Bloch - The Resurrection.jpg", "Carl Heinrich Bloch Resurrection"),
  ]),
  (2, "a-ascensao", [
    ("File:Benvenuto Tisi il Garofalo, Ascensione, 1525 circa. Galleria Barberini -FG.jpg", "Garofalo Ascension of Christ"),
    ("File:Rembrandt - The Ascension of Christ - WGA19101.jpg", "Rembrandt Ascension of Christ"),
  ]),
  (3, "pentecostes", [
    ("File:Pentecostés (El Greco, c. 1600) Prado.jpg", "El Greco Pentecost Prado"),
    ("File:Restout - La Pentecôte 01.jpg", "Restout Pentecost"),
  ]),
  (4, "assuncao", [
    ("File:Tizian 041.jpg", "Titian Assumption of the Virgin Frari"),
    ("File:Bartolome Murillo - Assumption of the Virgin.jpg", "Murillo Assumption of the Virgin"),
  ]),
  (5, "coroacao-de-nossa-senhora", [
    ("File:Le Couronnement de la Vierge - Fra Angelico - Musée du Louvre Peintures INV 314 ; MR 220.jpg", "Fra Angelico Coronation of the Virgin Louvre"),
    ("File:Velázquez - Coronación de la Virgen (Museo del Prado, 1641-42).jpg", "Velazquez Coronation of the Virgin Prado"),
  ]),
 ]),
 ("luminosos", "Mistérios Luminosos", [
  (1, "batismo-do-senhor", [
    ("File:Piero della Francesca - Battesimo di Cristo (National Gallery, London).jpg", "Piero della Francesca Baptism of Christ"),
    ("File:The Baptism of Christ (Verrocchio & Leonardo).jpg", "Verrocchio Leonardo Baptism of Christ Uffizi"),
  ]),
  (2, "as-bodas-de-cana", [
    ("File:Les Noces de Cana - Paolo Veronese - Musée du Louvre Peintures INV 142 ; MR 384.jpg", "Veronese Wedding at Cana Louvre"),
    ("File:Gerard David - The Marriage at Cana - WGA6020.jpg", "Gerard David Marriage at Cana"),
  ]),
  (3, "o-anuncio-do-reino", [
    ("File:Bloch-SermonOnTheMount.jpg", "Carl Bloch Sermon on the Mount Bjergpraedikenen"),
    ("File:Cosimo Rosselli Sermone della Montagna.jpg", "Cosimo Rosselli Sermon on the Mount"),
  ]),
  (4, "a-transfiguracao", [
    ("File:Raphael - The Transfiguration - Google Art Project.jpg", "Raphael Transfiguration"),
    ("File:Transfigurazione (Raffaello) September 2015-1a.jpg", "Raphael Transfiguration Vatican"),
  ]),
  (5, "a-instituicao-da-eucaristia", [
    ("File:Leonardo da Vinci (1452-1519) - The Last Supper (1495-1498).jpg", "Leonardo Last Supper"),
    ("File:La Última Cena (Juan de Juanes) (restaurada).jpg", "Juan de Juanes Last Supper Prado"),
  ]),
 ]),
]


def api(params):
    params = dict(params); params["format"] = "json"
    url = API + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def strip_html(s):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", s or "")).strip()


def info_for_title(title):
    d = api({"action": "query", "titles": title, "prop": "imageinfo",
             "iiprop": "url|size|mime|extmetadata", "iiurlwidth": THUMB_WIDTH})
    pages = d.get("query", {}).get("pages", {})
    for pid, p in pages.items():
        if pid == "-1" or "missing" in p:
            return None
        ii = (p.get("imageinfo") or [None])[0]
        if not ii or not ii.get("thumburl"):
            return None
        return pack(p.get("title"), ii)
    return None


def info_for_query(query):
    d = api({"action": "query", "generator": "search", "gsrnamespace": 6,
             "gsrlimit": 6, "gsrsearch": query, "prop": "imageinfo",
             "iiprop": "url|size|mime|extmetadata", "iiurlwidth": THUMB_WIDTH})
    pages = d.get("query", {}).get("pages", {})
    rows = sorted(pages.values(), key=lambda x: x.get("index", 99))
    for p in rows:
        ii = (p.get("imageinfo") or [None])[0]
        if not ii or not ii.get("thumburl"):
            continue
        if "image" not in ii.get("mime", ""):
            continue
        if ii.get("width", 0) < 700:
            continue
        return pack(p.get("title"), ii)
    return None


def pack(title, ii):
    meta = ii.get("extmetadata", {}) or {}
    return {
        "title": title, "thumburl": ii.get("thumburl", ""),
        "width": ii.get("width"), "height": ii.get("height"),
        "thumbwidth": ii.get("thumbwidth"), "thumbheight": ii.get("thumbheight"),
        "mime": ii.get("mime"), "descriptionurl": ii.get("descriptionurl", ""),
        "artist": strip_html(meta.get("Artist", {}).get("value", "")),
        "objectName": strip_html(meta.get("ObjectName", {}).get("value", "")),
        "license": meta.get("LicenseShortName", {}).get("value", ""),
    }


def safe(title):
    return re.sub(r"[^A-Za-z0-9._-]+", "_", title.replace("File:", ""))[:110]


def download(url, dest):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    delay = 5
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=90) as r, open(dest, "wb") as f:
                f.write(r.read())
            return os.path.getsize(dest)
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < 3:
                print(f"        429 rate-limited, backing off {delay}s...")
                time.sleep(delay); delay *= 2; continue
            raise


def main():
    if os.path.isdir(OUT_ROOT):
        shutil.rmtree(OUT_ROOT)
    os.makedirs(OUT_ROOT)
    manifest = []
    for setkey, label, mysteries in SPEC:
        setdir = os.path.join(OUT_ROOT, setkey)
        os.makedirs(setdir, exist_ok=True)
        print(f"\n=== {label} ({setkey}) ===")
        for idx, slug, slots in mysteries:
            print(f"  {idx}. {slug}")
            for rank, (title, fallback) in enumerate(slots, 1):
                c = info_for_title(title)
                via = "title"
                if not c:
                    print(f"     [{rank}] title MISSING ({title}) -> search '{fallback}'")
                    c = info_for_query(fallback)
                    via = "fallback-search"
                if not c:
                    print(f"     [{rank}] !! NOTHING FOUND")
                    continue
                fname = f"{idx}-{slug}__{rank}__{safe(c['title'])}"
                if not fname.lower().endswith(".jpg"):
                    fname += ".jpg"
                dest = os.path.join(setdir, fname)
                try:
                    size = download(c["thumburl"], dest)
                except Exception as e:
                    print(f"     [{rank}] ! download failed: {e}")
                    continue
                print(f"     [{rank}] {c['thumbwidth']}x{c['thumbheight']} {size//1024}KB  {c['title']}  ({via})")
                manifest.append({
                    "set": setkey, "setLabel": label, "mysteryIndex": idx, "slug": slug,
                    "rank": rank, "file": os.path.relpath(dest, OUT_ROOT), "sizeBytes": size,
                    "commonsTitle": c["title"], "artist": c["artist"], "objectName": c["objectName"],
                    "license": c["license"], "sourceWidth": c["width"], "sourceHeight": c["height"],
                    "renderedWidth": c["thumbwidth"], "renderedHeight": c["thumbheight"],
                    "descriptionUrl": c["descriptionurl"], "resolvedVia": via,
                })
                time.sleep(0.7)
    with open(os.path.join(OUT_ROOT, "manifest.json"), "w") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    print(f"\nDONE: {len(manifest)} images -> {OUT_ROOT}")


if __name__ == "__main__":
    main()
