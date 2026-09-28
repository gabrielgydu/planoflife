#!/usr/bin/env python3
"""Fetch curated, high-quality public-domain paintings for the 20 Rosary
mysteries from Wikimedia Commons into a local review folder.

Each mystery has 4–5 candidates. Each candidate is an exact Commons File: title
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

# setkey, label, [ (idx, slug, [ (exact_title, fallback_query), ... ]) ]
# 4–5 candidates per mystery (the carousel picks one at random on every open).
# Selection rules: public-domain paintings that read on a phone (~390px wide,
# max 55vh tall) — clear focal scene, no frames/gallery photos, no canvas
# versos, no B&W prints, no damaged or near-black scans, never two scans of the
# same painting. Where possible, a painting that shows what St. Josemaría's
# «Santo Rosário» text for that mystery describes (noted inline). A few scans
# carry a frame edge that build-rosary-images.py crops away (its CROP map).
#
# Rejected on review (don't re-add): Rembrandt's 1631 Simeon (near-black),
# Dürer's Doctors (caricatures) and woodcut (B&W), Rosselli's Sermon and
# Veronese's Cana (crowded panoramas), a second scan of Raphael's
# Transfiguration, Restout's Pentecost (dark, framed), Leonardo's Last Supper
# (damaged), Fra Angelico's Louvre Coronation (crowded, framed), Barocci's
# Visitation (only an engraving or an in-church photo on Commons), Giotto's
# Christ among the Doctors (flaking fresco), the sepia photo of Burnand's
# disciples, gallery-photo scans of Champaigne and Witz (frames).
SPEC = [
 ("gozosos", "Mistérios Gozosos", [
  (1, "a-anunciacao", [
    ("File:Fra Angelico - Annunciation.jpg", "Fra Angelico Annunciation San Marco"),
    ("File:Henry Ossawa Tanner, American (active France) - The Annunciation - Google Art Project.jpg", "Henry Ossawa Tanner Annunciation"),
    ("File:La anunciación (Murillo, h. 1660).jpg", "Murillo Annunciation Prado"),
    ("File:El GRECO (Domenikos Theotokopoulos) - Annunciation - Google Art Project.jpg", "El Greco Annunciation"),
    ("File:The Annunciation MET DT5656.jpg", "Philippe de Champaigne Annunciation MET"),
  ]),
  (2, "visitacao", [
    ("File:La Visitation avec Marie-Jacobie et Marie-Salomé - Domenico Ghirlandaio - Musée du Louvre Peintures INV 297 ; MR 240.jpg", "Ghirlandaio Visitation Louvre"),
    ("File:Mariotto albertinelli, visitazione, 1503 (uffizi) 02.jpg", "Mariotto Albertinelli Visitation Uffizi"),
    # Journey through the hill country — «Caminhamos apressadamente em direção às montanhas».
    ("File:Rogier van der Weyden - Heimsuchung.jpeg", "Rogier van der Weyden Visitation Leipzig"),
    ("File:Pontormo-visitation-after-restorationRGB.jpg", "Pontormo Visitation Carmignano"),
    ("File:Giotto di Bondone - No. 16 Scenes from the Life of the Virgin - 7. Visitation - WGA09192.jpg", "Giotto Scrovegni Visitation"),
  ]),
  (3, "nascimento-de-jesus", [
    ("File:Geertgen tot Sint Jans - Nativity, at Night - WGA08514.jpg", "Geertgen tot Sint Jans Nativity at Night"),
    # Mother cradling the Child — «e O embalo, e canto para Ele».
    ("File:Georges de La Tour - Newlyborn infant - Musée des Beaux-Arts de Rennes.jpg", "Georges de La Tour Le Nouveau-ne Rennes"),
    ("File:Adoration of the Shepherds, Murillo (Prado Museum).jpg", "Murillo Adoration of the Shepherds Prado"),
    ("File:Gerard van Honthorst - Adoration of the Shepherds (1622).jpg", "Gerard van Honthorst Adoration of the Shepherds"),
    ("File:Giotto di Bondone - No. 17 Scenes from the Life of Christ - 1. Nativity - Birth of Jesus - WGA09193.jpg", "Giotto Scrovegni Nativity"),
  ]),
  (4, "purificacao", [
    ("File:Presentation in the Temple Prado Master.jpg", "Presentation in the Temple painting Prado"),
    # Simeon taking the Child in his arms — «toma o Messias em seus braços».
    ("File:Presentation of Jesus at the Temple by Fra Angelico (San Marco Cell 10).jpg", "Fra Angelico Presentation Temple San Marco cell 10"),
    ("File:Andrea Mantegna - The Presentation - Google Art Project.jpg", "Mantegna Presentation at the Temple Berlin"),
    ("File:Giotto di Bondone - No. 19 Scenes from the Life of Christ - 3. Presentation of Christ at the Temple - WGA09197.jpg", "Giotto Scrovegni Presentation of Christ at the Temple"),
    ("File:Baccio della Porta, gen. Fra Bartolomeo, Kunsthistorisches Museum Wien, Gemäldegalerie - Darbringung Christi im Tempel - GG 207 - Kunsthistorisches Museum.jpg", "Fra Bartolomeo Presentation in the Temple Vienna"),
  ]),
  (5, "o-menino-perdido", [
    # Mary and Joseph finding Him — «a alegria de encontrar Jesus».
    ("File:Simone Martini - Christ Discovered in the Temple - Google Art Project.jpg", "Simone Martini Christ discovered in the Temple"),
    ("File:William Holman Hunt - The Finding of the Saviour in the Temple - Google Art Project.jpg", "Holman Hunt Finding of the Saviour in the Temple"),
    ("File:Brooklyn Museum - Jesus Found in the Temple (Jesus retrouvé dans le temple) - James Tissot - overall.jpg", "Tissot Jesus Found in the Temple"),
    ("File:ChristInTheTemple.jpg", "Heinrich Hofmann Christ in the Temple"),
    ("File:Musée Ingres-Bourdelle - Jésus parmi les docteurs - Ingres - Joconde06070001450.jpg", "Ingres Jesus among the Doctors"),
  ]),
 ]),
 ("dolorosos", "Mistérios Dolorosos", [
  (1, "oracao-no-horto", [
    # The sleeping apostles — «E Pedro adormeceu. - E os demais Apóstolos».
    ("File:Mantegna, Andrea - Agony in the Garden - National Gallery, London.jpg", "Mantegna Agony in the Garden National Gallery"),
    ("File:Bellini,Giovanni - Agony in the Garden - National Gallery.jpg", "Giovanni Bellini Agony in the Garden"),
    # The angel comforting Him — «Um Anjo do céu O conforta».
    ("File:Gethsemane Carl Bloch.jpg", "Carl Bloch Gethsemane"),
    ("File:Christ in Gethsemane.jpg", "Heinrich Hofmann Christ in Gethsemane"),
    ("File:Agony in the garden El Greco.jpg", "El Greco Agony in the Garden"),
  ]),
  (2, "flagelacao", [
    ("File:The Flagellation of Christ-Caravaggio (1607).jpg", "Caravaggio Flagellation of Christ"),
    ("File:William bouguereau, flagellazione di cristo, 1880 (musée d'art la rochelle) 02.jpg", "Bouguereau Flagellation of Christ"),
    # A child (the Christian soul) looking at the scourged Christ —
    # «Tu e eu não podemos falar… Olha para Ele, olha para Ele… devagar».
    ("File:Velazquez-CristCol.jpg", "Velazquez Christ after the Flagellation Christian Soul"),
    # Christ fallen after the scourging — «cai… truncado e meio morto».
    ("File:Cristo después de la Flagelación (Bartolomé Esteban Murillo).jpg", "Murillo Christ after the Flagellation"),
  ]),
  (3, "coroacao-de-espinhos", [
    ("File:The Crowning with Thorns-Caravaggio (1602).jpg", "Caravaggio Crowning with Thorns"),
    ("File:Hieronymus Bosch - Christ Mocked (The Crowning with Thorns) - Google Art Project.jpg", "Bosch Christ Mocked Crowning with Thorns National Gallery"),
    # The reed as sceptre — «Por cetro, uma cana na mão direita».
    ("File:Anthonis van Dyck 004.jpg", "Van Dyck Crowning with Thorns Prado"),
    ("File:Titian - Christ crowned with Thorns - Louvre.jpg", "Titian Crowning with Thorns Louvre"),
    # «Ecce homo! Aí tendes o homem».
    ("File:Antonio Ciseri - Ecce Homo.jpg", "Ciseri Ecce Homo"),
  ]),
  (4, "a-cruz-as-costas", [
    ("File:El Greco - Christ Carrying the Cross - Google Art Project.jpg", "El Greco Christ Carrying the Cross"),
    # Mary on the way — «encontrarás Maria no caminho».
    ("File:Raphael Spasimo.jpg", "Raphael Lo Spasimo di Sicilia Prado"),
    # The Cyrenean helping — «lançam mão de um tal Simão, natural de Cirene».
    ("File:Titian, Christ Carrying the Cross. Oil on canvas, 67 x 77 cm, c. 1565. Madrid, Museo Nacional del Prado.jpg", "Titian Christ Carrying the Cross Prado"),
    ("File:Piombo cristo cruz prado.jpg", "Sebastiano del Piombo Christ carrying the cross Prado"),
    ("File:Giotto di Bondone - No. 34 Scenes from the Life of Christ - 18. Road to Calvary - WGA09220.jpg", "Giotto Road to Calvary"),
  ]),
  (5, "morte-de-jesus", [
    ("File:Cristo crucificado.jpg", "Velazquez Christ Crucified"),
    ("File:Crucifixion - Andrea Mantegna - Louvre INV 368.jpg", "Mantegna Crucifixion Louvre"),
    # Mary and John at the foot of the Cross — «Ecce mater tua!».
    ("File:Rogier van der Weyden, Netherlandish (active Tournai and Brussels) - The Crucifixion, with the Virgin and Saint John the Evangelist Mourning - Google Art Project.jpg", "Rogier van der Weyden Crucifixion Diptych"),
    ("File:Antonello da Messina - Calvaria (Anvers).jpg", "Antonello da Messina Crucifixion Antwerp"),
    # Mary, John and Magdalen — «Santa Maria… e Maria Madalena. E João».
    ("File:CrucifixionVanDyckLouvre.jpg", "Van Dyck Crucifixion Louvre"),
  ]),
 ]),
 ("gloriosos", "Mistérios Gloriosos", [
  (1, "ressurreicao", [
    ("File:Piero della Francesca - Resurrection - WGA17609.jpg", "Piero della Francesca Resurrection"),
    ("File:Carl Heinrich Bloch - The Resurrection.jpg", "Carl Heinrich Bloch Resurrection"),
    # «Apareceu a Maria de Magdala, que está louca de amor».
    ("File:Angelico, noli me tangere.jpg", "Fra Angelico Noli me tangere San Marco"),
    # The women at the empty tomb — «Não temais… não está aqui».
    ("File:Fra Angelico - Resurrection of Christ and Women at the Tomb (Cell 8) - WGA00542.jpg", "Fra Angelico Women at the Tomb Cell 8"),
    ("File:Disciples running by EB.jpg", "Burnand disciples Peter and John running to the sepulchre"),
  ]),
  (2, "a-ascensao", [
    ("File:Benvenuto Tisi il Garofalo, Ascensione, 1525 circa. Galleria Barberini -FG.jpg", "Garofalo Ascension of Christ"),
    ("File:Rembrandt van Rijn 192.jpg", "Rembrandt Ascension of Christ"),
    # The two angels in white — «Homens da Galiléia, que fazeis olhando para o céu?».
    ("File:Jesus ascending to heaven.jpg", "Copley Ascension"),
    ("File:Andrea Mantegna 012.jpg", "Mantegna Ascension Uffizi"),
    ("File:Giotto di Bondone - No. 38 Scenes from the Life of Christ - 22. Ascension - WGA09226.jpg", "Giotto Ascension"),
  ]),
  (3, "pentecostes", [
    ("File:Pentecostés (El Greco, c. 1600) Prado.jpg", "El Greco Pentecost Prado"),
    ("File:Maino Pentecostés, 1620-1625. Museo del Prado.jpg", "Maino Pentecost Prado"),
    ("File:Tiziano Pentecostés.jpg", "Titian Pentecost Salute"),
    ("File:Peter Paul Rubens - Ausgießung des Heiligen Geistes - 999 - Bavarian State Painting Collections.jpg", "Rubens Pentecost Munich"),
    ("File:Giotto di Bondone - No. 39 Scenes from the Life of Christ - 23. Pentecost - WGA09227.jpg", "Giotto Pentecost"),
  ]),
  (4, "assuncao", [
    ("File:Tizian 041.jpg", "Titian Assumption of the Virgin Frari"),
    ("File:Bartolome Murillo - Assumption of the Virgin.jpg", "Murillo Assumption of the Virgin"),
    # The apostles round her bed — «Adormeceu a Mãe de Deus. Em volta do seu leito…».
    ("File:Andrea Mantegna 047.jpg", "Mantegna Death of the Virgin Prado"),
    ("File:The Assumption of Virgin Mary - Guido Reni (unframed).jpg", "Guido Reni Assumption"),
    ("File:Rubens, Peter Paul - The Assumption of the Virgin - ca. 1611-1612.jpg", "Rubens Assumption of the Virgin"),
  ]),
  (5, "coroacao-de-nossa-senhora", [
    ("File:Diego Velázquez - Coronation of the Virgin - Prado.jpg", "Velazquez Coronation of the Virgin Prado"),
    ("File:Fra Angelico - Coronation of the Virgin (Cell 9) - WGA00543.jpg", "Fra Angelico Coronation of the Virgin San Marco cell 9"),
    # The whole court of heaven paying homage — «rendem-lhe preito de vassalagem…».
    ("File:Enguerrand QUARTON - Le couronnement de la Vierge - 1454 - Musée Pierre-de-Luxembourg (Villeneuve-lès-Avignon).jpg", "Enguerrand Quarton Coronation of the Virgin"),
    ("File:La coronación de la Virgen (El Greco).jpg", "El Greco Coronation of the Virgin"),
    ("File:Gentile da Fabriano - Coronation of the Virgin.jpg", "Gentile da Fabriano Coronation of the Virgin"),
  ]),
 ]),
 ("luminosos", "Mistérios Luminosos", [
  (1, "batismo-do-senhor", [
    ("File:Piero della Francesca - Battesimo di Cristo (National Gallery, London).jpg", "Piero della Francesca Baptism of Christ"),
    ("File:The Baptism of Christ (Verrocchio & Leonardo).jpg", "Verrocchio Leonardo Baptism of Christ Uffizi"),
    ("File:Guido Reni - The Baptism of Christ - Google Art Project.jpg", "Guido Reni Baptism of Christ"),
    ("File:Bautismo de Cristo de Navarrete el Mudo.jpg", "Navarrete Baptism of Christ Prado"),
    ("File:Giotto di Bondone - No. 23 Scenes from the Life of Christ - 7. Baptism of Christ - WGA09201.jpg", "Giotto Baptism of Christ"),
  ]),
  (2, "as-bodas-de-cana", [
    ("File:Gerard David - The Marriage at Cana - WGA6020.jpg", "Gerard David Marriage at Cana"),
    # Mary at Jesus's side, the water jars in front — «Não têm vinho».
    ("File:The Marriage Feast at Cana MET DT1459.jpg", "Juan de Flandes Marriage Feast at Cana"),
    ("File:Julius Schnorr von Carolsfeld 002.jpg", "Schnorr von Carolsfeld Wedding at Cana"),
    ("File:The Barber Institute of Fine Arts - Bartolomé Esteban Murillo - The Marriage Feast at Cana.jpg", "Murillo Marriage Feast at Cana"),
    ("File:Giotto di Bondone - No. 24 Scenes from the Life of Christ - 8. Marriage at Cana - WGA09202.jpg", "Giotto Marriage at Cana"),
  ]),
  (3, "o-anuncio-do-reino", [
    ("File:Bloch-SermonOnTheMount.jpg", "Carl Bloch Sermon on the Mount Bjergpraedikenen"),
    # «Duc in altum… et laxate retia vestra».
    ("File:Raphael - The Miraculous Draft of Fishes - Google Art Project.jpg", "Raphael Miraculous Draught of Fishes"),
    # «Jesus vê aquelas barcas na margem e sobe numa delas».
    ("File:Duccio di Buoninsegna, The Calling of the Apostles Peter and Andrew, 1308-1311, NGA 282.jpg", "Duccio Calling of Peter and Andrew"),
    ("File:TissotBeatitudes.JPG", "Tissot Sermon of the Beatitudes"),
    ("File:Konrad Witz 008.jpg", "Konrad Witz Miraculous Draught of Fishes"),
  ]),
  (4, "a-transfiguracao", [
    ("File:Raphael - The Transfiguration - Google Art Project.jpg", "Raphael Transfiguration"),
    ("File:Fra Angelico 042 adjusted.jpg", "Fra Angelico Transfiguration San Marco cell 6"),
    ("File:Giovanni Bellini - Trasfigurazione di Cristo.jpg", "Giovanni Bellini Transfiguration Capodimonte"),
    ("File:Duccio di Buoninsegna 039.jpg", "Duccio Transfiguration"),
    ("File:Perugino, trasfigurazione, collegio del cambio.jpg", "Perugino Transfiguration"),
  ]),
  (5, "a-instituicao-da-eucaristia", [
    ("File:Joan de Joanes - The Last Supper - WGA12058.jpg", "Juan de Juanes Last Supper Prado"),
    ("File:Dieric Bouts - The Last Supper.jpg", "Dirk Bouts Last Supper"),
    # Christ giving communion to the Apostles — the institution itself.
    ("File:Fra Angelico - Institution of the Eucharist (Cell 35) - WGA00549.jpg", "Fra Angelico Institution of the Eucharist"),
    ("File:Giusto di gand, comunione degli apostoli, 1473-1474.jpg", "Justus of Ghent Communion of the Apostles"),
    ("File:Philippe de Champaigne - The Last Supper - WGA4710.jpg", "Philippe de Champaigne Last Supper"),
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
    # A moved/renamed Commons title silently falls back to a search hit, which
    # can be something else entirely (once: a stained-glass window for a
    # Correggio). Eyeball these before building — or fix the exact title.
    fallbacks = [e for e in manifest if e["resolvedVia"] != "title"]
    for e in fallbacks:
        print(f"  !! FALLBACK {e['set']}/{e['mysteryIndex']}-{e['slug']} [{e['rank']}] -> {e['commonsTitle']}")


if __name__ == "__main__":
    main()
