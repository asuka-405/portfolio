import re,json,pathlib,subprocess,html
W=pathlib.Path('/home/asuka/Documents/portfolio/works');S=pathlib.Path(__file__).parent
ICONS=json.loads((S/'icons.json').read_text())
base=(S/'works_index_base.html').read_text()
new=json.loads((S/'works_new.json').read_text())
COL={'brew-and-bean':'#8a5a3c','fitforge':'#6aa80f','lumen-dental':'#0e7490','harbor-realty':'#a47a32','kiln-and-clay':'#b4573a','stockpulse':'#0f9b6e','queuelite':'#6c47ff','shiftboard':'#0f766e','salesboard':'#3b82f6','fixtrack':'#e11d48','givetrack':'#d97706','leadnest':'#7c3aed','filepilot':'#0f766e','invoicekit':'#3b5bdb','orderlink':'#1fa855','lendwise':'#2563eb','counterpos':'#ea580c','khatalite':'#0e7490','tabletap':'#c2410c','salondesk':'#db2777','schooldesk':'#7c3aed','coachdesk':'#2563eb','paydesk':'#0d9488','clinicdesk':'#0369a1','rentdesk':'#4f46e5','societyhub':'#0f766e'}
SECT={'brew-and-bean':'Food','fitforge':'Health','lumen-dental':'Health','harbor-realty':'Property','kiln-and-clay':'Shops','stockpulse':'Shops','queuelite':'Services','shiftboard':'Services','salesboard':'Shops','invoicekit':'Services','orderlink':'Food','lendwise':'Finance'}
# products: parse old cards from the pristine base
P=[]
for c in re.findall(r'<article class="work-card.*?</article>',base,re.S):
    g=lambda p:re.search(p,c,re.S).group(1)
    slug=g(r'href="([a-z-]+)/index.html"');t=g(r'data-type="(\w+)"')
    subs=re.findall(r'<a class="work-sub" href="([^"]+)">([^<]+)</a>',c)
    P.append(dict(slug=slug,name=g(r'<h3><a[^>]*>([^<]+)</a>'),type=t,sector=SECT[slug],ind=g(r'work-ind">([^<]*)'),screens=g(r'work-pages">([^<]*)'),desc=g(r'work-desc">([^<]*)'),chips=[html.unescape(x) for x in re.findall(r'chip chip--muted">([^<]*)',c)],subs=[[l,h.split('/',1)[1]] for h,l in subs],shot=None))
for n in new:
    n=dict(n);n['subs']=[list(x) for x in n['subs']];P.append(n)
SECT_HUE={'Shops':'#fa625f','Food':'#e8b84a','Health':'#3fc1b0','Education':'#8b7cf6','Property':'#6ea8fe','Services':'#c58af0','Finance':'#4cc38a','Non-profit':'#f08cb4'}
for p in P: p['color']=SECT_HUE[p['sector']]
ORDER=['counterpos','brew-and-bean','khatalite','tabletap','kiln-and-clay','salondesk','schooldesk','fitforge','paydesk','clinicdesk','lumen-dental','orderlink','rentdesk','harbor-realty','societyhub','coachdesk','stockpulse','invoicekit','queuelite','shiftboard','salesboard','lendwise']
P.sort(key=lambda p:ORDER.index(p['slug']) if p['slug'] in ORDER else 99+len(ORDER))
# thumbs for new products
for n in new:
    src=W/n['slug']/'img'/(n['shot']+'.jpg')
    if src.exists(): subprocess.run(['magick',str(src),'-gravity','NorthWest','-crop','1376x860+0+0','+repage','-resize','960x600','-quality','82',str(W/'img'/(n['slug']+'.jpg'))],check=True)
SIZES=['l', 't', 'w', 's', 'l', 's', 't', 'w', 'l', 't', 'l', 's', 'w', 'w', 's', 't', 'w', 's', 'w', 'l', 't', 's', 'l', 't', 's', 's']  # free mosaic on an 8-col grid (4 below 1000px, 2 below 560px), no gaps for 26 tiles; rerun a packing search when the count changes
def tag(p):
    d=html.unescape(p['desc']);m=re.split(r'[:.] ',d,1)[0];m=m if len(m)>24 else d
    return html.escape(m[:95]+('...' if len(m)>95 else ''))
tiles=[]
for i,p in enumerate(P):
    sz=SIZES[i%len(SIZES)];kind='Website' if p['type']=='Website' else 'App'
    info=json.dumps({'slug':p['slug'],'name':html.unescape(p['name']),'ind':html.unescape(p['ind']),'desc':html.unescape(p['desc']),'chips':p['chips'],'screens':p['screens'],'kind':kind,'subs':p['subs'],'color':p['color']})
    tiles.append(f'''<article class="tile {sz}" style="--c:{p['color']};--i:{i}" data-type="{p['type']}" data-sector="{p['sector']}" data-slug="{p['slug']}" tabindex="0" role="button" aria-label="{html.escape(html.unescape(p['name']))}, {html.escape(html.unescape(p['ind']))}"><div class="face"><span class="kt">{kind}</span><span class="go">{p['screens']} · open</span><span class="glyph"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{ICONS.get(p['slug'],'')}</svg></span><img class="pv" src="img/{p['slug']}.jpg" width="960" height="600" loading="lazy" alt=""><div class="txt"><b class="nm">{p['name']}</b><div class="ind">{p['ind']}</div></div></div><script type="application/json" class="info">{info}</script></article>''')
sect=['Shops','Food','Health','Education','Property','Services','Finance','Non-profit']
sl={'Shops':'Shops & retail','Food':'Food','Health':'Health & wellness','Education':'Education','Property':'Property','Services':'Offices & services','Finance':'Finance','Non-profit':'Non-profit'}
present=[s for s in sect if any(p['sector']==s for p in P)]
def pages(slug):
    d=W/slug;h=len(list(d.glob('*.html')));a=d/'app.html';r=len(re.findall('data-route=',a.read_text())) if a.exists() else 0;return h+r
screens=sum(pages(p['slug']) for p in P)//10*10
def has(slug,pat):
    return any(re.search(pat,f.read_text(errors='ignore')) for f in (W/slug).rglob('*') if f.suffix in('.html','.js'))
nupi=sum(has(p['slug'],r'upi://|wa\.me|UI\.wa\(|UI\.upi\(') for p in P)
ngst=sum(has(p['slug'],r'GST') for p in P)
nprint=sum(has(p['slug'],r'UI\.print|window\.print|@media print') for p in P)
pre=base.split('<main>')[0].replace('<link rel="stylesheet" href="../styles.css" />','<link rel="stylesheet" href="../styles.css" />\n\t\t<link rel="stylesheet" href="works.css" />')
post='</main>'+base.split('</main>')[1].split('<script src="../app.js" defer></script>')[0]
main=f'''<main class="wk">
\t\t\t<section class="wk-hero">
\t\t\t\t<p class="eyebrow">Works · {len(P)} products</p>
\t\t\t\t<h1 class="wk-title">Websites &amp; <span class="text-accent">business apps</span></h1>
\t\t\t\t<p class="lead">Working demos for shops, restaurants, salons, schools, clinics and offices. Open any tile to try it with real flows, an admin side and a landing page.</p>
\t\t\t\t<ul class="hero-facts"><li><span class="k">Demos</span><span class="v"><b>{len(P)}</b> websites and apps</span></li><li><span class="k">Covers</span><span class="v"><b>{len(present)}</b> kinds of business</span></li><li><span class="k">To try</span><span class="v"><b>0</b> sign-ups, nothing to install</span></li></ul>
\t\t\t\t<p class="wk-note"><strong>Honest label:</strong> concept builds for sample businesses. Brands, people and data are fictional, photos are from Unsplash, and nothing here is client work. Demos save to your browser; a live build adds a database and logins.</p>
\t\t\t</section>
\t\t\t<div class="wk-pivot"><div class="row1" id="wk-type"><button class="on" data-type="">All</button><button data-type="Website">Websites</button><button data-type="App">Apps</button></div><div class="row2" id="wk-sector"><button class="on" data-sector="">Any business</button>{''.join(f'<button data-sector="{s}">{html.escape(sl[s])}</button>' for s in present)}</div></div>
\t\t\t<section class="mosaic" id="mosaic" aria-label="Projects" data-legend="All demos">
{chr(10).join(tiles)}
\t\t\t</section>
\t\t\t<div class="wk-foot">
\t\t\t\t<p class="wk-credit">Photography on the website demos: <a href="https://unsplash.com" target="_blank" rel="noopener">Unsplash</a>. All brands and data are fictional.</p>
\t\t\t\t<section class="section works-cta" style="padding-left:0;padding-right:0"><div class="setup-card reveal in"><div><p class="section-eyebrow">Work with me</p><h3>Want one of these for your business?</h3><p>Tell me what you run and what is slowing you down. I will reply with a plain-language plan, a fixed scope and a price, usually within a day. Everything here can be rebranded, connected to your real data and taken live.</p><div class="setup-actions"><a class="btn btn--primary" href="mailto:suryansh@archdev.in?subject=Project%20enquiry">Email me</a><a class="btn btn--ghost" href="../index.html#contact">Use the contact form</a></div></div></div></section>
\t\t\t</div>
\t\t\t<div class="wk-dim" id="wk-dim"></div>
\t\t\t<aside class="wk-drawer" id="wk-drawer" aria-hidden="true" aria-label="Project details"><button class="wk-x" id="wk-x" aria-label="Close">✕</button><div class="shot" id="d-shot"></div><div class="body"><div class="ind" id="d-ind"></div><h2 id="d-name"></h2><p id="d-desc"></p><div class="chips" id="d-chips"></div><div class="acts" id="d-acts"></div><p class="wk-credit" id="d-meta"></p></div><div class="nav"><button id="d-prev">← Previous</button><button id="d-next">Next →</button></div></aside>
\t\t</main>'''
js='''<script src="../app.js" defer></script>
		<script src="fx.js" defer></script>
\t\t<script>
\t\t\t(function () {
\t\t\t\tvar tiles = [].slice.call(document.querySelectorAll(".tile")), type = "", sector = "", D = document.getElementById("wk-drawer"), dim = document.getElementById("wk-dim"), cur = -1;
\t\t\t\tvar info = tiles.map(function (t) { return JSON.parse(t.querySelector(".info").textContent); });
\t\t\t\tfunction apply() { var n = 0; tiles.forEach(function (t) { var hide = (type && t.dataset.type !== type) || (sector && t.dataset.sector !== sector); t.hidden = hide; if (!hide) { t.style.setProperty("--i", n++); t.style.animation = "none"; t.offsetWidth; t.style.animation = ""; } }); }
\t\t\t\t[["wk-type", "type"], ["wk-sector", "sector"]].forEach(function (g) { var bar = document.getElementById(g[0]); bar.addEventListener("click", function (e) { var b = e.target.closest("button"); if (!b) return; bar.querySelectorAll("button").forEach(function (x) { x.classList.toggle("on", x === b); }); if (g[1] === "type") type = b.dataset.type; else sector = b.dataset.sector; apply(); }); });
\t\t\t\tfunction esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
\t\t\t\tfunction open(i) { cur = i; var d = info[i]; D.style.setProperty("--c", d.color); document.getElementById("d-shot").style.backgroundImage = "url(img/" + d.slug + ".jpg)"; document.getElementById("d-ind").textContent = d.kind + " · " + d.ind; document.getElementById("d-name").innerHTML = esc(d.name); document.getElementById("d-desc").textContent = d.desc; document.getElementById("d-chips").innerHTML = d.chips.map(function (c) { return "<span>" + esc(c) + "</span>"; }).join(""); document.getElementById("d-acts").innerHTML = '<a class="main" href="' + d.slug + '/index.html">Open live demo →</a>' + d.subs.map(function (s) { return '<a href="' + d.slug + "/" + s[1] + '">' + esc(s[0]) + "</a>"; }).join(""); document.getElementById("d-meta").textContent = d.screens + ". Concept build with sample data."; D.classList.add("on"); dim.classList.add("on"); D.setAttribute("aria-hidden", "false"); history.replaceState(null, "", "#" + d.slug); }
\t\t\t\tfunction close() { D.classList.remove("on"); dim.classList.remove("on"); D.setAttribute("aria-hidden", "true"); history.replaceState(null, "", location.pathname); cur = -1; }
\t\t\t\tfunction step(n) { var vis = tiles.filter(function (t) { return !t.hidden; }), at = vis.indexOf(tiles[cur]); if (at < 0) return; open(tiles.indexOf(vis[(at + n + vis.length) % vis.length])); }
\t\t\t\ttiles.forEach(function (t, i) { t.addEventListener("click", function () { open(i); }); t.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(i); } }); });
\t\t\t\tdim.onclick = close; document.getElementById("wk-x").onclick = close; document.getElementById("d-prev").onclick = function () { step(-1); }; document.getElementById("d-next").onclick = function () { step(1); };
\t\t\t\tdocument.addEventListener("keydown", function (e) { if (cur < 0) return; if (e.key === "Escape") close(); if (e.key === "ArrowRight") step(1); if (e.key === "ArrowLeft") step(-1); });
\t\t\t\tvar h = location.hash.slice(1); if (h) { var k = info.findIndex(function (x) { return x.slug === h; }); if (k >= 0) open(k); }
\t\t\t\tif (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) setInterval(function () { var vis = tiles.filter(function (t) { return !t.hidden && !t.matches(":hover") && !t.classList.contains("flip"); }); if (!vis.length || document.querySelectorAll(".tile.flip").length > 3 || cur >= 0) return; var t = vis[Math.floor(Math.random() * vis.length)]; t.classList.add("flip"); setTimeout(function () { t.classList.remove("flip"); }, 3200); }, 1300);
\t\t\t\tvar y = document.getElementById("year"); if (y) y.textContent = new Date().getFullYear();
\t\t\t})();
\t\t</script>
\t</body>
</html>
'''
(W/'index.html').write_text(pre+main+post+js)
print(len(P),'products',screens,'screens',present)
