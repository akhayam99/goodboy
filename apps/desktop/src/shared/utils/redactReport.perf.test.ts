// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { redactReport } from './redactReport';

const REDACT_BUDGET_MS = 250;
const PATHOLOGICAL_LENGTH = 20000;

type TimedParams = {
  readonly text: string;
};

const elapsedMs = ({ text }: TimedParams): number => {
  const startedAt = performance.now();
  redactReport({ text });
  return performance.now() - startedAt;
};

describe('redactReport pathological input', () => {
  it('redacts a dotted local part with no at sign under budget', () => {
    expect(elapsedMs({ text: 'a.'.repeat(PATHOLOGICAL_LENGTH) })).toBeLessThan(REDACT_BUDGET_MS);
  });

  it('redacts a long dotted domain with no top level label under budget', () => {
    const text = `rowan@${'harborline.'.repeat(PATHOLOGICAL_LENGTH / 10)}-`;
    expect(elapsedMs({ text })).toBeLessThan(REDACT_BUDGET_MS);
  });

  it('redacts a run of at signs under budget', () => {
    expect(elapsedMs({ text: 'a@'.repeat(PATHOLOGICAL_LENGTH) })).toBeLessThan(REDACT_BUDGET_MS);
  });

  it('still redacts ordinary addresses', () => {
    const redacted = redactReport({ text: 'mail rowan@mail.harborline.example.com now' });
    expect(redacted).not.toContain('rowan@');
    expect(redacted).toContain('mail ');
  });
});
