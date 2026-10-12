// Turn fontaudit.mjs results into the markdown audit file.
//
//   node report.mjs <before/results.json> [<after/results.json>] > docs/audits/2026-10-11-font-size.md
//   node report.mjs --counts <results.json>   prints {"flags":n,"layout":n,"axe":n} as JSON
//
// A "flag" is one distinct (page, width, rule, selector, font-size) combination; light and dark are merged
// because the type is the same in both. Layout issues are distinct (page, width, mode, issue) from the 125% /
// 150% zoom and 150% root font-size runs.
import { readFileSync } from "node:fs";
const args = process.argv.slice(2);
const countsOnly = args[0] === "--counts"; if (countsOnly) args.shift();
const load = (p) => (p ? JSON.parse(readFileSync(p, "utf8")) : null);
const before = load(args[0]), after = load(args[1]);

function flagsOf(res, page) {
  const m = new Map(); const pg = res?.pages?.[page]; if (!pg?.variants) return m;
  for (const [key, v] of Object.entries(pg.variants)) {
    if (!v.scan) continue; const width = key.split("-")[0];
    for (const it of v.scan.items) for (const f of it.flags) {
      const k = `${width}|${f}|${it.sel}|${it.fs}`;
      if (!m.has(k)) m.set(k, { width, flag: f, sel: it.sel, fs: it.fs, lh: it.lh, role: it.role, text: it.text, n: 0, schemes: new Set() });
      const e = m.get(k); e.n++; e.schemes.add(key.split("-")[1]);
    }
  }
  return m;
}
function layoutOf(res, page) {
  const out = []; const pg = res?.pages?.[page]; if (!pg?.variants) return out;
  for (const [key, v] of Object.entries(pg.variants)) {
    if (!v.scaling) continue; const width = key.split("-")[0];
    for (const [mode, l] of Object.entries(v.scaling.layout)) {
      if (!l || l.error) continue;
      if (l.overflowX) out.push({ width, mode, kind: "horizontal overflow", what: l.overflowX });
      for (const c of l.clipped) out.push({ width, mode, kind: "clipped", what: c });
      for (const o of l.overlaps) out.push({ width, mode, kind: "overlap", what: o });
    }
  }
  return out;
}
function axeOf(res, page) {
  const m = new Map(); const pg = res?.pages?.[page]; if (!pg?.variants) return m;
  for (const [key, v] of Object.entries(pg.variants)) if (Array.isArray(v.axe)) for (const a of v.axe) { const k = `${a.id}`; const e = m.get(k) || { id: a.id, impact: a.impact, where: [], nodes: new Set() }; e.where.push(`${key} (${a.n})`); a.nodes.forEach((n) => e.nodes.add(n)); m.set(k, e); }
  return m;
}
const pagesOf = (res) => Object.keys(res?.pages || {});
const totals = (res) => { let flags = 0, layout = 0, axe = 0; for (const p of pagesOf(res)) { flags += flagsOf(res, p).size; layout += layoutOf(res, p).length; for (const a of axeOf(res, p).values()) axe += a.where.length; } return { flags, layout, axe }; };

if (countsOnly) { console.log(JSON.stringify(totals(before))); process.exit(0); }

const L = [];
const esc = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
const tb = totals(before), ta = after ? totals(after) : null;
L.push(`# Font-size accessibility audit — ${before.product}`, "");
L.push(`Date: 2026-10-11. Requested by Aditya (2026-10-11 18:30 EDT): every piece of text large enough from an accessibility perspective.`, "");
L.push("## Method", "");
L.push("Script: `scripts/font-size-audit/fontaudit.mjs` (Steel cloud browser, puppeteer-core) with this repo's page list in `scripts/font-size-audit/pages.mjs`; `report.mjs` writes this file. For every page at 390 px (phone, DPR 2) and 1280 px (desktop), light and dark, it walks every visible text node and records computed font-size, line-height, weight, letter-spacing, text-transform, colour, effective background, contrast ratio and role (heading / body / meta / control / input). It then raises the browser's default font size to 150% (CDP `Page.setFontSizes`) to find text in fixed px, and lays the page out at 125% and 150% zoom and with the 150% root size, checking horizontal overflow, clipped text and overlapping text. axe-core 4.10 runs `color-contrast`, `meta-viewport`, `meta-viewport-large`, `target-size`, `avoid-inline-spacing`.", "");
L.push("Pages marked as emails are rendered from the product's own templates; email clients need px, so they skip the fixed-px and zoom checks but keep the size floors.", "");
L.push("Flags: body text < 16 px on phone (< 15 px desktop) · meta/secondary/heading text < 14 px · any text < 12 px · labels on tappable controls < 14 px · form inputs < 16 px on phone (iOS zooms on focus) · body line-height < 1.4 · letter-spaced caps < 13 px · text that does not grow with the browser text size (fixed px). A flag is one distinct page × width × rule × selector × size; light and dark are merged.", "");
L.push("## Summary", "");
L.push(after ? "| | Before | After |\n|---|---:|---:|" : "| | Count |\n|---|---:|");
const row = (n, a, b) => L.push(after ? `| ${n} | ${a} | ${b} |` : `| ${n} | ${a} |`);
row("Font-size / line-height flags", tb.flags, ta?.flags); row("Layout issues at 125% / 150% zoom and 150% text", tb.layout, ta?.layout); row("axe violations (rule × variant)", tb.axe, ta?.axe);
L.push("");
L.push(after ? "| Page | Flags before | Flags after | Layout before | Layout after |\n|---|---:|---:|---:|---:|" : "| Page | Flags | Layout |\n|---|---:|---:|");
for (const p of pagesOf(before)) L.push(after ? `| ${p} | ${flagsOf(before, p).size} | ${flagsOf(after, p).size} | ${layoutOf(before, p).length} | ${layoutOf(after, p).length} |` : `| ${p} | ${flagsOf(before, p).size} | ${layoutOf(before, p).length} |`);
L.push("");

for (const p of pagesOf(before)) {
  const pb = before.pages[p]; L.push(`## ${p}`, "", `URL: ${pb.url || "?"}`, "");
  if (pb.error) { L.push(`Before run failed: ${pb.error}`, ""); }
  for (const [label, res] of [["Before", before], ["After", after]]) {
    if (!res) continue; const pg = res.pages[p]; if (!pg?.variants) { L.push(`### ${label}: not run`, ""); continue; }
    L.push(`### ${label}`, "");
    const anyV = Object.values(pg.variants).find((v) => v.scan);
    if (anyV) {
      const s = anyV.scan, sc = Object.values(pg.variants).find((v) => v.scaling)?.scaling;
      L.push(`Root font-size ${s.root}${s.rootDecl?.length ? ` (declared ${s.rootDecl.join(", ")})` : " (not set, browser default)"}; at 150% browser text size the root is ${sc?.root150 ?? "?"}. ${s.pxDeclCount} of ${s.fontSizeDecl} font-size declarations in same-origin CSS use px. Viewport meta: \`${s.viewport || "none"}\`.`, "");
      if (s.pxDeclCount) L.push("<details><summary>px font-size declarations</summary>", "", ...s.pxDecl.map((d) => `- \`${esc(d)}\``), "", "</details>", "");
    }
    // per-width type table (light)
    for (const w of ["phone", "desktop"]) {
      const v = pg.variants[`${w}-light`]; if (!v?.scan) continue;
      const g = new Map();
      for (const it of v.scan.items) { const k = `${it.role}|${it.ff}|${it.fs}|${it.lh}|${it.fw}|${it.caps && it.ls > 0 ? "caps+" + it.ls : ""}`; const e = g.get(k) || { it, n: 0, minCr: 99, flags: new Set(), sample: it.text }; e.n++; if (it.cr != null) e.minCr = Math.min(e.minCr, it.cr); it.flags.forEach((f) => e.flags.add(f)); g.set(k, e); }
      const rows = [...g.values()].sort((a, b) => a.it.fs - b.it.fs);
      L.push(`<details><summary>${label} type table, ${w} (${v.scan.items.length} text runs, ${rows.length} distinct styles)</summary>`, "", "| Role | Font | Size px | Line-height | Weight | Caps/tracking | Min contrast | Runs | Flags | Example |", "|---|---|---:|---:|---:|---|---:|---:|---|---|");
      for (const r of rows) L.push(`| ${r.it.role} | ${esc(r.it.ff)} | ${r.it.fs} | ${r.it.lh ?? r.it.lhRaw} | ${r.it.fw} | ${r.it.caps && r.it.ls > 0 ? `caps ${r.it.ls}px` : ""} | ${r.minCr === 99 ? "" : r.minCr} | ${r.n} | ${[...r.flags].join(", ")} | ${esc(r.sample.slice(0, 50))} |`);
      L.push("", "</details>", "");
    }
    const fl = [...flagsOf(res, p).values()].sort((a, b) => a.fs - b.fs);
    if (fl.length) {
      L.push(`**Flagged (${fl.length})**`, "", "| Width | Rule | Role | Size px | LH | Selector | Runs | Example |", "|---|---|---|---:|---:|---|---:|---|");
      for (const f of fl) L.push(`| ${f.width} | ${f.flag} | ${f.role} | ${f.fs} | ${f.lh ?? "normal"} | \`${esc(f.sel)}\` | ${f.n} | ${esc(f.text.slice(0, 60))} |`);
      L.push("");
    } else L.push("**No font-size flags.**", "");
    const lay = layoutOf(res, p);
    if (lay.length) { L.push(`**Layout at larger text (${lay.length})**`, "", "| Width | Mode | Issue | Element |", "|---|---|---|---|"); for (const l of lay.slice(0, 60)) L.push(`| ${l.width} | ${l.mode} | ${l.kind} | ${esc(l.what)} |`); if (lay.length > 60) L.push(`| | | | … ${lay.length - 60} more |`); L.push(""); }
    else L.push("**No overflow, clipping or overlap at 125% / 150% zoom or 150% text.**", "");
    const ax = [...axeOf(res, p).values()];
    if (ax.length) { L.push("**axe**", ""); for (const a of ax) L.push(`- \`${a.id}\` (${a.impact}) in ${a.where.join(", ")}: ${[...a.nodes].slice(0, 5).map((n) => "`" + esc(n) + "`").join(", ")}`); L.push(""); }
    const exm = new Map(); for (const [key, v] of Object.entries(pg.variants)) for (const it of v.scan?.items || []) if (it.exempt) { const k = `${key.split("-")[0]}|${it.sel}|${it.fs}`; if (!exm.has(k)) exm.set(k, `${key.split("-")[0]}: \`${esc(it.sel)}\` ${it.fs}px (${(it.exemptFlags || []).join(", ")}) "${esc(it.text.slice(0, 30))}" — exempt: ${esc(it.exempt)}`); }
    if (exm.size) L.push(`**Exempt, not counted (${exm.size})**`, "", ...[...exm.values()].map((s) => "- " + s), "");
    const lc = new Map(); for (const [key, v] of Object.entries(pg.variants)) for (const it of v.scan?.items || []) if (it.lowContrast && !it.bgImg) { const k = `${key}|${it.sel}`; if (!lc.has(k)) lc.set(k, `${key}: \`${esc(it.sel)}\` ${it.cr}:1 at ${it.fs}px ("${esc(it.text.slice(0, 30))}")`); }
    if (lc.size) { L.push(`<details><summary>Script-computed low contrast (${lc.size}; axe above is authoritative)</summary>`, "", ...[...lc.values()].slice(0, 40).map((s) => "- " + s), "", "</details>", ""); }
  }
}
console.log(L.join("\n"));
