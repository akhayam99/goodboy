import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { expandPictures } from './release-notes.mjs';

const ROOT = 'https://raw.githubusercontent.com/akhayam99/goodboy/v0.37.0/docs/changelog/0.37.0';

const notesWithMeta = ({ meta }) =>
  [
    'A lead sentence.',
    '',
    '### Improved',
    '',
    '#### A clearer light mode',
    meta,
    '',
    'Light mode reads better.',
  ].join('\n');

describe('expandPictures', () => {
  it('follows the reader theme for an entry without theme=', () => {
    const body = expandPictures({
      notes: notesWithMeta({ meta: '<!-- gb area=app image=v1-overview -->' }),
      version: '0.37.0',
    });
    assert.match(body, /<source media="\(prefers-color-scheme: dark\)"/);
    assert.ok(body.includes(`${ROOT}/v1-overview-after-dark.webp`));
    assert.ok(
      body.includes(`<img alt="A clearer light mode" src="${ROOT}/v1-overview-after-light.webp">`),
    );
  });

  it('shows only the light picture for an entry pinned with theme=light', () => {
    const body = expandPictures({
      notes: notesWithMeta({ meta: '<!-- gb area=app image=v1-overview theme=light -->' }),
      version: '0.37.0',
    });
    assert.ok(
      body.includes(`<img alt="A clearer light mode" src="${ROOT}/v1-overview-after-light.webp">`),
    );
    assert.ok(!body.includes('-dark.webp'));
    assert.ok(!body.includes('prefers-color-scheme'));
  });
});
