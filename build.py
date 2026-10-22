"""Balian Springs site preview: assembles every page from src/ into static folders GitHub Pages serves.

  src/partials/head.html, header.html, menu.html, footer.html   shared chrome
  src/pages/<name>.html                                          one page each: a front-matter comment, then <main>

Front matter (an HTML comment at the very top of a page file):
  <!--
  path: /admission/          the folder the page is written to ("/" = the root index.html)
  title: Day Passes | Balian Springs
  description: ...
  nav: admission             which header link is marked current (optional)
  hero: dark                 "dark" = the header sits over a dark cover; anything else = a paper header (optional)
  jsonld: daySpa             extra structured data block from src/jsonld/<name>.json (optional)
  -->

Every link and asset in a page or partial is written with {{root}}, which becomes the relative way back to the site
root ("" on the home page, "../" one folder down). That keeps the preview working under
temsagpt-creator.github.io/balian-springs-concept/ and on any other host.

  python build.py          build every page
  python build.py --check  build, then fail if any {{...}} placeholder or an em/en dash survived in the output
  python build.py --check --only saunas   build and check one page (src/pages/saunas.html) and nothing else
"""
import json, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent
SRC = ROOT / "src"
PARTS = {p.stem: p.read_text(encoding="utf-8") for p in (SRC / "partials").glob("*.html")}
FM = re.compile(r"\A<!--(.*?)-->\s*", re.S)


def parse(text):
    m = FM.match(text)
    meta = {}
    if m:
        for line in m.group(1).strip().splitlines():
            if ":" in line:
                k, v = line.split(":", 1)
                meta[k.strip()] = v.strip()
        text = text[m.end():]
    return meta, text


def render(name):
    meta, body = parse((SRC / "pages" / f"{name}.html").read_text(encoding="utf-8"))
    path = meta.get("path", f"/{name}/")
    depth = len([p for p in path.strip("/").split("/") if p])
    root = "../" * depth
    jsonld = ""
    if meta.get("jsonld"):
        for key in meta["jsonld"].split(","):
            data = json.loads((SRC / "jsonld" / f"{key.strip()}.json").read_text(encoding="utf-8"))
            jsonld += '<script type="application/ld+json">\n' + json.dumps(data, indent=1, ensure_ascii=False) + "\n</script>\n"
    html = (PARTS["head"] + PARTS["header"] + PARTS["menu"] + body + PARTS["footer"])
    html = html.replace("{{title}}", meta.get("title", "Balian Springs"))
    html = html.replace("{{description}}", meta.get("description", ""))
    html = html.replace("{{jsonld}}", jsonld)
    html = html.replace("{{bodyclass}}", "is-dark-top" if meta.get("hero") == "dark" else "is-paper-top")
    nav = meta.get("nav", "")
    html = re.sub(r'data-nav="([a-z-]+)"', lambda m: 'aria-current="page"' if m.group(1) == nav else "", html)
    html = html.replace("{{preload}}", PARTS.get("preload-" + name, ""))
    html = html.replace('href="{{root}}"', 'href="%s"' % (root or "./"))
    html = html.replace("{{root}}", root)
    out = ROOT / path.strip("/") / "index.html" if depth else ROOT / "index.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf-8")
    return out, html


def main():
    check = "--check" in sys.argv
    only = sys.argv[sys.argv.index("--only") + 1] if "--only" in sys.argv else None
    bad = []
    for page in sorted((SRC / "pages").glob("*.html")):
        if only and page.stem != only:
            continue
        if page.stem.startswith("_"):
            continue
        out, html = render(page.stem)
        print("wrote", out.relative_to(ROOT))
        if check:
            if re.search(r"\{\{[a-z]+\}\}", html):
                bad.append(f"{out}: unreplaced placeholder")
            visible = re.sub(r"<script.*?</script>|<style.*?</style>|<!--.*?-->", "", html, flags=re.S)
            for ch in ("—", "–"):
                if ch in visible:
                    bad.append(f"{out}: contains {'em' if ch == chr(0x2014) else 'en'} dash")
    if bad:
        print("\n".join(bad)); sys.exit(1)


if __name__ == "__main__":
    main()
