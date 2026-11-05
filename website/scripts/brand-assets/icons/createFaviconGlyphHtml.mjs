import { FAVICON_GLYPH_PX } from '../tileMetrics.mjs';

export const createFaviconGlyphHtml = ({ mascotBase64 }) => `<!doctype html>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box }
  html, body { width: ${FAVICON_GLYPH_PX}px; height: ${FAVICON_GLYPH_PX}px; background: transparent; overflow: hidden }
  .mascot { display: block; width: 100%; height: 100%; background: #fff; -webkit-mask: url(data:image/png;base64,${mascotBase64}) no-repeat center / contain }
</style>
<body><i class="mascot"></i></body>`;
