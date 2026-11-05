import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { CHROME } from '../chrome.mjs';
import { PNG_WIDTH_OFFSET_BYTES } from '../tileMetrics.mjs';
import { createDevIconHtml } from './createDevIconHtml.mjs';

export const renderDevIcon = ({ name, tileColor, mascotBase64, temporaryIconsDirectory }) => {
  const outputPath = resolve(temporaryIconsDirectory, name);
  const canvasPx = readFileSync(outputPath).readUInt32BE(PNG_WIDTH_OFFSET_BYTES);
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const temporaryHtmlPath = resolve(tmpdir(), `goodboy-dev-icon-${slug}-${process.pid}.html`);
  try {
    writeFileSync(temporaryHtmlPath, createDevIconHtml({ tileColor, mascotBase64, canvasPx }));
    execFileSync(CHROME, [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--default-background-color=00000000',
      '--force-device-scale-factor=1',
      `--window-size=${canvasPx},${canvasPx}`,
      `--screenshot=${outputPath}`,
      pathToFileURL(temporaryHtmlPath).href,
    ]);
  } finally {
    if (existsSync(temporaryHtmlPath)) {
      unlinkSync(temporaryHtmlPath);
    }
  }
};
