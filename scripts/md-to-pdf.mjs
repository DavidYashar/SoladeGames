/**
 * Renders games/README.md to a print-quality PDF.
 *
 *   node scripts/md-to-pdf.mjs            → ../README.pdf
 *   node scripts/md-to-pdf.mjs --html     → also keep the intermediate HTML
 *
 * Pipeline: marked (Markdown → HTML) → styled print shell → headless
 * Chrome/Edge --print-to-pdf. No new project dependencies.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const gamesRoot = path.resolve(here, "..");
const mdPath = path.join(gamesRoot, "README.md");
const pdfPath = path.join(gamesRoot, "README.pdf");
const htmlPath = path.join(gamesRoot, "README.print.html");
const keepHtml = process.argv.includes("--html");

/* ---------- 1. Markdown → HTML ---------- */

// Feed the source through stdin: the project path contains spaces, and passing
// it as a CLI argument through a shell mangles it.
const markdown = readFileSync(mdPath, "utf8");
const rawBody = execFileSync("npx", ["-y", "marked"], {
  cwd: gamesRoot,
  input: markdown,
  encoding: "utf8",
  shell: true,
  // npx on Windows needs a shell; silence Node's args-with-shell deprecation notice.
  env: { ...process.env, NODE_NO_WARNINGS: "1" },
  maxBuffer: 32 * 1024 * 1024,
});

// The cover already carries the title — drop the markdown H1 so it isn't printed twice.
const body = rawBody.replace(/<h1[^>]*>[\s\S]*?<\/h1>\s*/, "");

/* ---------- 2. brand marks (dark on paper) ---------- */

const robot = `<svg viewBox="0 0 7 9" class="mark" shape-rendering="crispEdges" aria-hidden="true">
  <rect x="3.2" y="0" width="0.6" height="1.3" fill="currentColor"/>
  <path d="M3.5 1.15 L6.6 2.75 V8.85 H0.4 V2.75 Z" fill="currentColor"/>
  <rect x="1.2" y="3.7" width="4.6" height="3.8" fill="#ffffff"/>
  <rect x="1.95" y="4.7" width="1.05" height="1.5" fill="#0aa6c2"/>
  <rect x="4" y="4.7" width="1.05" height="1.5" fill="#0aa6c2"/>
</svg>`;

const stamp = new Date().toISOString().slice(0, 10);

/* ---------- 3. print shell ---------- */

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>ARC-ADE — Project Overview</title>
<style>
  @page { size: A4; margin: 16mm 15mm 16mm 15mm; }

  :root {
    --ink: #12131a;
    --muted: #55596b;
    --rule: #dcdfe8;
    --cyan: #0aa6c2;
    --violet: #6d3fd4;
    --code-bg: #f4f5f8;
  }

  * { box-sizing: border-box; }

  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }

  body {
    margin: 0;
    font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
    font-size: 10.2pt;
    line-height: 1.55;
    color: var(--ink);
  }

  /* ---------- cover ---------- */
  .cover {
    border-top: 6px solid var(--ink);
    padding: 14pt 0 16pt;
    margin-bottom: 22pt;
  }
  .cover .row { display: flex; align-items: center; gap: 10pt; }
  .cover .mark { height: 44pt; width: auto; color: #0b0c12; }
  .cover h1 {
    font-size: 26pt;
    letter-spacing: 0.06em;
    margin: 0;
    font-weight: 800;
  }
  .cover .sub {
    margin: 4pt 0 0;
    font-size: 15pt;
    font-weight: 600;
    color: var(--ink);
  }
  .cover .lede {
    margin: 8pt 0 0;
    font-size: 10.8pt;
    color: var(--muted);
    max-width: 150mm;
  }
  .cover .bar {
    height: 3pt;
    width: 70mm;
    margin-top: 14pt;
    background: linear-gradient(90deg, var(--cyan), var(--violet));
  }
  .cover .meta {
    margin-top: 10pt;
    font-size: 8.6pt;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--muted);
  }

  /* ---------- headings ---------- */
  h2 {
    font-size: 15pt;
    margin: 26pt 0 8pt;
    padding-bottom: 5pt;
    border-bottom: 2px solid var(--ink);
    break-after: avoid;
  }
  h2:first-of-type { margin-top: 0; }

  h3 {
    font-size: 11.6pt;
    margin: 16pt 0 5pt;
    color: var(--ink);
    break-after: avoid;
  }
  h4 { font-size: 10.4pt; margin: 12pt 0 4pt; break-after: avoid; }

  p { margin: 0 0 7pt; }

  a { color: #0b6f85; text-decoration: none; }

  ul, ol { margin: 0 0 8pt; padding-left: 16pt; }
  li { margin-bottom: 2.5pt; }

  hr { border: 0; border-top: 1px solid var(--rule); margin: 18pt 0; }

  blockquote {
    margin: 8pt 0;
    padding: 6pt 0 6pt 10pt;
    border-left: 3px solid var(--cyan);
    color: var(--muted);
    background: #fafbfc;
  }

  /* ---------- code ---------- */
  code {
    font-family: "Cascadia Mono", Consolas, "Courier New", monospace;
    font-size: 8.8pt;
    background: var(--code-bg);
    padding: 0.5pt 3pt;
    border-radius: 2pt;
  }
  pre {
    background: var(--code-bg);
    border: 1px solid var(--rule);
    border-left: 3px solid var(--violet);
    padding: 8pt 10pt;
    margin: 8pt 0 10pt;
    overflow: hidden;
    break-inside: avoid;
  }
  pre code {
    background: none;
    padding: 0;
    font-size: 8.4pt;
    line-height: 1.42;
    white-space: pre-wrap;
    word-break: break-word;
  }

  /* ---------- tables ---------- */
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 8pt 0 12pt;
    font-size: 9.1pt;
    break-inside: avoid;
  }
  thead { background: #12131a; color: #fff; }
  th, td {
    border: 1px solid var(--rule);
    padding: 4.5pt 6pt;
    text-align: left;
    vertical-align: top;
  }
  th { font-weight: 600; border-color: #12131a; }
  tbody tr:nth-child(even) { background: #f7f8fa; }
  td code { font-size: 8.4pt; }

  /* ---------- TOC ---------- */
  h2 + ol, h2 + p + ol { font-size: 9.8pt; }

  /* mermaid fallback keeps its source readable when offline */
  pre code.language-mermaid { color: #3b3f52; }

  /* rendered diagrams */
  .diagram {
    margin: 10pt 0 12pt;
    text-align: center;
    break-inside: avoid;
  }
  .diagram svg { max-width: 100%; height: auto; }
</style>
</head>
<body>
  <div class="cover">
    <div class="row">
      ${robot}
      <h1>ARC-ADE</h1>
    </div>
    <p class="sub">Project Overview</p>
    <p class="lede">The game, the plan, the flow of the money, and the machines.</p>
    <div class="bar"></div>
    <p class="meta">Skill arcade on Arc · For review · ${stamp}</p>
  </div>

  ${body}

<script type="module">
  // Render the three Mermaid blocks to SVG. If the CDN is unreachable the
  // original source blocks stay in place, so the document is never blank.
  try {
    const { default: mermaid } = await import(
      "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs"
    );
    mermaid.initialize({
      startOnLoad: false,
      theme: "neutral",
      themeVariables: { fontFamily: "Segoe UI, system-ui, sans-serif", fontSize: "13px" },
    });

    const blocks = [...document.querySelectorAll("pre")].filter((p) =>
      p.querySelector("code.language-mermaid")
    );

    for (let i = 0; i < blocks.length; i++) {
      const pre = blocks[i];
      const src = pre.querySelector("code").textContent;
      const holder = document.createElement("div");
      holder.className = "diagram";
      holder.textContent = src;
      holder.style.position = "absolute";
      holder.style.left = "-99999px";
      document.body.appendChild(holder);
      try {
        const { svg } = await mermaid.render("diagram-" + i, src);
        holder.innerHTML = svg;
        holder.style.position = "";
        holder.style.left = "";
        pre.replaceWith(holder);
      } catch {
        holder.remove();
      }
    }
  } catch {
    /* offline — leave the source blocks */
  }
  document.documentElement.dataset.diagrams = "done";
</script>
</body>
</html>`;

writeFileSync(htmlPath, html, "utf8");

/* ---------- 4. HTML → PDF via headless Chrome/Edge ---------- */

const browsers = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  process.env.LOCALAPPDATA + "\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
].filter((p) => p && existsSync(p));

if (browsers.length === 0) {
  console.error("No Chrome or Edge found. Open README.print.html and print it manually.");
  process.exit(1);
}

const fileUrl = "file:///" + htmlPath.replace(/\\/g, "/").replace(/ /g, "%20");

// A throwaway profile keeps headless from touching the user's real browser state.
const profileDir = path.join(tmpdir(), "arcade-pdf-profile");

let printed = false;
for (const browser of browsers) {
  try {
    execFileSync(
      browser,
      [
        "--headless=new",
        "--disable-gpu",
        "--no-first-run",
        "--no-default-browser-check",
        `--user-data-dir=${profileDir}`,
        "--print-to-pdf-no-header",
        "--no-pdf-header-footer",
        "--virtual-time-budget=20000",
        `--print-to-pdf=${pdfPath}`,
        fileUrl,
      ],
      { stdio: "pipe", timeout: 180_000 },
    );
    printed = true;
    break;
  } catch (err) {
    console.error(`  ${path.basename(browser)} failed: ${err.message.split("\n")[0]}`);
  }
}

if (!printed || !existsSync(pdfPath)) {
  console.error("PDF generation failed. README.print.html is still available.");
  process.exit(1);
}

if (!keepHtml) rmSync(htmlPath, { force: true });

const bytes = readFileSync(pdfPath).length;
console.log(`README.pdf written — ${(bytes / 1024).toFixed(0)} KB`);
