"""Tiny SVG diagram builder for the field guide.

Draws boxes, groups, arrows and labels as inline SVG that is styled by the site's own CSS
(`svg.sd` rules in styles.css), so diagrams follow the light and dark themes.
Coordinates are in a 0..W by 0..H viewBox. Keep W near 820 so text stays readable.
"""
from html import escape

CW = 0.57

KIND = {
    "": ("--sd-f0", "--text", 0.32),
    "accent": ("--sd-fa", "--accent", 0.7),
    "gold": ("--sd-fg", "--gold", 0.7),
    "teal": ("--sd-ft", "--teal", 0.7),
    "blue": ("--sd-fb", "--blue", 0.7),
    "violet": ("--sd-fv", "--violet", 0.7),
    "green": ("--sd-fn", "--green", 0.7),
    "ghost": (None, "--text", 0.34),
}


LINE = {"": ("--text", 0.6), "accent": ("--accent", 1), "gold": ("--gold", 1), "teal": ("--teal", 1)}


def mk_style(kind):
    col, op = LINE.get(kind, LINE[""])
    return f"fill:var({col});fill-opacity:{op}"


def shape_style(kind):
    """Inline paint for a box. Inline style wins over any stylesheet quirks."""
    k = kind.split()[0] if kind else ""
    fill, stroke, op = KIND.get(k, KIND[""])
    f = f"fill:var({fill});" if fill else "fill:none;stroke-dasharray:5 4;"
    return f"{f}stroke:var({stroke});stroke-opacity:{op};stroke-width:1.1"


LINE_ = {"": ("--text", 0.6), "accent": ("--accent", 1), "gold": ("--gold", 1), "teal": ("--teal", 1)}
  # average character width as a fraction of font size


def wrap(text, width, size=10.5):
    """Greedy word wrap for a given pixel width."""
    maxc = max(4, int(width / (size * CW)))
    lines, cur = [], ""
    for word in str(text).split(" "):
        if not cur:
            cur = word
        elif len(cur) + 1 + len(word) <= maxc:
            cur += " " + word
        else:
            lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    return lines


class D:
    def __init__(self, name, w, h, title, desc=""):
        self.name, self.w, self.h = name, w, h
        self.title, self.desc = title, desc
        self.parts = []
        self.markers = set()

    # ---- primitives -------------------------------------------------
    def add(self, s):
        self.parts.append(s)

    def text(self, x, y, s, cls="s", anchor="middle", lh=13):
        s = str(s)
        lines = s.split("\n")
        for i, ln in enumerate(lines):
            self.add(f'<text class="{cls}" x="{x}" y="{y + i * lh}" text-anchor="{anchor}">{escape(ln)}</text>')

    def rect(self, x, y, w, h, kind="", cls="box"):
        self.add(f'<rect class="{cls} {kind}" x="{x}" y="{y}" width="{w}" height="{h}" style="{shape_style(kind)}"/>')

    def group(self, x, y, w, h, label=None, kind=""):
        col, op = {"accent": ("--accent", 0.6), "gold": ("--gold", 0.65), "teal": ("--teal", 0.65)}.get(kind, ("--text", 0.28))
        self.add(f'<rect class="grp {kind}" x="{x}" y="{y}" width="{w}" height="{h}" style="fill:none;stroke:var({col});stroke-opacity:{op};stroke-dasharray:6 4"/>')
        if label:
            self.add(f'<text class="h" x="{x + 10}" y="{y + 15}" text-anchor="start">{escape(label)}</text>')

    def box(self, x, y, w, h, title, sub=None, kind="", tag=None, align="middle"):
        """Box with title, optional wrapped sub text, optional mono tag. Returns (x, y, w, h)."""
        self.rect(x, y, w, h, kind)
        tl = wrap(title, w - 16, 13)
        sl = wrap(sub, w - 16, 11) if sub else []
        total = len(tl) * 15 + len(sl) * 13 + (13 if tag else 0)
        if total > h - 6:
            print(f'WARN {self.name}: box {title!r} needs {total + 6}px, has {h}')
        cy = y + (h - total) / 2 + 11
        cx = x + w / 2 if align == "middle" else x + 10
        a = align
        for ln in tl:
            self.add(f'<text class="t" x="{cx}" y="{cy:.1f}" text-anchor="{a}">{escape(ln)}</text>')
            cy += 15
        for ln in sl:
            self.add(f'<text class="s" x="{cx}" y="{cy:.1f}" text-anchor="{a}">{escape(ln)}</text>')
            cy += 13
        if tag:
            self.add(f'<text class="m" x="{cx}" y="{cy:.1f}" text-anchor="{a}">{escape(tag)}</text>')
        return (x, y, w, h)

    def cyl(self, x, y, w, h, title, sub=None, kind=""):
        r = 7
        self.add(
            f'<path class="box {kind}" style="{shape_style(kind)}" d="M{x},{y + r} a{w / 2},{r} 0 0 1 {w},0 v{h - 2 * r} a{w / 2},{r} 0 0 1 -{w},0 z"/>'
            f'<path class="box {kind}" d="M{x},{y + r} a{w / 2},{r} 0 0 0 {w},0" style="{shape_style(kind)};fill:none"/>'
        )
        cy = y + r + 14
        for ln in wrap(title, w - 12, 12.5):
            self.add(f'<text class="t" x="{x + w / 2}" y="{cy}" text-anchor="middle">{escape(ln)}</text>')
            cy += 15
        if sub:
            for ln in wrap(sub, w - 12, 10.5):
                self.add(f'<text class="s" x="{x + w / 2}" y="{cy}" text-anchor="middle">{escape(ln)}</text>')
                cy += 13

    def diamond(self, cx, cy, w, h, label, kind="gold"):
        self.add(
            f'<polygon class="box {kind}" style="{shape_style(kind)}" points="{cx},{cy - h / 2} {cx + w / 2},{cy} {cx},{cy + h / 2} {cx - w / 2},{cy}"/>'
        )
        lines = wrap(label, w * 0.62, 10.5)
        y = cy - (len(lines) - 1) * 6 + 3.5
        for ln in lines:
            self.add(f'<text class="s" style="fill:var(--ink);font-weight:700" x="{cx}" y="{y:.1f}" text-anchor="middle">{escape(ln)}</text>')
            y += 12

    def chip(self, x, y, label, kind="", w=None):
        w = w or (len(label) * 6.1 + 16)
        self.add(f'<rect class="box {kind}" x="{x}" y="{y}" width="{w:.0f}" height="18" style="{shape_style(kind)}"/>')
        self.add(f'<text class="l" style="stroke:none;fill:var(--ink)" x="{x + w / 2:.1f}" y="{y + 12.5}" text-anchor="middle">{escape(label)}</text>')
        return w

    def badge(self, x, y, n):
        self.add(f'<circle class="badge" cx="{x}" cy="{y}" r="9"/><text class="badge-t" x="{x}" y="{y + 3.6}" text-anchor="middle">{n}</text>')

    # ---- arrows -----------------------------------------------------
    def _marker(self, kind):
        self.markers.add(kind)
        return f"{self.name}-ar{('-' + kind) if kind else ''}"

    def arrow(self, pts, kind="", dash=False, dot=False, both=False, label=None, lpos=None, plain=False, lanchor="middle"):
        d = "M" + " L".join(f"{x},{y}" for x, y in pts)
        cls = f"ln {kind} {'dash' if dash else ''} {'dot' if dot else ''}"
        col, op = LINE.get(kind, LINE[""])
        extra = "stroke-dasharray:5 4;" if dash else ("stroke-dasharray:1.5 4;stroke-linecap:round;" if dot else "")
        lstyle = f"fill:none;stroke:var({col});stroke-opacity:{op};stroke-width:{2 if dot else 1.4};{extra}"
        end = "" if plain else f' marker-end="url(#{self._marker(kind)})"'
        start = f' marker-start="url(#{self._marker(kind)}-s)"' if both else ""
        if both:
            self.markers.add(kind + "-s")
        self.add(f'<path class="{cls}" d="{d}" style="{lstyle}"{start}{end}/>')
        if label:
            if lpos is None:
                (x1, y1), (x2, y2) = pts[0], pts[-1]
                lpos = ((x1 + x2) / 2, (y1 + y2) / 2 - 5)
            self.add(f'<text class="l" x="{lpos[0]}" y="{lpos[1]}" text-anchor="{lanchor}">{escape(label)}</text>')

    def line(self, pts, kind="", dash=False):
        self.arrow(pts, kind=kind, dash=dash, plain=True)

    # ---- output -----------------------------------------------------
    def defs(self):
        out = []
        for k in sorted(self.markers):
            base = k[:-2] if k.endswith("-s") else k
            rev = k.endswith("-s")
            mid = f"{self.name}-ar{('-' + base) if base else ''}{'-s' if rev else ''}"
            if rev:
                out.append(
                    f'<marker id="{mid}" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="8" markerHeight="8" orient="auto">'
                    f'<path class="mk {base}" style="{mk_style(base)}" d="M10,0 L0,5 L10,10z"/></marker>'
                )
            else:
                out.append(
                    f'<marker id="{mid}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">'
                    f'<path class="mk {base}" style="{mk_style(base)}" d="M0,0 L10,5 L0,10z"/></marker>'
                )
        return "<defs>" + "".join(out) + "</defs>"

    def html(self, caption=None):
        svg = (
            f'<svg class="sd" viewBox="0 0 {self.w} {self.h}" role="img" aria-labelledby="{self.name}-t {self.name}-d" xmlns="http://www.w3.org/2000/svg">'
            f'<title id="{self.name}-t">{escape(self.title)}</title><desc id="{self.name}-d">{escape(self.desc or self.title)}</desc>'
            + self.defs()
            + "".join(self.parts)
            + "</svg>"
        )
        cap = f"<figcaption>{caption}</figcaption>" if caption else ""
        return (
            f"<!-- dgm:{self.name} -->\n"
            f'<figure class="sd-fig reveal"><div class="dgm-scroll">{svg}</div>{cap}</figure>'
        )


# ---- layout helpers ------------------------------------------------------
def L(b):
    return (b[0], b[1] + b[3] / 2)


def R(b):
    return (b[0] + b[2], b[1] + b[3] / 2)


def T(b):
    return (b[0] + b[2] / 2, b[1])


def B(b):
    return (b[0] + b[2] / 2, b[1] + b[3])


def row(d, x, y, specs, w, h, gap=26, arrows=True, akind="", labels=None):
    """Place boxes left to right. spec = (title, sub, kind[, tag]). Returns the box tuples."""
    out = []
    for i, sp in enumerate(specs):
        title, sub, kind = sp[0], sp[1], sp[2]
        tag = sp[3] if len(sp) > 3 else None
        bx = x + i * (w + gap)
        out.append(d.box(bx, y, w, h, title, sub, kind, tag))
    if arrows:
        for i in range(len(out) - 1):
            lab = labels[i] if labels and i < len(labels) else None
            a, b = R(out[i]), L(out[i + 1])
            d.arrow([a, b], akind, label=lab, lpos=((a[0] + b[0]) / 2, a[1] - 6))
    return out


def col(d, x, y, specs, w, h, gap=22, arrows=True, akind="", labels=None):
    out = []
    for i, sp in enumerate(specs):
        title, sub, kind = sp[0], sp[1], sp[2]
        tag = sp[3] if len(sp) > 3 else None
        by = y + i * (h + gap)
        out.append(d.box(x, by, w, h, title, sub, kind, tag))
    if arrows:
        for i in range(len(out) - 1):
            lab = labels[i] if labels and i < len(labels) else None
            a, b = B(out[i]), T(out[i + 1])
            d.arrow([a, b], akind, label=lab, lpos=(a[0] + 6, (a[1] + b[1]) / 2 + 3), lanchor="start")
    return out
