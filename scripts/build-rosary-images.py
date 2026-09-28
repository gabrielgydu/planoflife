#!/usr/bin/env python3
"""Downsize the curated review images into public/rosary-images/ (web/PWA sized
WebP) and emit src/data/rosary_images.json mapping each set's mysteries ->
candidate images (filename + artist caption), aligned to
rosary_contemplation.json order.

Run after scripts/fetch-rosary-images.py. Requires Pillow (with WebP support).
"""
import io, json, os, re, collections

from PIL import Image, ImageCms

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REVIEW = os.path.join(ROOT, "rosary-images-review")
PUBLIC = os.path.join(ROOT, "public", "rosary-images")
DATA = os.path.join(ROOT, "src", "data", "rosary_images.json")
# ~100 images are precached by the PWA (vite.config.ts globPatterns include
# webp), so every KB counts: 1000px long edge still covers a 390pt-wide phone
# screen at 2.5x, and WebP q78 is ~40% smaller than the old JPEG q82.
LONG_EDGE = 1000
QUALITY = 78

# Curated painter per image. Commons' Artist metadata often holds the
# photographer/uploader of the reproduction rather than the painter, so we
# caption from this hand-verified map instead. PT-friendly name forms.
ARTISTS = {
    "gozosos/1-a-anunciacao-1.webp": "Fra Angelico",
    "gozosos/1-a-anunciacao-2.webp": "Henry Ossawa Tanner",
    "gozosos/1-a-anunciacao-3.webp": "Bartolomé Esteban Murillo",
    "gozosos/1-a-anunciacao-4.webp": "El Greco",
    "gozosos/1-a-anunciacao-5.webp": "Philippe de Champaigne",
    "gozosos/2-visitacao-1.webp": "Domenico Ghirlandaio",
    "gozosos/2-visitacao-2.webp": "Mariotto Albertinelli",
    "gozosos/2-visitacao-3.webp": "Rogier van der Weyden",
    "gozosos/2-visitacao-4.webp": "Pontormo",
    "gozosos/2-visitacao-5.webp": "Giotto",
    "gozosos/3-nascimento-de-jesus-1.webp": "Geertgen tot Sint Jans",
    "gozosos/3-nascimento-de-jesus-2.webp": "Georges de La Tour",
    "gozosos/3-nascimento-de-jesus-3.webp": "Bartolomé Esteban Murillo",
    "gozosos/3-nascimento-de-jesus-4.webp": "Gerard van Honthorst",
    "gozosos/3-nascimento-de-jesus-5.webp": "Giotto",
    "gozosos/4-purificacao-1.webp": "Mestre flamengo (antes atrib. a Hans Memling)",
    "gozosos/4-purificacao-2.webp": "Fra Angelico",
    "gozosos/4-purificacao-3.webp": "Andrea Mantegna",
    "gozosos/4-purificacao-4.webp": "Giotto",
    "gozosos/4-purificacao-5.webp": "Fra Bartolomeo",
    "gozosos/5-o-menino-perdido-1.webp": "Simone Martini",
    "gozosos/5-o-menino-perdido-2.webp": "William Holman Hunt",
    "gozosos/5-o-menino-perdido-3.webp": "James Tissot",
    "gozosos/5-o-menino-perdido-4.webp": "Heinrich Hofmann",
    "gozosos/5-o-menino-perdido-5.webp": "Jean-Auguste-Dominique Ingres",
    "dolorosos/1-oracao-no-horto-1.webp": "Andrea Mantegna",
    "dolorosos/1-oracao-no-horto-2.webp": "Giovanni Bellini",
    "dolorosos/1-oracao-no-horto-3.webp": "Carl Heinrich Bloch",
    "dolorosos/1-oracao-no-horto-4.webp": "Heinrich Hofmann",
    "dolorosos/1-oracao-no-horto-5.webp": "El Greco",
    "dolorosos/2-flagelacao-1.webp": "Caravaggio",
    "dolorosos/2-flagelacao-2.webp": "William-Adolphe Bouguereau",
    "dolorosos/2-flagelacao-3.webp": "Diego Velázquez",
    "dolorosos/2-flagelacao-4.webp": "Bartolomé Esteban Murillo",
    "dolorosos/3-coroacao-de-espinhos-1.webp": "Caravaggio",
    "dolorosos/3-coroacao-de-espinhos-2.webp": "Hieronymus Bosch",
    "dolorosos/3-coroacao-de-espinhos-3.webp": "Anthony van Dyck",
    "dolorosos/3-coroacao-de-espinhos-4.webp": "Ticiano",
    "dolorosos/3-coroacao-de-espinhos-5.webp": "Antonio Ciseri",
    "dolorosos/4-a-cruz-as-costas-1.webp": "El Greco",
    "dolorosos/4-a-cruz-as-costas-2.webp": "Rafael",
    "dolorosos/4-a-cruz-as-costas-3.webp": "Ticiano",
    "dolorosos/4-a-cruz-as-costas-4.webp": "Sebastiano del Piombo",
    "dolorosos/4-a-cruz-as-costas-5.webp": "Giotto",
    "dolorosos/5-morte-de-jesus-1.webp": "Diego Velázquez",
    "dolorosos/5-morte-de-jesus-2.webp": "Andrea Mantegna",
    "dolorosos/5-morte-de-jesus-3.webp": "Rogier van der Weyden",
    "dolorosos/5-morte-de-jesus-4.webp": "Antonello da Messina",
    "dolorosos/5-morte-de-jesus-5.webp": "Anthony van Dyck",
    "gloriosos/1-ressurreicao-1.webp": "Piero della Francesca",
    "gloriosos/1-ressurreicao-2.webp": "Carl Heinrich Bloch",
    "gloriosos/1-ressurreicao-3.webp": "Fra Angelico",
    "gloriosos/1-ressurreicao-4.webp": "Fra Angelico",
    "gloriosos/1-ressurreicao-5.webp": "Eugène Burnand",
    "gloriosos/2-a-ascensao-1.webp": "Garofalo",
    "gloriosos/2-a-ascensao-2.webp": "Rembrandt",
    "gloriosos/2-a-ascensao-3.webp": "John Singleton Copley",
    "gloriosos/2-a-ascensao-4.webp": "Andrea Mantegna",
    "gloriosos/2-a-ascensao-5.webp": "Giotto",
    "gloriosos/3-pentecostes-1.webp": "El Greco",
    "gloriosos/3-pentecostes-2.webp": "Juan Bautista Maíno",
    "gloriosos/3-pentecostes-3.webp": "Ticiano",
    "gloriosos/3-pentecostes-4.webp": "Peter Paul Rubens",
    "gloriosos/3-pentecostes-5.webp": "Giotto",
    "gloriosos/4-assuncao-1.webp": "Ticiano",
    "gloriosos/4-assuncao-2.webp": "Bartolomé Esteban Murillo",
    "gloriosos/4-assuncao-3.webp": "Andrea Mantegna",
    "gloriosos/4-assuncao-4.webp": "Guido Reni",
    "gloriosos/4-assuncao-5.webp": "Peter Paul Rubens",
    "gloriosos/5-coroacao-de-nossa-senhora-1.webp": "Diego Velázquez",
    "gloriosos/5-coroacao-de-nossa-senhora-2.webp": "Fra Angelico",
    "gloriosos/5-coroacao-de-nossa-senhora-3.webp": "Enguerrand Quarton",
    "gloriosos/5-coroacao-de-nossa-senhora-4.webp": "El Greco",
    "gloriosos/5-coroacao-de-nossa-senhora-5.webp": "Gentile da Fabriano",
    "luminosos/1-batismo-do-senhor-1.webp": "Piero della Francesca",
    "luminosos/1-batismo-do-senhor-2.webp": "Verrocchio e Leonardo",
    "luminosos/1-batismo-do-senhor-3.webp": "Guido Reni",
    "luminosos/1-batismo-do-senhor-4.webp": "Juan Fernández de Navarrete",
    "luminosos/1-batismo-do-senhor-5.webp": "Giotto",
    "luminosos/2-as-bodas-de-cana-1.webp": "Gerard David",
    "luminosos/2-as-bodas-de-cana-2.webp": "Juan de Flandes",
    "luminosos/2-as-bodas-de-cana-3.webp": "Julius Schnorr von Carolsfeld",
    "luminosos/2-as-bodas-de-cana-4.webp": "Bartolomé Esteban Murillo",
    "luminosos/2-as-bodas-de-cana-5.webp": "Giotto",
    "luminosos/3-o-anuncio-do-reino-1.webp": "Carl Heinrich Bloch",
    "luminosos/3-o-anuncio-do-reino-2.webp": "Rafael",
    "luminosos/3-o-anuncio-do-reino-3.webp": "Duccio",
    "luminosos/3-o-anuncio-do-reino-4.webp": "James Tissot",
    "luminosos/3-o-anuncio-do-reino-5.webp": "Konrad Witz",
    "luminosos/4-a-transfiguracao-1.webp": "Rafael",
    "luminosos/4-a-transfiguracao-2.webp": "Fra Angelico",
    "luminosos/4-a-transfiguracao-3.webp": "Giovanni Bellini",
    "luminosos/4-a-transfiguracao-4.webp": "Duccio",
    "luminosos/4-a-transfiguracao-5.webp": "Perugino",
    "luminosos/5-a-instituicao-da-eucaristia-1.webp": "Juan de Juanes",
    "luminosos/5-a-instituicao-da-eucaristia-2.webp": "Dieric Bouts",
    "luminosos/5-a-instituicao-da-eucaristia-3.webp": "Fra Angelico",
    "luminosos/5-a-instituicao-da-eucaristia-4.webp": "Justo de Gante",
    "luminosos/5-a-instituicao-da-eucaristia-5.webp": "Philippe de Champaigne",
}

# Fractions (left, top, right, bottom) trimmed off scans that carry a frame
# edge or gallery-photo border, applied before downsizing.
CROP = {
    # Gallery photo: gilded frame + scalloped shadow along the top.
    "dolorosos/2-flagelacao-4.webp": (0.015, 0.075, 0.018, 0.015),
    # Maestà panel photographed on navy with its wooden frame.
    "luminosos/4-a-transfiguracao-4.webp": (0.045, 0.045, 0.045, 0.06),
    # Photographed in situ: the Frari's marble altar frame at the sides and base.
    "gloriosos/4-assuncao-1.webp": (0.055, 0.0, 0.055, 0.045),
}

_SRGB = ImageCms.createProfile("sRGB")


def clean_artist(raw):
    if not raw:
        return ""
    a = raw.split(";")[0].split("/")[0]
    # take text before first parenthesis / comma-with-dates
    a = re.split(r"\s*\(", a)[0]
    a = a.replace("anonymous", "").strip(" ,.-")
    return re.sub(r"\s+", " ", a)[:40]


def to_srgb(im):
    """Convert to RGB, honouring an embedded ICC profile (Adobe RGB scans would
    otherwise render washed out once the profile is dropped)."""
    icc = im.info.get("icc_profile")
    if icc:
        try:
            src = ImageCms.ImageCmsProfile(io.BytesIO(icc))
            return ImageCms.profileToProfile(im.convert("RGB") if im.mode not in ("RGB", "CMYK") else im,
                                             src, _SRGB, outputMode="RGB")
        except (ImageCms.PyCMSError, OSError):
            pass
    return im.convert("RGB")


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
    missing_captions = []
    for setkey in ["gozosos", "dolorosos", "gloriosos", "luminosos"]:
        setdir = os.path.join(PUBLIC, setkey)
        os.makedirs(setdir, exist_ok=True)
        mysteries = []
        for idx in sorted(by_set[setkey]):
            cands = sorted(by_set[setkey][idx], key=lambda e: e["rank"])
            slot = []
            for e in cands:
                src = os.path.join(REVIEW, e["file"])
                name = f"{idx}-{e['slug']}-{e['rank']}.webp"
                fpath = f"{setkey}/{name}"
                dest = os.path.join(setdir, name)
                im = to_srgb(Image.open(src))
                if fpath in CROP:
                    l, t, r, b = CROP[fpath]
                    w, h = im.size
                    im = im.crop((round(w * l), round(h * t), round(w * (1 - r)), round(h * (1 - b))))
                im.thumbnail((LONG_EDGE, LONG_EDGE), Image.LANCZOS)
                im.save(dest, "WEBP", quality=QUALITY, method=6)
                sz = os.path.getsize(dest)
                total_bytes += sz
                if fpath not in ARTISTS:
                    missing_captions.append(fpath)
                slot.append({"f": fpath, "a": ARTISTS.get(fpath, clean_artist(e.get("artist", "")))})
                print(f"  {fpath}  {im.size[0]}x{im.size[1]}  {sz//1024}KB  ({slot[-1]['a']})")
            mysteries.append(slot)
        out[setkey] = mysteries

    with open(DATA, "w") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"\nTotal: {total_bytes//1024} KB across public/rosary-images/")
    print(f"Wrote {DATA}")
    if missing_captions:
        print("!! No hand-verified caption (fell back to Commons metadata):")
        for p in missing_captions:
            print("   ", p)


if __name__ == "__main__":
    main()
