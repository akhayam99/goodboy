import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { demoStepProblemOf } from './demoStepProblemOf.mjs';

const STEP = {
  group: 'Review and ship',
  resultMs: 420,
  headerAfter: 'Storage freed',
  calloutCoversTarget: false,
  calloutCoversChrome: false,
};

describe('demoStepProblemOf', () => {
  it('passes a step whose result showed and whose callout stays clear', () => {
    assert.equal(demoStepProblemOf({ entry: STEP }), undefined);
  });

  it('passes a last step once the group moved on', () => {
    assert.equal(
      demoStepProblemOf({ entry: { ...STEP, advanceMs: 900, advancedTo: '#get' } }),
      undefined,
    );
  });

  it('fails a last step whose result showed but whose group never moved on', () => {
    assert.equal(
      demoStepProblemOf({ entry: { ...STEP, advanceMs: -1, advancedTo: '#ship' } }),
      'group never moved on; hash: #ship',
    );
  });

  it('fails a step whose result never showed', () => {
    assert.equal(
      demoStepProblemOf({ entry: { ...STEP, resultMs: -1, headerAfter: 'Remove the cache' } }),
      'result never showed; header: Remove the cache',
    );
  });

  it('fails a step whose callout covers its target', () => {
    assert.equal(
      demoStepProblemOf({ entry: { ...STEP, calloutCoversTarget: true } }),
      'callout covers its target or the app chrome',
    );
  });
});
