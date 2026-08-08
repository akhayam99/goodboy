import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const ROOT = new URL('..', import.meta.url).pathname;
const OUT = `${ROOT}public/og-image.png`;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const icons = readFileSync(`${ROOT}src/components/BrandIcons.tsx`, 'utf8');

const grab = (block, key) => {
  const re = new RegExp(`${key}:\\s*\\n?\\s*'([^']+)'`);
  const m = block.match(re);
  if (!m) throw new Error(`missing path for ${key}`);
  return m[1];
};

const mascot64 = readFileSync(`${ROOT}src/assets/mascot.png`).toString('base64');
const pathBlock = icons.slice(icons.indexOf('BRAND_PATH'), icons.indexOf('BRAND_COLOR'));

const PROVIDERS = [
  ['anthropic', 'oklch(0.54 0.16 55)'],
  ['codex', 'oklch(0.48 0.15 148)'],
  ['cursor', 'oklch(0.5 0.17 290)'],
  ['gemini', 'oklch(0.5 0.16 240)'],
  ['opencode', '#c87842'],
  ['openrouter', '#5558d9'],
  ['moonshot', '#1783ff'],
];

const marks = PROVIDERS.map(
  ([id, color]) =>
    `<svg width="30" height="30" viewBox="0 0 24 24" fill="${color}"><path d="${grab(pathBlock, id)}"/></svg>`,
).join('\n      ');

const html = `<!doctype html>
<meta charset="utf-8">
<style>
  @page { size: 1200px 630px; margin: 0 }
  * { margin: 0; padding: 0; box-sizing: border-box }
  html, body { width: 1200px; height: 630px }
  body {
    background: #fff;
    font-family: "Avenir Next", "Avenir", -apple-system, sans-serif;
    color: #101113;
    padding: 68px 76px;
    display: flex;
    flex-direction: column;
    position: relative;
    overflow: hidden;
  }
  body:before {
    content: "";
    position: absolute;
    top: -280px; right: -220px;
    width: 780px; height: 780px;
    border-radius: 50%;
    background: radial-gradient(circle, oklch(0.74 0.11 200 / 0.16), transparent 62%);
  }
  .brand { display: flex; align-items: center; gap: 14px; position: relative }
  .mascot {
    width: 54px; height: 54px;
    background: oklch(0.5 0.13 200);
    -webkit-mask: url("data:image/png;base64,${mascot64}") no-repeat center / contain;
  }
  .brand span { font-size: 38px; font-weight: 600; letter-spacing: -0.015em }
  h1 {
    margin-top: auto;
    font-size: 88px;
    font-weight: 500;
    line-height: 1.04;
    letter-spacing: -0.02em;
    position: relative;
  }
  h1 em { font-style: normal; color: oklch(0.5 0.13 200) }
  p.sub {
    margin-top: 26px;
    font-size: 30px;
    line-height: 1.35;
    color: #495057;
    max-width: 940px;
    position: relative;
  }
  .foot {
    margin-top: auto;
    padding-top: 40px;
    display: flex;
    align-items: center;
    gap: 22px;
    position: relative;
  }
  .foot .row { display: flex; align-items: center; gap: 18px }
  .foot .dom { font-size: 24px; font-weight: 600 }
  .foot .note { font-size: 22px; color: #66707a; margin-left: auto }
</style>
<div class="brand"><i class="mascot"></i><span>Goodboy</span></div>
<h1>Stop <em>re&#8209;explaining yourself.</em></h1>
<p class="sub">Describe a task once. Goodboy decides which agent goes next, on the plans you already pay for.</p>
<div class="foot">
  <span class="dom">goodboy-ai.dev</span>
  <span class="row">
      ${marks}
  </span>
  <span class="note">free and open source</span>
</div>
`;

const tmp = `${ROOT}scripts/.og.html`;
writeFileSync(tmp, html);

execFileSync(CHROME, [
  '--headless',
  '--disable-gpu',
  '--hide-scrollbars',
  '--force-device-scale-factor=1',
  '--default-background-color=ffffff',
  '--window-size=1200,630',
  `--screenshot=${OUT}`,
  `file://${tmp}`,
]);

unlinkSync(tmp);
console.log('rendered', OUT);
