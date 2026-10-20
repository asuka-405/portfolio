import {start,R} from "./lib.mjs";import fs from "fs";
const slug=process.argv[2];const sp=JSON.parse(fs.readFileSync(`${process.argv[1].replace(/shots\.mjs$/,"")}specs/${slug}.shots.json`));
const {b,errs,page,T}=await start();
try{for(const s of sp){const p=await page(R+slug+"/"+(s.file||"app.html").replace(/\?.*/,"")+"?nopill"+((s.file||"").includes("?")?"&"+(s.file||"").split("?")[1]:"")+(s.route?"#"+s.route:""),{width:s.w||1440,height:s.h||860});
 if(s.pre){await p.evaluate(s.pre);await p.reload();}
 await T(500);if(s.js){await p.evaluate(s.js);await T(s.wait||400)}
 if(s.post){await p.evaluate(s.post);await T(300)}
 await p.screenshot({path:`/home/asuka/Documents/portfolio/works/${slug}/img/${s.name}.jpg`,type:"jpeg",quality:84});await p.close()}
 console.log("errors:",errs.length?errs:"none")}finally{await b.close()}
