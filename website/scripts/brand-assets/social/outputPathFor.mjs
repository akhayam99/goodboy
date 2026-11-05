import { resolve } from 'node:path';
import { WEBSITE_DIRECTORY } from '../paths.mjs';
import { slugFor } from './slugFor.mjs';

export const outputPathFor = (surface) =>
  surface === 'og-image'
    ? resolve(WEBSITE_DIRECTORY, 'public/og-image.png')
    : resolve(WEBSITE_DIRECTORY, `public/brand/${slugFor(surface)}.png`);
