import pathlib,re,sys
bad=re.compile(r"—|seamless|elevate|unlock|delve|tapestry|testament|bespoke|leverag|game-?changer|streamlin|effortless|revolutioni|cutting-edge|empower|in today.s|ever-evolving|nestled|reimagin|supercharge|next level|look no further|holistic|synerg|dive into|hassle-free|state-of-the-art|world-class|all-in-one|at a glance|peace of mind|whether you|not just|more than just",re.I)
root=pathlib.Path('/home/asuka/Documents/portfolio/works')
dirs=sys.argv[1:] or [d.name for d in root.iterdir() if d.is_dir()]
n=0
for d in dirs:
    for p in (root/d).rglob('*'):
        if p.suffix in('.html','.js') and 'qrcode' not in p.name:
            for i,l in enumerate(p.read_text().split('\n'),1):
                for m in bad.finditer(l): print(f"{p.relative_to(root)}:{i}: {m.group(0)}: ...{l[max(0,m.start()-30):m.end()+30]}");n+=1
print("lint hits:",n)
