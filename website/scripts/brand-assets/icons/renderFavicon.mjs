import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { CHROME } from '../chrome.mjs';
import { WEBSITE_DIRECTORY } from '../paths.mjs';
import { FAVICON_GLYPH_PX } from '../tileMetrics.mjs';
import { createFaviconGlyphHtml } from './createFaviconGlyphHtml.mjs';
import { createFaviconSvg } from './createFaviconSvg.mjs';

export const renderFavicon = ({ tileColor, mascotBase64 }) => {
  const outputPath = resolve(WEBSITE_DIRECTORY, 'public/favicon.svg');
  const temporaryHtmlPath = resolve(tmpdir(), `goodboy-favicon-glyph-${process.pid}.html`);
  const temporaryPngPath = resolve(tmpdir(), `goodboy-favicon-glyph-${process.pid}.png`);
  try {
    writeFileSync(temporaryHtmlPath, createFaviconGlyphHtml({ mascotBase64 }));
    execFileSync(CHROME, [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--default-background-color=00000000',
      '--force-device-scale-factor=1',
      `--window-size=${FAVICON_GLYPH_PX},${FAVICON_GLYPH_PX}`,
      `--screenshot=${temporaryPngPath}`,
      pathToFileURL(temporaryHtmlPath).href,
    ]);
    const svgSource = createFaviconSvg({
      tileColor,
      glyphBase64: readFileSync(temporaryPngPath).toString('base64'),
    });
    if (existsSync(outputPath) && readFileSync(outputPath, 'utf8') === svgSource) {
      console.log('favicon.svg already matches the live brand tile, no change needed');
      return;
    }
    writeFileSync(outputPath, svgSource);
    console.log('rendered', outputPath);
  } finally {
    if (existsSync(temporaryHtmlPath)) {
      unlinkSync(temporaryHtmlPath);
    }
    if (existsSync(temporaryPngPath)) {
      unlinkSync(temporaryPngPath);
    }
  }
};
