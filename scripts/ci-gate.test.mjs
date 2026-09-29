import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
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
    assert.equal(evaluateGate({ needs: needs({}) }).ok, true);
  });

  it('is red when changes failed, even if the rest look fine', () => {
    const result = evaluateGate({
      needs: needs({ changes: 'failure', desktop: 'skipped', packages: 'skipped', tests: '' }),
    });
    assert.equal(result.ok, false);
  });

  it('is red when one shard failed', () => {
    const result = evaluateGate({ needs: needs({ desktop: 'failure' }) });
    assert.equal(result.ok, false);
    assert.match(result.failures.join(' '), /test-desktop: failure/);
  });

  it('is red when the run was cancelled', () => {
    assert.equal(
      evaluateGate({ needs: needs({ desktop: 'cancelled', packages: 'cancelled' }) }).ok,
      false,
    );
    assert.equal(evaluateGate({ needs: needs({ changes: 'cancelled' }) }).ok, false);
  });

  it('is green on a docs-only change, where the tests are skipped by changes', () => {
    const result = evaluateGate({
      needs: needs({ tests: 'false', desktop: 'skipped', packages: 'skipped' }),
    });
    assert.equal(result.ok, true);
  });

  it('is red when a test job is skipped although changes wanted the tests', () => {
    assert.equal(evaluateGate({ needs: needs({ tests: 'true', desktop: 'skipped' }) }).ok, false);
    assert.equal(evaluateGate({ needs: needs({ tests: 'true', packages: 'skipped' }) }).ok, false);
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
      }).ok,
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
      }).ok,
      false,
    );
  });

  it('is red when a required job is missing from needs', () => {
    const partial = needs({});
    delete partial['test-packages'];
    assert.equal(evaluateGate({ needs: partial }).ok, false);
  });
});
