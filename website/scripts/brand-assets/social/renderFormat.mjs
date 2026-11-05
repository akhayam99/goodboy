import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { CHROME } from '../chrome.mjs';
import { outputPathFor } from './outputPathFor.mjs';
import { slugFor } from './slugFor.mjs';

export const renderFormat = ({ format, html }) => {
  const outputPath = outputPathFor(format.surface);
  const temporaryPath = resolve(
    tmpdir(),
    `goodboy-brand-${slugFor(format.surface)}-${process.pid}.html`,
  );
  mkdirSync(dirname(outputPath), { recursive: true });
  try {
    writeFileSync(temporaryPath, html);
    execFileSync(CHROME, [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      `--force-device-scale-factor=${format.scale}`,
      `--window-size=${format.width},${format.height}`,
      `--screenshot=${outputPath}`,
      pathToFileURL(temporaryPath).href,
    ]);
    console.log('rendered', outputPath);
  } finally {
    if (existsSync(temporaryPath)) {
      unlinkSync(temporaryPath);
    }
  }
};
