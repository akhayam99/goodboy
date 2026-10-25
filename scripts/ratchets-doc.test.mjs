import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { discoverFiles } from './check-baselines.mjs';
import { RULES } from './rules/forbiddenPatterns.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DOC = readFileSync(resolve(REPO, 'docs/ratchets.md'), 'utf8');

const missingFrom = ({ doc, names }) => names.filter((name) => !doc.includes(name));

test('a name the page lacks is reported', () => {
  const doc = '`northwind.baseline.json`';
  const names = ['northwind.baseline.json', 'harborline.baseline.json'];
  assert.deepEqual(missingFrom({ doc, names }), ['harborline.baseline.json']);
});

test('every baseline file is named in docs/ratchets.md', () => {
  const names = discoverFiles()
    .filter(({ kind }) => kind === 'json')
    .map(({ path }) => basename(path));
  assert.ok(names.length > 0);
  assert.deepEqual(missingFrom({ doc: DOC, names }), []);
});

test('every ALLOWED map is named in docs/ratchets.md', () => {
  const names = discoverFiles()
    .filter(({ kind }) => kind === 'allowed')
    .map(({ path }) => basename(path));
  assert.ok(names.length > 0);
  assert.deepEqual(missingFrom({ doc: DOC, names }), []);
});

test('the page says which rules scan tests', () => {
  assert.match(DOC, /Tests are scanned only by `comment` and `em-dash`/);
});

const CARD_LINE = /^\d+\. .*\(([^()]*)\)\.$/;
const SPECIAL_GUARDS = new Set(['ratchet']);

const guardsOnCard = ({ text }) =>
  text.split('\n').flatMap((line) => {
    const inner = CARD_LINE.exec(line)?.[1];
    return inner === undefined ? [] : [...inner.matchAll(/`([^`]+)`/g)].map((match) => match[1]);
  });

const isRealGuard = ({ guard, ruleIds, eslint, scripts, regressions }) => {
  return (
    ruleIds.includes(guard) ||
    eslint.includes(`'${guard}'`) ||
    scripts.includes(guard) ||
    regressions.some((name) => name.startsWith(`${guard}.`)) ||
    SPECIAL_GUARDS.has(guard)
  );
};

test('every guard on the rules card exists', () => {
  const card = readFileSync(resolve(REPO, 'AGENTS.md'), 'utf8');
  const guards = guardsOnCard({ text: card });
  assert.ok(guards.length >= 15);
  const context = {
    ruleIds: RULES.map(({ id }) => id),
    eslint: readFileSync(resolve(REPO, 'eslint.config.mjs'), 'utf8'),
    scripts: Object.keys(JSON.parse(readFileSync(resolve(REPO, 'package.json'), 'utf8')).scripts),
    regressions: readdirSync(resolve(REPO, 'apps/desktop/src/__tests__/regressions')),
  };
  const unknown = guards.filter((guard) => !isRealGuard({ guard, ...context }));
  assert.deepEqual(unknown, []);
});
