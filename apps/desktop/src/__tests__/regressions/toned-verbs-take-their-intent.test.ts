// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';
import { describe, expect, it } from 'vitest';
import { actionIntentOf } from '../../features/actions/actionIntentOf';

const SOURCE_ROOT = join(__dirname, '..', '..');
const SKIP_SEGMENTS = new Set(['__tests__', 'node_modules', 'MockScene']);
const OPEN_TAG = '<Button';
const CLOSE_TAG = '</Button>';

type WalkParams = {
  readonly dir: string;
};

const sourceFilesOf = ({ dir }: WalkParams): ReadonlyArray<string> =>
  readdirSync(dir).flatMap((name) => {
    if (SKIP_SEGMENTS.has(name)) {
      return [];
    }
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return sourceFilesOf({ dir: path });
    }
    return name.endsWith('.tsx') && !name.includes('.test.') ? [path] : [];
  });

type TagParams = {
  readonly source: string;
  readonly from: number;
};

const openTagEndOf = ({ source, from }: TagParams): number => {
  let depth = 0;
  for (let index = from; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') {
      depth += 1;
    }
    if (char === '}') {
      depth -= 1;
    }
    if (char === '>' && depth === 0) {
      return index;
    }
  }
  return -1;
};

type TextParams = {
  readonly body: string;
};

const plainTextOf = ({ body }: TextParams): string => {
  let text = '';
  let depth = 0;
  let isInTag = false;
  for (const char of body) {
    if (char === '{') {
      depth += 1;
      continue;
    }
    if (char === '}') {
      depth -= 1;
      continue;
    }
    if (depth > 0) {
      continue;
    }
    if (char === '<') {
      isInTag = true;
      continue;
    }
    if (char === '>') {
      isInTag = false;
      continue;
    }
    if (!isInTag) {
      text += char;
    }
  }
  return text.split(/\s+/).join(' ').trim();
};

type VerbParams = {
  readonly text: string;
};

const NEUTRAL_LABELS: ReadonlySet<string> = new Set(['stop keeping', 'stop drafting']);

const tonedVerbOf = ({ text }: VerbParams): string | null => {
  const lower = text.toLowerCase();
  if (NEUTRAL_LABELS.has(lower)) {
    return null;
  }
  const words = lower.split(' ');
  for (let length = Math.min(3, words.length); length > 0; length -= 1) {
    const verb = words.slice(0, length).join(' ');
    const intent = actionIntentOf({ verb });
    if (intent === 'caution' || intent === 'destructive') {
      return verb;
    }
  }
  return null;
};

type FileParams = {
  readonly path: string;
};

const untonedButtonsOf = ({ path }: FileParams): ReadonlyArray<string> => {
  const source = readFileSync(path, 'utf8');
  const found: Array<string> = [];
  let cursor = source.indexOf(OPEN_TAG);
  while (cursor !== -1) {
    const tagEnd = openTagEndOf({ source, from: cursor + OPEN_TAG.length });
    const close = tagEnd === -1 ? -1 : source.indexOf(CLOSE_TAG, tagEnd);
    if (tagEnd !== -1 && close !== -1 && source[tagEnd - 1] !== '/') {
      const attributes = source.slice(cursor, tagEnd);
      const verb = tonedVerbOf({ text: plainTextOf({ body: source.slice(tagEnd + 1, close) }) });
      const hasIntent =
        attributes.includes('intent=') ||
        attributes.includes('actionButtonLookOf(') ||
        attributes.includes('_LOOK') ||
        attributes.includes('{...look}');
      if (verb !== null && !hasIntent) {
        const line = source.slice(0, cursor).split('\n').length;
        found.push(`${relative(SOURCE_ROOT, path).split(sep).join('/')}:${line} ${verb}`);
      }
    }
    cursor = source.indexOf(OPEN_TAG, cursor + OPEN_TAG.length);
  }
  return found;
};

describe('a caution or destructive verb takes its intent', () => {
  it('routes every Rebase, Reset, Discard, Delete and Stop button through actionIntentOf', () => {
    const offenders = sourceFilesOf({ dir: SOURCE_ROOT }).flatMap((path) =>
      untonedButtonsOf({ path }),
    );
    expect(offenders).toEqual([]);
  });
});
