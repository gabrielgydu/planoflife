#!/usr/bin/env python3
"""Downsize the curated review images into public/rosary-images/ (web/PWA sized)
and emit src/data/rosary_images.json mapping each set's mysteries -> candidate
images (filename + artist caption), aligned to rosary_contemplation.json order.

Run after scripts/fetch-rosary-images.py. Requires ImageMagick (convert).
"""
import json, os, re, subprocess, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REVIEW = os.path.join(ROOT, "rosary-images-review")
PUBLIC = os.path.join(ROOT, "public", "rosary-images")
DATA = os.path.join(ROOT, "src", "data", "rosary_images.json")
LONG_EDGE = 1100  # cap longest dimension (px); keeps PWA precache lean
QUALITY = 82

# Curated painter per image. Commons' Artist metadata often holds the
# photographer/uploader of the reproduction rather than the painter, so we
# caption from this hand-verified map instead. PT-friendly name forms.
ARTISTS = {
    "gozosos/1-a-anunciacao-1.jpg": "Fra Angelico",
    "gozosos/1-a-anunciacao-2.jpg": "Henry Ossawa Tanner",
    "gozosos/2-visitacao-1.jpg": "Domenico Ghirlandaio",
    "gozosos/2-visitacao-2.jpg": "Mariotto Albertinelli",
    "gozosos/3-nascimento-de-jesus-1.jpg": "Geertgen tot Sint Jans",
    "gozosos/3-nascimento-de-jesus-2.jpg": "Correggio",
    "gozosos/4-purificacao-1.jpg": "Rembrandt",
    "gozosos/4-purificacao-2.jpg": "Atrib. a Hans Memling",
    "gozosos/5-o-menino-perdido-1.jpg": "Albrecht Dürer",
    "gozosos/5-o-menino-perdido-2.jpg": "Albrecht Dürer",
    "dolorosos/1-oracao-no-horto-1.jpg": "Andrea Mantegna",
    "dolorosos/1-oracao-no-horto-2.jpg": "Giovanni Bellini",
    "dolorosos/2-flagelacao-1.jpg": "Caravaggio",
    "dolorosos/2-flagelacao-2.jpg": "William-Adolphe Bouguereau",
    "dolorosos/3-coroacao-de-espinhos-1.jpg": "Caravaggio",
    "dolorosos/3-coroacao-de-espinhos-2.jpg": "Caravaggio",
    "dolorosos/4-a-cruz-as-costas-1.jpg": "El Greco",
    "dolorosos/4-a-cruz-as-costas-2.jpg": "El Greco",
    "dolorosos/5-morte-de-jesus-1.jpg": "Diego Velázquez",
    "dolorosos/5-morte-de-jesus-2.jpg": "Andrea Mantegna",
    "gloriosos/1-ressurreicao-1.jpg": "Piero della Francesca",
    "gloriosos/1-ressurreicao-2.jpg": "Carl Heinrich Bloch",
    "gloriosos/2-a-ascensao-1.jpg": "Garofalo",
    "gloriosos/2-a-ascensao-2.jpg": "Rembrandt",
    "gloriosos/3-pentecostes-1.jpg": "El Greco",
    "gloriosos/3-pentecostes-2.jpg": "Jean II Restout",
    "gloriosos/4-assuncao-1.jpg": "Ticiano",
    "gloriosos/4-assuncao-2.jpg": "Bartolomé Esteban Murillo",
    "gloriosos/5-coroacao-de-nossa-senhora-1.jpg": "Fra Angelico",
    "gloriosos/5-coroacao-de-nossa-senhora-2.jpg": "Diego Velázquez",
    "luminosos/1-batismo-do-senhor-1.jpg": "Piero della Francesca",
    "luminosos/1-batismo-do-senhor-2.jpg": "Verrocchio e Leonardo",
    "luminosos/2-as-bodas-de-cana-1.jpg": "Paolo Veronese",
    "luminosos/2-as-bodas-de-cana-2.jpg": "Gerard David",
    "luminosos/3-o-anuncio-do-reino-1.jpg": "Carl Heinrich Bloch",
    "luminosos/3-o-anuncio-do-reino-2.jpg": "Cosimo Rosselli",
    "luminosos/4-a-transfiguracao-1.jpg": "Rafael",
    "luminosos/4-a-transfiguracao-2.jpg": "Rafael",
    "luminosos/5-a-instituicao-da-eucaristia-1.jpg": "Leonardo da Vinci",
    "luminosos/5-a-instituicao-da-eucaristia-2.jpg": "Juan de Juanes",
}


def clean_artist(raw):
    if not raw:
        return ""
    a = raw.split(";")[0].split("/")[0]
    # take text before first parenthesis / comma-with-dates
    a = re.split(r"\s*\(", a)[0]
    a = a.replace("anonymous", "").strip(" ,.-")
    # collapse "Surname, Firstname" -> "Firstname Surname" when obvious
    return re.sub(r"\s+", " ", a)[:40]


def main():
    man = json.load(open(os.path.join(REVIEW, "manifest.json")))
    if os.path.isdir(PUBLIC):
        for root, _, files in os.walk(PUBLIC):
            for f in files:
                os.remove(os.path.join(root, f))
    os.makedirs(PUBLIC, exist_ok=True)

    by_set = collections.defaultdict(lambda: collections.defaultdict(list))
    for e in man:
        by_set[e["set"]][e["mysteryIndex"]].append(e)

    out = {}
    total_bytes = 0
    for setkey in ["gozosos", "dolorosos", "gloriosos", "luminosos"]:
        setdir = os.path.join(PUBLIC, setkey)
        os.makedirs(setdir, exist_ok=True)
        mysteries = []
        for idx in sorted(by_set[setkey]):
            cands = sorted(by_set[setkey][idx], key=lambda e: e["rank"])
            slot = []
            for e in cands:
                src = os.path.join(REVIEW, e["file"])
                name = f"{idx}-{e['slug']}-{e['rank']}.jpg"
                dest = os.path.join(setdir, name)
                subprocess.run([
                    "magick", src, "-resize", f"{LONG_EDGE}x{LONG_EDGE}>",
                    "-strip", "-interlace", "Plane", "-quality", str(QUALITY), dest,
                ], check=True)
                sz = os.path.getsize(dest)
                total_bytes += sz
                fpath = f"{setkey}/{name}"
                slot.append({"f": fpath, "a": ARTISTS.get(fpath, clean_artist(e.get("artist", "")))})
                print(f"  {setkey}/{name}  {sz//1024}KB  ({slot[-1]['a']})")
            mysteries.append(slot)
        out[setkey] = mysteries

    with open(DATA, "w") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(f"\nTotal: {total_bytes//1024} KB across public/rosary-images/")
    print(f"Wrote {DATA}")


if __name__ == "__main__":
    main()
