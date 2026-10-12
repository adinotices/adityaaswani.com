// Font-size accessibility audit, run in a Steel cloud browser.
//
//   node fontaudit.mjs <config.mjs> <outDir> [--only=pageName,...] [--no-shots]
//
// config.mjs exports default { product, pages: [{ name, url | html, prepare?(page, ctx), dark?(page) , widths? }], bypassCSP? }
//   url      page to open (absolute)
//   html     path to a local HTML file (emails) loaded with page.setContent
//   prepare  async (page, { width }) => {}  runs after load (sign in, open a menu, start a test game ...)
//   dark     async (page) => {}  how to switch to dark mode if not prefers-color-scheme (return false to skip dark)
//   email    true for rendered emails: px sizes are expected there, so no fixed-px flag and no zoom checks
//   schemes  ["light"] to skip dark; widths ["phone"] to run one width
// Top-level options:
//   local    { origin: "https://example.org", dir: "/abs/dist", skip: /^\/api\// }  serve a local build for that
//            origin (requests whose file exists in dir), so a fix can be audited before it is deployed
//   exempt   [{ sel: "css selector", why: "reason" }]  matching text is recorded but not counted (logos, third-party
//            widgets ...); every exemption is listed with its reason in the report
//
// For each page at 390 px (phone) and 1280 px (desktop), light and dark, it walks every visible text node and
// records computed font-size, line-height, weight, letter-spacing, transform, colour, effective background,
// contrast ratio and role. Then it raises the browser default font size to 150% (CDP Page.setFontSizes) to find
// text set in fixed px, and lays the page out at 125% / 150% zoom (viewport / 1.25, / 1.5) and with the larger
// root size, checking horizontal overflow, clipped text and overlapping text. axe-core runs the related rules.
// Output: <outDir>/results.json and <outDir>/shots/*.jpg. Use report.mjs to turn before/after into markdown.
import puppeteer from "puppeteer-core";
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
require("dotenv").config({ path: "/home/admin/repos/sutam/.env", quiet: true });

const [cfgPath, outDir] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const only = (process.argv.find((a) => a.startsWith("--only=")) || "").slice(7).split(",").filter(Boolean);
const shots = !process.argv.includes("--no-shots");
if (!cfgPath || !outDir) { console.error("usage: node fontaudit.mjs <config.mjs> <outDir> [--only=a,b] [--no-shots]"); process.exit(2); }
const cfg = (await import(pathToFileURL(resolve(cfgPath)).href)).default;
const STK = process.env.STEEL_API_KEY;
const AXE = existsSync(new URL("./axe.min.js", import.meta.url)) ? readFileSync(new URL("./axe.min.js", import.meta.url), "utf8") : await (await fetch("https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js")).text();
const TYPES = { html: "text/html; charset=utf-8", css: "text/css", js: "text/javascript", mjs: "text/javascript", svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", webp: "image/webp", woff2: "font/woff2", woff: "font/woff", json: "application/json", ico: "image/x-icon", txt: "text/plain", webmanifest: "application/manifest+json" };
const AXE_RULES = ["color-contrast", "meta-viewport", "meta-viewport-large", "target-size", "avoid-inline-spacing"];
const WIDTHS = [{ id: "phone", width: 390, height: 844, dpr: 2, mobile: true }, { id: "desktop", width: 1280, height: 900, dpr: 1, mobile: false }];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(`${outDir}/shots`, { recursive: true });
const resultsFile = `${outDir}/results.json`;
const results = existsSync(resultsFile) ? JSON.parse(readFileSync(resultsFile, "utf8")) : { product: cfg.product, pages: {} };
results.product = cfg.product;

// ---- in-page code -------------------------------------------------------------------------------------------
// Everything below runs inside the page via page.evaluate(fn, args); it must be self-contained.
function pageScan({ phone, exempt }) {
  const cv = document.createElement("canvas"); cv.width = cv.height = 1;
  const cx = cv.getContext("2d", { willReadFrequently: true });
  const rgba = (c) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = "#000"; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
  const over = (top, bot) => { const a = top[3]; return [top[0] * a + bot[0] * (1 - a), top[1] * a + bot[1] * (1 - a), top[2] * a + bot[2] * (1 - a), 1]; };
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const bgOf = (el) => {
    const layers = []; let img = false;
    for (let e = el; e; e = e.parentElement) {
      const s = getComputedStyle(e);
      if (s.backgroundImage && s.backgroundImage !== "none") img = true;
      const c = rgba(s.backgroundColor);
      if (c[3] > 0) { layers.push(c); if (c[3] >= 1) break; }
    }
    let bg = [255, 255, 255, 1];
    if (!layers.length || layers[layers.length - 1][3] < 1) { const r = rgba(getComputedStyle(document.documentElement).backgroundColor); if (r[3] > 0) bg = over(r, bg); }
    for (let i = layers.length - 1; i >= 0; i--) bg = over(layers[i], bg);
    return { bg, img };
  };
  const path = (el) => { const p = []; for (let e = el, i = 0; e && e !== document.body && i < 3; e = e.parentElement, i++) { let s = e.tagName.toLowerCase(); const cls = [...e.classList].filter((c) => !/^(astro-|svelte-|css-|_|sc-)/.test(c) && c.length < 30).slice(0, 2); if (e.id && i === 0) s += "#" + e.id; else if (cls.length) s += "." + cls.join("."); p.unshift(s); } return p.join(" > "); };
  const INTER = "a[href],button,label,summary,select,option,input,textarea,[role=button],[role=link],[role=tab],[role=menuitem],[role=switch],[role=checkbox],[role=radio],[role=option],[tabindex]:not([tabindex='-1'])";
  const hiddenish = (el, r) => { if (r.width <= 1.5 || r.height <= 1.5) return true; const s = getComputedStyle(el); if (s.clip === "rect(0px, 0px, 0px, 0px)" || s.clipPath === "inset(50%)") return true; if (r.right < 0 || r.bottom + scrollY < 0) return true; if (el.checkVisibility && !el.checkVisibility({ opacityProperty: true, visibilityProperty: true, contentVisibilityAuto: true })) return true; return false; };
  const items = []; const byEl = new Map(); let id = 0;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const n = walker.currentNode; const t = n.nodeValue.replace(/\s+/g, " ").trim();
    if (!t || !/[\p{L}\p{N}]/u.test(t)) continue;
    const el = n.parentElement; if (!el || el.closest("script,style,noscript,template,title")) continue;
    if (byEl.has(el)) { byEl.get(el).text = (byEl.get(el).text + " " + t).slice(0, 160); continue; }
    const rg = document.createRange(); rg.selectNodeContents(n); const rr = rg.getBoundingClientRect();
    if (hiddenish(el, rr)) continue;
    const s = getComputedStyle(el); const fs = parseFloat(s.fontSize);
    const lhRaw = s.lineHeight; const lh = lhRaw === "normal" ? null : parseFloat(lhRaw) / fs;
    const inter = el.closest(INTER);
    const head = el.closest("h1,h2,h3,h4,h5,h6,[role=heading]");
    const block = el.closest("p,li,dd,dt,blockquote,td,th,figcaption,caption,label,legend,div,section,article,main,header,footer,aside,nav,form,body");
    const blockLen = (block?.innerText || t).replace(/\s+/g, " ").trim().length;
    const metaTag = el.closest("small,time,figcaption,caption,footer,sup,sub,[class*=meta],[class*=caption],[class*=eyebrow],[class*=kicker],[class*=badge],[class*=chip],[class*=tag],[class*=label],[class*=hint],[class*=note]");
    const bodyTag = el.closest("p,li,dd,blockquote,td,article");
    let role;
    if (head) role = "heading";
    else if (inter) role = inter.matches("input,textarea,select") ? "input" : "control";
    else if (bodyTag && blockLen >= 50 && !(metaTag && blockLen < 120)) role = "body";
    else if (!metaTag && blockLen >= 80) role = "body";
    else role = "meta";
    const fg = rgba(s.color); const { bg, img } = bgOf(el); const fgc = fg[3] < 1 ? over(fg, bg) : fg;
    const cr = Math.round(ratio(fgc, bg) * 100) / 100;
    const ls = s.letterSpacing === "normal" ? 0 : parseFloat(s.letterSpacing);
    const caps = s.textTransform === "uppercase" || (/\p{Lu}.*\p{Lu}/u.test(t) && t === t.toUpperCase() && /\p{L}{2}/u.test(t)) || s.fontVariantCaps.includes("small-caps");
    const fid = ++id; el.setAttribute("data-fa", fid);
    const it = { id: fid, sel: path(el), text: t.slice(0, 160), role, fs: Math.round(fs * 100) / 100, lh: lh && Math.round(lh * 100) / 100, lhRaw, fw: s.fontWeight, ls, caps, tt: s.textTransform, ff: s.fontFamily.split(",")[0].replace(/["']/g, "").trim(), color: s.color, bg: `rgb(${bg.slice(0, 3).map(Math.round).join(",")})`, bgImg: img, cr, y: Math.round(rr.top + scrollY) };
    if (inter) { const ir = inter.getBoundingClientRect(); it.tap = { w: Math.round(ir.width), h: Math.round(ir.height) }; }
    items.push(it); byEl.set(el, it);
  }
  // form controls: their value/placeholder text is not a text node
  for (const el of document.querySelectorAll("input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]),textarea,select")) {
    const r = el.getBoundingClientRect(); if (hiddenish(el, r)) continue;
    const s = getComputedStyle(el); const fid = ++id; el.setAttribute("data-fa", fid);
    items.push({ id: fid, sel: path(el), text: (el.value || el.placeholder || el.getAttribute("aria-label") || el.name || "").slice(0, 80), role: "input", fs: parseFloat(s.fontSize), lh: null, lhRaw: s.lineHeight, fw: s.fontWeight, ls: 0, caps: false, tt: s.textTransform, ff: s.fontFamily.split(",")[0].replace(/["']/g, ""), color: s.color, bg: "", bgImg: false, cr: null, y: Math.round(r.top + scrollY), tap: { w: Math.round(r.width), h: Math.round(r.height) } });
  }
  // flags
  for (const it of items) {
    const f = [];
    if (it.fs < 12) f.push("under-12");
    if (it.role === "body" && it.fs < (phone ? 16 : 15)) f.push(phone ? "body<16" : "body<15");
    if ((it.role === "meta" || it.role === "heading") && it.fs < 14) f.push("meta<14");
    if (it.role === "control" && it.fs < 14) f.push("control<14");
    if (it.role === "input" && it.fs < 16 && phone) f.push("input<16");
    if (it.role === "body" && (it.lh === null || it.lh < 1.4)) f.push("lh<1.4");
    if (it.caps && it.ls > 0 && it.fs < 13) f.push("caps<13");
    const ex = exempt.find((x) => { try { return document.querySelector(`[data-fa="${it.id}"]`)?.closest(x.sel); } catch { return false; } });
    if (ex && f.length) { it.exempt = ex.why; it.exemptFlags = f; it.flags = []; } else it.flags = f;
    if (it.cr !== null) { const large = it.fs >= 24 || (it.fs >= 18.66 && +it.fw >= 700); if (it.cr < (large ? 3 : 4.5)) it.lowContrast = true; }
  }
  // base size + units in same-origin stylesheets
  const root = getComputedStyle(document.documentElement).fontSize;
  const pxDecl = []; let decl = 0;
  const walk = (rules, src) => { for (const r of rules) { if (r.cssRules) walk(r.cssRules, src); const fsv = r.style?.getPropertyValue("font-size"); if (fsv) { decl++; if (/^\d*\.?\d+px$/.test(fsv.trim())) pxDecl.push(`${r.selectorText || "?"} { font-size: ${fsv} } (${src})`); } const fv = r.style?.getPropertyValue("font"); if (fv && /\d+px/.test(fv)) { decl++; pxDecl.push(`${r.selectorText || "?"} { font: ${fv} } (${src})`); } } };
  for (const sh of document.styleSheets) { try { walk(sh.cssRules, (sh.href || "inline").split("/").pop().slice(0, 40)); } catch { /* cross-origin */ } }
  const htmlDecl = [...document.styleSheets].flatMap((sh) => { try { return [...sh.cssRules]; } catch { return []; } }).filter((r) => r.selectorText && /(^|,)\s*(html|:root)\s*(,|$)/.test(r.selectorText) && r.style.getPropertyValue("font-size")).map((r) => r.style.getPropertyValue("font-size"));
  const vp = document.querySelector("meta[name=viewport]")?.content || "";
  return { items, root, rootDecl: htmlDecl, pxDecl: pxDecl.slice(0, 60), pxDeclCount: pxDecl.length, fontSizeDecl: decl, viewport: vp, title: document.title };
}

function sizesNow() { const m = {}; for (const el of document.querySelectorAll("[data-fa]")) m[el.getAttribute("data-fa")] = parseFloat(getComputedStyle(el).fontSize); return { m, root: getComputedStyle(document.documentElement).fontSize }; }

function layoutCheck() {
  const de = document.documentElement; const out = { overflowX: de.scrollWidth > de.clientWidth + 1 ? `${de.scrollWidth}/${de.clientWidth}` : null, clipped: [], overlaps: [] };
  const els = [...document.querySelectorAll("[data-fa]")].filter((e) => e.getClientRects().length);
  const path = (el) => (el.tagName.toLowerCase() + ([...el.classList].slice(0, 2).map((c) => "." + c).join("") || "")) + ` "${(el.innerText || el.value || "").replace(/\s+/g, " ").trim().slice(0, 40)}"`;
  for (const el of els) {
    for (let e = el, i = 0; e && i < 3; e = e.parentElement, i++) {
      const s = getComputedStyle(e);
      const clipsX = /hidden|clip/.test(s.overflowX), clipsY = /hidden|clip/.test(s.overflowY);
      if ((clipsX && e.scrollWidth > e.clientWidth + 2) || (clipsY && e.scrollHeight > e.clientHeight + 2) || (s.webkitLineClamp !== "none" && e.scrollHeight > e.clientHeight + 2)) { out.clipped.push(path(el) + (s.textOverflow === "ellipsis" ? " (ellipsis)" : "")); break; }
    }
  }
  const boxes = []; for (const el of els) { if (el.matches("input,textarea,select")) continue; for (const tn of el.childNodes) { if (tn.nodeType !== 3 || !tn.nodeValue.trim()) continue; const rg = document.createRange(); rg.selectNodeContents(tn); for (const r of rg.getClientRects()) if (r.width > 2 && r.height > 2) boxes.push({ el, r }); } if (boxes.length > 3000) break; }
  const seen = new Set();
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j]; if (a.el === b.el || a.el.contains(b.el) || b.el.contains(a.el)) continue;
    const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left), h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
    if (w <= 2 || h <= 2) continue;
    const small = Math.min(a.r.width * a.r.height, b.r.width * b.r.height); if ((w * h) / small < 0.25) continue;
    const k = path(a.el) + " ⟷ " + path(b.el); if (!seen.has(k)) { seen.add(k); out.overlaps.push(k); }
    if (out.overlaps.length > 25) break;
  }
  out.clipped = [...new Set(out.clipped)].slice(0, 40);
  return out;
}

// ---- driver -------------------------------------------------------------------------------------------------
async function withSession(fn) {
  const sess = await (await fetch("https://api.steel.dev/v1/sessions", { method: "POST", headers: { "steel-api-key": STK, "content-type": "application/json" }, body: JSON.stringify({ timeout: 900000 }) })).json();
  if (!sess.id) throw new Error("steel session failed: " + JSON.stringify(sess).slice(0, 200));
  try {
    const browser = await puppeteer.connect({ browserWSEndpoint: `wss://connect.steel.dev?apiKey=${STK}&sessionId=${sess.id}`, defaultViewport: null, protocolTimeout: 180000 });
    try { return await fn(browser); } finally { await browser.disconnect().catch(() => {}); }
  } finally { await fetch(`https://api.steel.dev/v1/sessions/${sess.id}/release`, { method: "POST", headers: { "steel-api-key": STK } }).catch(() => {}); }
}

async function open(browser, pg, w, scheme) {
  const page = await browser.newPage();
  if (cfg.bypassCSP !== false) await page.setBypassCSP(true);
  if (cfg.local) {
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      if (req.isInterceptResolutionHandled()) return;
      const u = new URL(req.url());
      if (u.origin === cfg.local.origin && !(cfg.local.skip && cfg.local.skip.test(u.pathname))) {
        let f = cfg.local.dir + decodeURIComponent(u.pathname);
        if (existsSync(f) && statSync(f).isDirectory()) f = f.replace(/\/?$/, "/index.html");
        else if (!existsSync(f) && existsSync(f + ".html")) f += ".html";
        else if (!existsSync(f) && req.resourceType() === "document" && cfg.local.spa) f = cfg.local.dir + "/index.html";
        if (existsSync(f) && statSync(f).isFile()) return req.respond({ status: 200, contentType: TYPES[f.split(".").pop()] ?? "application/octet-stream", body: readFileSync(f) });
      }
      req.continue();
    });
  }
  await page.setViewport({ width: w.width, height: w.height, deviceScaleFactor: w.dpr, isMobile: w.mobile, hasTouch: w.mobile });
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: scheme }, { name: "prefers-reduced-motion", value: "reduce" }]);
  if (pg.html) await page.setContent(readFileSync(pg.html, "utf8"), { waitUntil: "load", timeout: 60000 });
  else await page.goto(pg.url, { waitUntil: "networkidle2", timeout: 60000 }).catch(async (e) => { if (!/timeout/i.test(e.message)) throw e; });
  await wait(pg.settle ?? 1200);
  if (pg.prepare) await pg.prepare(page, { width: w.width, scheme });
  if (scheme === "dark" && pg.dark) { const r = await pg.dark(page); if (r === false) { await page.close(); return null; } await wait(500); }
  if (pg.after) await pg.after(page, { width: w.width, scheme });
  return page;
}

async function auditPage(browser, pg) {
  const res = { name: pg.name, url: pg.url || pg.html, at: new Date().toISOString(), variants: {} };
  for (const w of WIDTHS.filter((x) => !pg.widths || pg.widths.includes(x.id))) {
    for (const scheme of pg.schemes || ["light", "dark"]) {
      const key = `${w.id}-${scheme}`; process.stdout.write(`  ${pg.name} ${key} … `);
      let page;
      try {
        page = await open(browser, pg, w, scheme);
        if (!page) { console.log("skipped (no dark mode)"); continue; }
        const scan = await page.evaluate(pageScan, { phone: w.mobile, exempt: cfg.exempt || [] });
        if (shots && (scheme === "light" || w.mobile)) await page.screenshot({ path: `${outDir}/shots/${pg.name}-${key}.jpg`, type: "jpeg", quality: 70 });
        await page.addScriptTag({ content: AXE }).catch(() => {});
        const axe = await page.evaluate(async (rules) => { if (!window.axe) return { error: "axe not injected" }; const r = await axe.run(document, { runOnly: { type: "rule", values: rules }, resultTypes: ["violations"] }); return r.violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, nodes: v.nodes.slice(0, 8).map((x) => x.target.join(" ") + (x.any?.[0]?.data?.contrastRatio ? ` (${x.any[0].data.contrastRatio}:1, ${x.any[0].data.fontSize})` : "")) })); }, AXE_RULES).catch((e) => ({ error: e.message }));
        const v = { scan: { ...scan, items: scan.items }, axe };
        if (scheme === "light" && !pg.email) {
          // text that does not grow with the browser's default font size (150%)
          const cdp = await page.createCDPSession();
          const base = await page.evaluate(sizesNow);
          let fixed = [], root150 = null, layoutRoot = null;
          try {
            await cdp.send("Page.setFontSizes", { fontSizes: { standard: 24, fixed: 20 } }); await wait(700);
            const big = await page.evaluate(sizesNow); root150 = big.root;
            fixed = scan.items.filter((it) => base.m[it.id] && big.m[it.id] && big.m[it.id] / base.m[it.id] < 1.1).map((it) => it.id);
            layoutRoot = await page.evaluate(layoutCheck);
            if (shots && w.mobile) await page.screenshot({ path: `${outDir}/shots/${pg.name}-${key}-root150.jpg`, type: "jpeg", quality: 70 });
            await cdp.send("Page.setFontSizes", { fontSizes: { standard: 16, fixed: 13 } }); await wait(400);
          } catch (e) { fixed = null; layoutRoot = { error: e.message }; }
          const zoom = {};
          for (const z of [1.25, 1.5]) {
            await page.setViewport({ width: Math.round(w.width / z), height: Math.round(w.height / z), deviceScaleFactor: w.dpr * z, isMobile: w.mobile, hasTouch: w.mobile }); await wait(700);
            zoom[z] = await page.evaluate(layoutCheck);
            if (shots && w.mobile && z === 1.5) await page.screenshot({ path: `${outDir}/shots/${pg.name}-${key}-zoom150.jpg`, type: "jpeg", quality: 70 });
          }
          await page.setViewport({ width: w.width, height: w.height, deviceScaleFactor: w.dpr, isMobile: w.mobile, hasTouch: w.mobile }); await wait(300);
          const baseLayout = await page.evaluate(layoutCheck);
          v.scaling = { root: base.root, root150, fixedIds: fixed, layout: { base: baseLayout, root150: layoutRoot, zoom125: zoom[1.25], zoom150: zoom[1.5] } };
          for (const it of scan.items) if (fixed?.includes(it.id)) (it.exempt ? (it.exemptFlags ||= []) : it.flags).push("fixed-px");
          await cdp.detach().catch(() => {});
        }
        res.variants[key] = v;
        const nf = scan.items.filter((i) => i.flags.length).length;
        console.log(`${scan.items.length} text runs, ${nf} flagged, axe ${Array.isArray(axe) ? axe.map((a) => a.id + ":" + a.n).join(" ") || "clean" : axe.error}`);
      } catch (e) { console.log("ERROR " + e.message.slice(0, 200)); res.variants[key] = { error: e.message }; }
      finally { await page?.close().catch(() => {}); }
    }
  }
  return res;
}

for (const pg of cfg.pages.filter((p) => !only.length || only.includes(p.name))) {
  console.log(`[${cfg.product}] ${pg.name}`);
  try { results.pages[pg.name] = await withSession((b) => auditPage(b, pg)); }
  catch (e) { console.log("  session ERROR " + e.message); results.pages[pg.name] = { name: pg.name, error: e.message }; }
  writeFileSync(resultsFile, JSON.stringify(results));
}
console.log(`wrote ${resultsFile}`);
