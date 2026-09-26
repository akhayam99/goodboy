import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { parseUpdateNotes } from './parseUpdateNotes';

const CHANGELOG_PATH = join(__dirname, '..', '..', '..', '..', '..', 'CHANGELOG.md');

describe('parseUpdateNotes', () => {
  it('parses the updater body into the same shape as the packaged release', () => {
    const content = readFileSync(CHANGELOG_PATH, 'utf8');
    const lines = content.split('\n');
    const startIndex = lines.findIndex((line) => line === '## Goodboy v0.7.0');
    const endIndex = lines.findIndex((line, index) => index > startIndex && line.startsWith('## '));
    const body = lines
      .slice(startIndex + 1, endIndex)
      .join('\n')
      .trim();

    const notes = parseUpdateNotes({ version: '0.7.0', body });

    expect(notes?.shape).toBe('v2');
    expect(notes?.version).toBe('0.7.0');
    expect(notes?.sections.new.length).toBe(3);
  });

  it('returns null for empty notes', () => {
    expect(parseUpdateNotes({ version: '9.9.9', body: '' })).toBeNull();
  });
});
