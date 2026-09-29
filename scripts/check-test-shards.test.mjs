import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { verifyShards } from './check-test-shards.mjs';

describe('verifyShards', () => {
  it('accepts shards that list every file exactly once', () => {
    const problems = verifyShards({
      all: ['a', 'b', 'c', 'd'],
      shards: [['a'], ['b'], ['c'], ['d']],
    });
    assert.deepEqual(problems, []);
  });

  it('reports a file that no shard lists', () => {
    const problems = verifyShards({ all: ['a', 'b', 'c', 'd'], shards: [['a'], ['b'], ['c'], []] });
    assert.match(problems.join('\n'), /d is in no shard/);
    assert.match(problems.join('\n'), /shard 4 lists no test file/);
  });

  it('reports a file that two shards list', () => {
    const problems = verifyShards({ all: ['a', 'b'], shards: [['a', 'b'], ['b'], ['a'], ['a']] });
    assert.match(problems.join('\n'), /b is in shards 1, 2/);
  });

  it('reports a file the full list does not know', () => {
    const problems = verifyShards({ all: ['a'], shards: [['a'], ['x'], ['y'], ['z']] });
    assert.match(problems.join('\n'), /x is in a shard but not in the full list/);
  });
});

describe('ci.yml shard matrix', () => {
  const workflow = readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), '..', '.github', 'workflows', 'ci.yml'),
    'utf8',
  );

  it('runs the four shards this check covers', () => {
    assert.match(workflow, /shard: \[1, 2, 3, 4\]/);
    assert.match(workflow, /--shard=\$\{\{ matrix\.shard \}\}\/4/);
  });
});
