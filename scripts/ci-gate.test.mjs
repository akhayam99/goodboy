import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { evaluateGate } from './ci-gate.mjs';

const needs = ({
  changes = 'success',
  tests = 'true',
  checks = 'success',
  desktop = 'success',
  packages = 'success',
}) => ({
  changes: { result: changes, outputs: { tests } },
  checks: { result: checks, outputs: {} },
  'test-desktop': { result: desktop, outputs: {} },
  'test-packages': { result: packages, outputs: {} },
});

describe('evaluateGate', () => {
  it('is green when every job succeeded', () => {
    assert.equal(evaluateGate({ needs: needs({}) }).isGreen, true);
  });

  it('is red when changes failed, even if the rest look fine', () => {
    const result = evaluateGate({
      needs: needs({ changes: 'failure', desktop: 'skipped', packages: 'skipped', tests: '' }),
    });
    assert.equal(result.isGreen, false);
  });

  it('is red when one shard failed', () => {
    const result = evaluateGate({ needs: needs({ desktop: 'failure' }) });
    assert.equal(result.isGreen, false);
    assert.match(result.failures.join(' '), /test-desktop: failure/);
  });

  it('is red when the run was cancelled', () => {
    assert.equal(
      evaluateGate({ needs: needs({ desktop: 'cancelled', packages: 'cancelled' }) }).isGreen,
      false,
    );
    assert.equal(evaluateGate({ needs: needs({ changes: 'cancelled' }) }).isGreen, false);
  });

  it('is green on a docs-only change, where the tests are skipped by changes', () => {
    const result = evaluateGate({
      needs: needs({ tests: 'false', desktop: 'skipped', packages: 'skipped' }),
    });
    assert.equal(result.isGreen, true);
  });

  it('is red when a test job is skipped although changes wanted the tests', () => {
    assert.equal(
      evaluateGate({ needs: needs({ tests: 'true', desktop: 'skipped' }) }).isGreen,
      false,
    );
    assert.equal(
      evaluateGate({ needs: needs({ tests: 'true', packages: 'skipped' }) }).isGreen,
      false,
    );
  });

  it('is red when checks is skipped, whatever changes decided', () => {
    assert.equal(
      evaluateGate({
        needs: needs({
          tests: 'false',
          checks: 'skipped',
          desktop: 'skipped',
          packages: 'skipped',
        }),
      }).isGreen,
      false,
    );
  });

  it('is red on a docs-only change when checks failed', () => {
    assert.equal(
      evaluateGate({
        needs: needs({
          tests: 'false',
          checks: 'failure',
          desktop: 'skipped',
          packages: 'skipped',
        }),
      }).isGreen,
      false,
    );
  });

  it('is red when a required job is missing from needs', () => {
    const partial = needs({});
    delete partial['test-packages'];
    assert.equal(evaluateGate({ needs: partial }).isGreen, false);
  });
});

describe('evaluateGate over every needs key', () => {
  it('is red when changes gave no tests output and the test jobs were skipped', () => {
    const missing = needs({ desktop: 'skipped', packages: 'skipped' });
    delete missing.changes.outputs.tests;
    assert.equal(evaluateGate({ needs: missing }).isGreen, false);
    assert.equal(
      evaluateGate({ needs: needs({ tests: '', desktop: 'skipped', packages: 'skipped' }) })
        .isGreen,
      false,
    );
  });

  it('judges a job that is not in the required list too', () => {
    const extra = { ...needs({}), lint: { result: 'failure', outputs: {} } };
    const result = evaluateGate({ needs: extra });
    assert.equal(result.isGreen, false);
    assert.match(result.failures.join(' '), /lint: failure/);
  });

  it('never accepts a skipped job that is not a test job', () => {
    const extra = {
      ...needs({ tests: 'false', desktop: 'skipped', packages: 'skipped' }),
      lint: { result: 'skipped', outputs: {} },
    };
    assert.equal(evaluateGate({ needs: extra }).isGreen, false);
  });
});

describe('ci.yml gate', () => {
  const workflow = readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), '..', '.github', 'workflows', 'ci.yml'),
    'utf8',
  );
  const jobsBlock = workflow.slice(workflow.indexOf('\njobs:\n'));
  const jobIds = [...jobsBlock.matchAll(/^ {2}([a-z][a-z0-9-]*):\s*$/gm)].map((match) => match[1]);
  const gateBlock = jobsBlock.slice(jobsBlock.indexOf('\n  gate:\n'));
  const gateNeeds = gateBlock
    .match(/^ {4}needs:\s*\[([^\]]*)\]/m)?.[1]
    .split(',')
    .map((id) => id.trim());

  it('needs every other job of the workflow', () => {
    assert.ok(gateNeeds, 'gate has a needs list');
    assert.deepEqual([...gateNeeds].sort(), jobIds.filter((id) => id !== 'gate').sort());
  });

  it('runs always, under the required check name', () => {
    assert.match(gateBlock, /^ {4}if: always\(\)\s*$/m);
    assert.match(gateBlock, /^ {4}name: lint \+ typecheck \+ test \+ build\s*$/m);
  });
});
