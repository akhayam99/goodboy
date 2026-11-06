import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));

export const WEBSITE_DIRECTORY = resolve(SCRIPT_DIRECTORY, '..', '..');
export const REPOSITORY_DIRECTORY = resolve(WEBSITE_DIRECTORY, '..');
export const TAURI_CLI = resolve(REPOSITORY_DIRECTORY, 'apps/desktop/node_modules/.bin/tauri');
export const DESKTOP_ICONS_DIRECTORY = resolve(
  REPOSITORY_DIRECTORY,
  'apps/desktop/src-tauri/icons',
);
