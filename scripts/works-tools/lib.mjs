import puppeteer from "puppeteer-core";
export const R="file:///home/asuka/Documents/portfolio/works/";
export async function start(){const b=await puppeteer.launch({executablePath:"/usr/bin/google-chrome-stable",headless:"new",args:["--no-sandbox"]});const errs=[];
 async function page(url,vp={width:1280,height:900}){const p=await b.newPage();await p.setViewport(vp);
  p.on("pageerror",e=>errs.push(url.split("works/")[1]+" PAGEERR "+e.message));
  p.on("console",m=>{if(m.type()==="error")errs.push(url.split("works/")[1]+" console "+m.text())});
  p.on("response",r=>{if(r.status()>=400)errs.push(url.split("works/")[1]+" HTTP "+r.status()+" "+r.url())});
  p.on("requestfailed",r=>{errs.push(url.split("works/")[1]+" REQFAIL "+r.url())});
  p.on("dialog",d=>{errs.push("DIALOG "+d.message());d.dismiss()});
  await p.goto(url);return p}
 return {b,errs,page,T:(ms)=>new Promise(r=>setTimeout(r,ms))}}
