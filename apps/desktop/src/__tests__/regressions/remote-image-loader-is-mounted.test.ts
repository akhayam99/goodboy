import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const MAIN_TSX = join(__dirname, '..', '..', 'main.tsx');

const source = () => readFileSync(MAIN_TSX, 'utf8');

describe('remote image loader', () => {
  it('is imported from the shared lib that talks to the backend', () => {
    expect(source()).toContain("import { loadRemoteImage } from './shared/lib/remoteImage'");
  });

  it('wraps the app, so a markdown body can offer to load one image', () => {
    const text = source();
    const open = text.indexOf('<RemoteImageLoaderProvider load={loadRemoteImage}>');
    const app = text.indexOf('<App />');
    const close = text.indexOf('</RemoteImageLoaderProvider>');

    expect(open).toBeGreaterThan(-1);
    expect(app).toBeGreaterThan(open);
    expect(close).toBeGreaterThan(app);
  });
});
