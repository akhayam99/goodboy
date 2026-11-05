import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { WEBSITE_DIRECTORY } from '../paths.mjs';

const INTER_FONT_PATH = resolve(WEBSITE_DIRECTORY, 'public/fonts/InterVariable-latin-v19.woff2');
const INTER_FONT_BASE64 = readFileSync(INTER_FONT_PATH).toString('base64');

export const createBaseHtml = ({
  width,
  height,
  accent,
  bodyClass,
  content,
  extraCss = '',
}) => `<!doctype html>
<meta charset="utf-8">
<style>
  @page { size: ${width}px ${height}px; margin: 0 }
  @font-face { font-family: "Inter"; font-style: normal; font-weight: 100 900; src: url(data:font/woff2;base64,${INTER_FONT_BASE64}) format("woff2-variations") }
  * { margin: 0; padding: 0; box-sizing: border-box }
  html, body { width: ${width}px; height: ${height}px }
  body { background: #fff; color: #101113; font-family: "Inter", -apple-system, BlinkMacSystemFont, sans-serif; font-optical-sizing: auto; font-feature-settings: "calt" 1; overflow: hidden }
  .mascot { display: block; background: ${accent} }
  ${extraCss}
</style>
<body class="${bodyClass}">${content}</body>`;
