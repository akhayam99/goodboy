import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { WEBSITE_DIRECTORY } from '../paths.mjs';

const FEATURES_DATA_PATH = resolve(WEBSITE_DIRECTORY, 'src/pages/features/features.data.json');

export const readClusters = () => JSON.parse(readFileSync(FEATURES_DATA_PATH, 'utf8')).clusters;
