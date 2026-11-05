import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { escapeLinkText } from '../src/prerender/escapeLinkText.ts';

const HERE = dirname(fileURLToPath(import.meta.url));

describe('escapeLinkText', () => {
  it('escapes a bracket and a backslash so a title cannot end the link', () => {
    assert.equal(
      escapeLinkText({ text: 'Goodboy 0.40.1: fix [beta] x' }),
      'Goodboy 0.40.1: fix \\[beta\\] x',
    );
    assert.equal(escapeLinkText({ text: 'a\\b' }), 'a\\\\b');
  });

  it('leaves a plain title alone', () => {
    assert.equal(
      escapeLinkText({ text: 'Goodboy 0.40.1: Fix startup' }),
      'Goodboy 0.40.1: Fix startup',
    );
  });

  it('is applied to the llms.txt entry title', () => {
    const source = readFileSync(join(HERE, '..', 'src', 'prerender', 'llmsTxt.ts'), 'utf8');
    assert.match(source, /escapeLinkText\(\{ text: page\.title \}\)/);
  });
});
