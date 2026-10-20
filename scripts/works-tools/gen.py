import json,sys,pathlib,html
W=pathlib.Path('/home/asuka/Documents/portfolio/works')
S=pathlib.Path(__file__).parent/'specs'
def h(s): return s  # specs already contain HTML-safe text
def app(sp):
    nav=''
    for grp,items in sp['nav']:
        nav+=f'\n\t\t<div class="grp">{grp}</div>'+''.join(f'<a class="nv" data-route="{r}" href="#{r}">{ic} {l}{" <span class=\"n\" id=\"n-"+r+"\">0</span>" if b else ""}</a>' for r,l,ic,*rest in items for b in [rest[0] if rest else 0])
    extra=''.join(f'<script src="{x}"></script>\n' for x in sp.get('libs',[]))
    inputs=sp.get('search','')
    s=f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>{sp['name']} | {sp['appTitle']} (demo)</title>
<meta name="robots" content="noindex" />
<link rel="stylesheet" href="../lib/app.css" />
<style>:root{{--acc:{sp['color']};--acc-ink:{sp.get('ink','#fff')};--acc-soft:{sp['soft']};--side:{sp.get('side','#0f1630')}}}</style>
</head>
<body>
<div class="shell">
	<aside class="side">
		<a class="brand" href="index.html"><i>{sp['icon']}</i><span>{sp['name']}<small id="biz">{sp['biz']}</small></span></a>{nav}
		<div class="sp"></div><a class="nv" href="index.html">← About {sp['name']}</a>
	</aside>
	<div class="main">
		<header class="top"><button class="burger" id="burger" aria-label="Menu">☰</button><h1 id="title">{sp['nav'][0][1][0][1]}</h1><span class="sp"></span>{inputs}<button class="btn sm" id="theme" aria-label="Toggle theme">◐</button></header>
		<div class="view" id="view"></div>
	</div>
</div>
<script src="../lib/ui.js"></script>
<script src="../lib/ui2.js"></script>
{extra}<script src="js/app.js"></script>
<script src="../shared.js" defer></script>
</body>
</html>
'''
    (W/sp['slug']/'app.html').write_text(s)
def landing(sp):
    L=sp['land']
    feats=''.join(f'<div class="feat"><div class="ic">.</div><h3>{a}</h3><p>{b}</p></div>' for a,b in L['features'])
    who=''.join(f'<span>{x}</span>' for x in L['who'])
    splits=''
    for i,(ey,h2,p,lis,btn,href,img,alt) in enumerate(L['splits']):
        splits+=f'<div class="split{" rev" if i%2 else ""}"{" style=\"margin-bottom:70px\"" if i<len(L["splits"])-1 else ""}><div><span class="eyebrow">{ey}</span><h2>{h2}</h2><p>{p}</p><ul>{"".join("<li>"+x+"</li>" for x in lis)}</ul><a class="btn pri" href="{href}">{btn}</a></div><div class="frame"><div class="bar"><i></i><i></i><i></i></div><img src="img/{img}.jpg" alt="{alt}" loading="lazy"></div></div>\n'
    steps=''.join(f'<div class="step"><h3>{a}</h3><p>{b}</p></div>' for a,b in L['steps'])
    stats=''.join(f'<div><b>{a}</b><span>{b}</span></div>' for a,b in L['stats'])
    plans=''
    for n,p,per,lis,btn,href,hot in L['plans']:
        plans+=f'<div class="plan{" hot" if hot else ""}">{"<span class=\"tg\">Most popular</span>" if hot else ""}<h3>{n}</h3><div class="p">{p} <small>{per}</small></div><ul>{"".join("<li>"+x+"</li>" for x in lis)}</ul><a class="btn{" pri" if hot else ""}" href="{href}">{btn}</a></div>'
    faq=''.join(f'<details><summary>{q}</summary><p>{a}</p></details>' for q,a in L['faq'])
    s=f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>{sp['name']} | {L['title']}</title>
<meta name="description" content="{L['desc']}" />
<link rel="stylesheet" href="../lib/landing.css" />
</head>
<body style="--acc:{sp['color']};--acc-ink:{sp.get('ink','#fff')};--acc-soft:{sp['soft']};--dark:{sp.get('dark','#0f1840')}">
<header class="nav"><div class="wrap"><a class="logo" href="index.html"><i>{sp['icon']}</i>{sp['name']}</a><nav class="links"><a href="#features">Features</a><a href="#how">How it works</a><a href="#pricing">Pricing</a><a href="#faq">FAQ</a></nav><a class="btn pri sm" href="app.html">Open live demo</a></div></header>
<section class="hero"><div class="wrap"><div class="copy"><span class="tag">{L['tag']}</span><h1>{L['h1']}</h1><p class="lead">{L['lead']}</p><div class="acts"><a class="btn pri lg" href="{L['cta1'][1]}">{L['cta1'][0]}</a><a class="btn lg" href="{L['cta2'][1]}">{L['cta2'][0]}</a></div><div class="proof">{''.join('<span>'+x+'</span>' for x in L['proof'])}</div></div>
<div class="frame"><div class="bar"><i></i><i></i><i></i><span>{L['url']}</span></div><img src="img/{L['hero']}.jpg" alt="{L['heroAlt']}" fetchpriority="high"></div></div></section>
<section class="who"><div class="wrap"><b>Made for</b>{who}</div></section>
<section class="sec" id="features"><div class="wrap"><div class="sec-h"><span class="eyebrow">{L['fEyebrow']}</span><h2>{L['fH2']}</h2></div><div class="feats">
{feats}</div></div></section>
<section class="sec alt"><div class="wrap">
{splits}</div></section>
<section class="sec" id="how"><div class="wrap"><div class="sec-h"><span class="eyebrow">{L['hEyebrow']}</span><h2>How it works</h2></div><div class="steps">{steps}</div></div></section>
<section class="sec dark"><div class="wrap"><div class="stats">{stats}</div></div></section>
<section class="sec" id="pricing"><div class="wrap"><div class="sec-h"><span class="eyebrow">Pricing</span><h2>{L['pH2']}</h2><p>Sample pricing for this concept build.</p></div><div class="plans">{plans}</div></div></section>
<section class="sec alt" id="faq"><div class="wrap" style="max-width:820px"><div class="sec-h"><h2>Questions</h2></div>{faq}</div></section>
<section class="cta"><div class="wrap"><h2>{L['ctaH']}</h2><p>{L['ctaP']}</p><a class="btn lg" href="{L['cta1'][1]}">{L['ctaBtn']}</a></div></section>
<footer class="foot"><div class="wrap"><span>© {sp['name']}, a concept build by Suryansh Kapil. Fictional product; sample data.</span><a href="../index.html">← All works</a></div></footer>
<script src="../lib/landing-fx.js" defer></script>
<script src="../shared.js" defer></script>
</body>
</html>
'''
    (W/sp['slug']/'index.html').write_text(s)
if __name__=='__main__':
    for slug in sys.argv[1:]:
        sp=json.loads((S/(slug+'.json')).read_text())
        if (S/(slug+'.land.json')).exists(): sp['land']=json.loads((S/(slug+'.land.json')).read_text())
        (W/slug/'js').mkdir(parents=True,exist_ok=True);(W/slug/'img').mkdir(exist_ok=True)
        if not sp.get('noapp'): app(sp)
        if 'land' in sp: landing(sp)
        print('ok',slug)
