"""Responsive layout audit: all published HTML, with local overflow/overlap checks.

python tools/test_responsive_layout.py --serve --output <temporary-directory>
Use --engine chromium or webkit for an individual engine. No forms are submitted.
The JSON retains all raw findings; known closed/animated elements are excluded below.
"""

import argparse
import json
import pathlib
import runpy
import re
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
MATRIX = [
    (320, 568),
    (375, 667),
    (390, 844),
    (430, 932),
    (667, 375),
    (768, 1024),
    (810, 1080),
    (820, 1180),
    (834, 1194),
    (1024, 768),
    (1080, 810),
    (1180, 820),
    (1194, 834),
    (1024, 1366),
    (1366, 1024),
    (1280, 800),
    (1440, 900),
    (1920, 1080),
]
SCAN = r"""() => {
const W=document.documentElement.clientWidth, H=innerHeight;
const sel=e=>e.id?'#'+e.id:e.tagName.toLowerCase()+[...e.classList].slice(0,3).map(c=>'.'+c).join('');
const visible=e=>{for(let a=e;a;a=a.parentElement){let ac=getComputedStyle(a);if(ac.visibility!=='visible'||+ac.opacity<.05)return false;}let c=getComputedStyle(e),r=e.getBoundingClientRect();return r.width>0&&r.height>0&&c.visibility==='visible'&&+c.opacity>.05&&!e.closest('[hidden],[aria-hidden="true"]');};
const box=e=>{let r=e.getBoundingClientRect();return [r.x,r.y,r.width,r.height].map(v=>Math.round(v*10)/10);};
const scrollParent=e=>{for(let a=e.parentElement;a&&a!==document.body;a=a.parentElement){if(/auto|scroll/.test(getComputedStyle(a).overflowX)&&a.scrollWidth>a.clientWidth+2)return sel(a)}return null;};
let out=[], clip=[], trunc=[], errors=[];
for(const e of document.querySelectorAll('h1,h2,h3,h4,p,a,button,label,input,select,textarea,th,td,figcaption,summary')){
 if(!visible(e)||e.closest('nav:not(.open) .bm-nav-megamenu,nav:not(.open) .bm-nav-dropdown-menu,.bm-fab,.bm-hero-works-bg,.bm-client-logo-item,.client-logo-item,.lpv2-sr-only,[aria-hidden="true"]'))continue;
 let r=e.getBoundingClientRect(),c=getComputedStyle(e),text=(e.innerText||e.value||'').replace(/\s+/g,' ').slice(0,90);
 if((r.left< -2||r.right>W+2)&&!scrollParent(e))out.push({s:sel(e),box:box(e),text});
 if(e.childElementCount===0&&e.scrollWidth>e.clientWidth+3&&e.clientWidth>0&&c.overflowX==='hidden'&&c.textOverflow!=='ellipsis')trunc.push({s:sel(e),box:box(e),text,sw:e.scrollWidth});
 for(const n of e.childNodes){
  if(n.nodeType!==3||!n.textContent.trim())continue;
  let range=document.createRange();range.selectNodeContents(n);
  for(const rr of range.getClientRects()){
   if(rr.width<1||rr.height<1)continue;
   let clipped=false;
   for(let a=e;a&&a!==document.body&&a!==document.documentElement;a=a.parentElement){
    let ac=getComputedStyle(a),ar=a.getBoundingClientRect();
    if(ac.visibility!=='visible'||+ac.opacity<.05){clipped=true;break;}
    if((ac.overflowX==='hidden'||ac.overflowX==='clip')&&(rr.left<ar.left-3||rr.right>ar.right+3)||
       (ac.overflowY==='hidden'||ac.overflowY==='clip')&&(rr.top<ar.top-3||rr.bottom>ar.bottom+3)){
     if(!e.closest('.bm-cta-tooltip,.bm-fab')&&ac.webkitLineClamp==='none'&&ac.textOverflow!=='ellipsis')clip.push({s:sel(e),parent:sel(a),text,box:box(e),parentBox:box(a)});
     clipped=true;break;
    }
   }
   if(!clipped&&(rr.left< -2||rr.right>W+2)&&!scrollParent(e))out.push({s:sel(e)+'::text',box:[rr.x,rr.y,rr.width,rr.height].map(v=>Math.round(v*10)/10),text});
  }
 }
}
let header={}, overlaps=[];
for(let s of ['.bm-header','.bm-logo','.bm-nav','.bm-header-right','.bm-nav-cta','.bm-hamburger']){
 let e=document.querySelector(s);if(e)header[s]={box:box(e),display:getComputedStyle(e).display,flex:getComputedStyle(e).flex};
}
let buttons=[...document.querySelectorAll('#bmNav > .bm-nav-link,#bmNav > .bm-nav-dropdown > .bm-nav-link,.bm-header-right > .bm-nav-cta,.bm-header-right .bm-cta-icon > a')].filter(visible);
for(let i=0;i<buttons.length;i++)for(let j=i+1;j<buttons.length;j++){let a=buttons[i].getBoundingClientRect(),b=buttons[j].getBoundingClientRect();if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>2&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>2)overlaps.push([buttons[i].innerText,buttons[j].innerText,box(buttons[i]),box(buttons[j])]);}
let imgs=[...document.images].filter(e=>visible(e)&&e.complete&&!e.naturalWidth&&!e.src.startsWith('data:')).map(e=>({s:sel(e),src:e.src}));
const uniq=a=>[...new Map(a.map(v=>[v.s+'|'+(v.parent||'')+'|'+v.text,v])).values()];
return {w:W,h:H,scrollW:document.documentElement.scrollWidth,bodyW:document.body.scrollWidth,height:document.documentElement.scrollHeight,header,overlaps,out:uniq(out),clip:uniq(clip),trunc:uniq(trunc),brokenImages:imgs.slice(0,20)};
}"""


def violations(result):
    bad = [{"kind": "header-overlap", "detail": x} for x in result["overlaps"]]
    if result["scrollW"] > result["w"] + 2:
        bad.append({"kind": "page-horizontal-overflow", "detail": result["scrollW"]})
    bad += [{"kind": "horizontal-overflow", "detail": x} for x in result["out"]]
    for x in result["clip"]:
        # The closed FAQ answer is intentionally height zero.
        if x["parent"].startswith("#faqA") and x["parentBox"][3] == 0:
            continue
        if x["s"] == "p.lpv2-sr-only":
            continue
        bad.append({"kind": "text-clipped", "detail": x})
    return bad


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--base", default="http://127.0.0.1:5500")
    ap.add_argument("--serve", action="store_true")
    ap.add_argument("--engine", choices=["chromium", "webkit", "both"], default="both")
    ap.add_argument("--output", type=pathlib.Path, required=True)
    ap.add_argument(
        "--pages",
        nargs="*",
        help="Relative HTML filenames; default is every published HTML",
    )
    args = ap.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    server = (
        runpy.run_path(str(ROOT / "tools/smoke-manga-wp.py"))["start_server"](
            str(ROOT), 5500
        )
        if args.serve
        else None
    )
    files = (
        [ROOT / x for x in args.pages]
        if args.pages
        else sorted(
            [
                *ROOT.glob("*.html"),
                *ROOT.joinpath("column").glob("*.html"),
                *ROOT.joinpath("works").rglob("*.html"),
            ]
        )
    )
    failures = []
    records = []
    try:
        with sync_playwright() as p:
            for engine in (
                ["chromium", "webkit"] if args.engine == "both" else [args.engine]
            ):
                browser = getattr(p, engine).launch(headless=True)
                context = browser.new_context(
                    ignore_https_errors=True, service_workers="block"
                )

                def guard(route):
                    if (
                        route.request.method not in ["GET", "HEAD"]
                        or route.request.url.startswith("https://")
                        and re.search(
                            r"google(tagmanager|adservices|ads|analytics)|clarity\.ms|hubspot|hs-scripts|hs-analytics|doubleclick",
                            route.request.url,
                        )
                    ):
                        route.abort()
                    else:
                        route.continue_()

                context.route("**/*", guard)
                page = context.new_page()
                sizes = (
                    MATRIX
                    if engine == "chromium"
                    else [(390, 844), (820, 1180), (1180, 820), (1440, 900)]
                )
                for n, f in enumerate(files):
                    name = f.relative_to(ROOT).as_posix()
                    try:
                        page.goto(
                            args.base + "/" + name, wait_until="load", timeout=45000
                        )
                        if name == "column/index.html":
                            page.wait_for_url(re.compile(r"/column(?:\.html)?$"))
                            page.wait_for_load_state("load")
                        page.evaluate("document.fonts.ready")
                        # Trigger each section rather than jumping over short sections.
                        page.evaluate(
                            """async()=>{for(const e of document.querySelectorAll('main section')){e.scrollIntoView({behavior:'instant'});await new Promise(r=>setTimeout(r,30));}window.scrollTo({top:0,left:0,behavior:'instant'});}"""
                        )
                        page.wait_for_timeout(2800 if f.parent == ROOT else 300)
                        for w, h in sizes:
                            page.set_viewport_size({"width": w, "height": h})
                            page.evaluate(
                                "window.scrollTo({top:0,left:0,behavior:'instant'})"
                            )
                            page.wait_for_timeout(200)
                            result = page.evaluate(SCAN)
                            result.update(page=name, engine=engine, viewport=[w, h])
                            problems = violations(result)
                            if problems:
                                # Scroll-triggered entrance transforms must finish before classifying overflow.
                                for item in result["out"]:
                                    sel = item["s"].replace("::text", "")
                                    try:
                                        page.locator(sel).first.evaluate(
                                            "e=>e.scrollIntoView({behavior:'instant'})"
                                        )
                                    except Exception:
                                        pass
                                page.wait_for_timeout(1500)
                                page.evaluate(
                                    "window.scrollTo({top:0,left:0,behavior:'instant'})"
                                )
                                result = page.evaluate(SCAN)
                                result.update(page=name, engine=engine, viewport=[w, h])
                                problems = violations(result)
                            records.append(result)
                            if problems:
                                failures.append(
                                    {
                                        "page": name,
                                        "engine": engine,
                                        "viewport": [w, h],
                                        "problems": problems,
                                    }
                                )
                                page.screenshot(
                                    path=str(
                                        args.output
                                        / (
                                            engine
                                            + "-"
                                            + name.replace("/", "_")
                                            + f"-{w}.png"
                                        )
                                    ),
                                    animations="disabled",
                                )
                        print(f"{engine} {n + 1}/{len(files)} {name}", flush=True)
                    except Exception as e:
                        failures.append(
                            {"page": name, "engine": engine, "error": str(e)}
                        )
                        print("ERROR", name, str(e)[:150], flush=True)
                    (args.output / "results.json").write_text(
                        json.dumps(records, ensure_ascii=False, indent=2),
                        encoding="utf8",
                    )
                    (args.output / "failures.json").write_text(
                        json.dumps(failures, ensure_ascii=False, indent=2),
                        encoding="utf8",
                    )
                browser.close()
    finally:
        if server:
            server.shutdown()
    print(f"COMPLETE: {len(records)} viewports / {len(failures)} findings", flush=True)
    return bool(failures)


if __name__ == "__main__":
    raise SystemExit(main())
