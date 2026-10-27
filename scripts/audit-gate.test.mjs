import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { classifyAudit, verdictOf } from './audit-gate.mjs';

describe('classifyAudit', () => {
  it('reads exit 0 as clean', () => {
    assert.equal(classifyAudit({ status: 0, output: 'No known vulnerabilities found' }), 'clean');
  });

  it('reads a table with a count as an advisory', () => {
    assert.equal(
      classifyAudit({ status: 1, output: '2 vulnerabilities found\nSeverity: 1 high | 1 low' }),
      'advisory',
    );
    assert.equal(classifyAudit({ status: 1, output: '1 vulnerability found' }), 'advisory');
  });

  it('reads a registry failure as unavailable, not as an advisory', () => {
    assert.equal(
      classifyAudit({ status: 1, output: 'ERR_PNPM_AUDIT_BAD_RESPONSE The audit endpoint failed' }),
      'unavailable',
    );
  });

  it('reads a timeout as unavailable', () => {
    assert.equal(classifyAudit({ status: null, output: '', isTimedOut: true }), 'unavailable');
  });
});

describe('verdictOf', () => {
  it('fails only on an advisory', () => {
    assert.equal(verdictOf({ result: 'advisory' }).exitCode, 1);
    assert.equal(verdictOf({ result: 'clean' }).exitCode, 0);
    assert.equal(verdictOf({ result: 'unavailable' }).exitCode, 0);
  });

  it('says a timeout is a notice and an advisory an error', () => {
    assert.match(verdictOf({ result: 'unavailable' }).line, /^::notice /);
    assert.match(verdictOf({ result: 'advisory' }).line, /^::error /);
  });
});
