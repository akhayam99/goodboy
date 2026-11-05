import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { WEBSITE_DIRECTORY } from '../paths.mjs';

const BRAND_SOURCES_PATH = resolve(WEBSITE_DIRECTORY, 'src/components/brandIcons.source.json');

export const readBrandSources = () =>
  existsSync(BRAND_SOURCES_PATH) ? JSON.parse(readFileSync(BRAND_SOURCES_PATH, 'utf8')) : [];
