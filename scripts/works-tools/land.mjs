import {start,R} from "./lib.mjs";
const slug=process.argv[2];const {b,errs,page,T}=await start();
try{const p=await page(R+slug+"/index.html",{width:1280,height:900});await T(600);await p.screenshot({path:`land-${slug}.png`,fullPage:true});console.log("errors:",errs.length?errs:"none")}finally{await b.close()}
