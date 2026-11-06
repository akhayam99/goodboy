import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));

export const WEBSITE_DIRECTORY = resolve(SCRIPT_DIRECTORY, '..', '..');
export const REPO_DIRECTORY = resolve(WEBSITE_DIRECTORY, '..');
export const SOURCE_DIRECTORY = resolve(WEBSITE_DIRECTORY, 'src');
