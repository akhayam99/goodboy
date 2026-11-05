import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { CHROME } from '../chrome.mjs';
import { DESKTOP_ICONS_DIRECTORY, TAURI_CLI } from '../paths.mjs';
import { APP_ICON_PX, DEV_ICON_FILES } from '../tileMetrics.mjs';
import { carriesSameIcons } from './carriesSameIcons.mjs';
import { createAppIconHtml } from './createAppIconHtml.mjs';
import { renderDevIcon } from './renderDevIcon.mjs';

export const renderAppIcons = ({ tileColor, mascotBase64 }) => {
  if (!existsSync(TAURI_CLI)) {
    throw new Error(`The Tauri CLI is missing at ${TAURI_CLI}. Run pnpm install first.`);
  }
  const temporaryHtmlPath = resolve(tmpdir(), `goodboy-app-icon-${process.pid}.html`);
  const temporaryPngPath = resolve(tmpdir(), `goodboy-app-icon-${process.pid}.png`);
  const temporaryIconsDirectory = resolve(tmpdir(), `goodboy-app-icons-${process.pid}`);
  try {
    writeFileSync(temporaryHtmlPath, createAppIconHtml({ tileColor, mascotBase64 }));
    execFileSync(CHROME, [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      `--window-size=${APP_ICON_PX},${APP_ICON_PX}`,
      `--screenshot=${temporaryPngPath}`,
      pathToFileURL(temporaryHtmlPath).href,
    ]);
    mkdirSync(temporaryIconsDirectory, { recursive: true });
    execFileSync(TAURI_CLI, ['icon', temporaryPngPath, '-o', temporaryIconsDirectory], {
      stdio: 'ignore',
    });
    DEV_ICON_FILES.forEach((name) =>
      renderDevIcon({ name, tileColor, mascotBase64, temporaryIconsDirectory }),
    );
    const stale = readdirSync(DESKTOP_ICONS_DIRECTORY)
      .filter((name) => existsSync(resolve(temporaryIconsDirectory, name)))
      .filter(
        (name) =>
          !carriesSameIcons({
            name,
            current: readFileSync(resolve(DESKTOP_ICONS_DIRECTORY, name)),
            next: readFileSync(resolve(temporaryIconsDirectory, name)),
          }),
      );
    if (stale.length === 0) {
      console.log('the desktop icons already match the live brand tile, no change needed');
      return;
    }
    stale.forEach((name) => {
      writeFileSync(
        resolve(DESKTOP_ICONS_DIRECTORY, name),
        readFileSync(resolve(temporaryIconsDirectory, name)),
      );
    });
    console.log('rendered', stale.length, 'desktop icons in', DESKTOP_ICONS_DIRECTORY);
  } finally {
    if (existsSync(temporaryHtmlPath)) {
      unlinkSync(temporaryHtmlPath);
    }
    if (existsSync(temporaryPngPath)) {
      unlinkSync(temporaryPngPath);
    }
    rmSync(temporaryIconsDirectory, { recursive: true, force: true });
  }
};
