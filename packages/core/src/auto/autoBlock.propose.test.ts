import { describe, expect, it } from 'vitest';
import { parseAutoBlock } from './autoBlock';
import { parseProposeSpec } from './proposeSpec';
import { buildAutoSystemPrompt } from './prompt';

const proposal = {
  action: 'propose',
  primary: { role: 'scout', task: 'Read ledger-core.', reason: 'Find callers.' },
  alternatives: [{ label: 'Spawn an investigator', role: 'investigator' }],
};

type Params = Readonly<{ value: unknown }>;
const block = ({ value }: Params) => `<<auto>>${JSON.stringify(value)}<</auto>>`;

describe('Auto proposal blocks', () => {
  it('reads the proposal and optional request id into a validated spec', () => {
    for (const requestId of [undefined, 'harborline-next']) {
      const result = parseAutoBlock({ text: block({ value: { ...proposal, requestId } }) });
      if (result.kind !== 'block' || result.block.action !== 'propose') {
        throw new Error('Expected a proposal block');
      }
      expect(result.block.requestId).toBe(requestId ?? null);
      expect(parseProposeSpec({ text: result.block.spec })).toMatchObject({
        kind: 'ok',
        alternatives: proposal.alternatives,
        children: [{ role: 'scout', shouldConfirm: true }],
      });
    }
  });

  it.each([
    { ...proposal, requestId: 7 },
    { ...proposal, requestId: ' ' },
    { action: 'propose' },
    { ...proposal, primary: [] },
    { ...proposal, alternatives: [{ label: 'Spawn a reader', role: 'unknown' }] },
  ])('rejects an invalid proposal block: %j', (value) => {
    expect(parseAutoBlock({ text: block({ value }) }).kind).toBe('invalid');
  });

  it('teaches a parseable proposal instead of a prose permission question', () => {
    const prompt = buildAutoSystemPrompt({ isDelegationEnabled: true });
    const line = prompt.split('\n').find((candidate) => candidate.startsWith('- Propose:')) ?? '';
    expect(line).toContain('never ask yes or no in prose');
    expect(line).toContain('at most two alternatives');
    expect(parseAutoBlock({ text: line })).toMatchObject({
      kind: 'block',
      block: { action: 'propose' },
    });
    expect(buildAutoSystemPrompt({ isDelegationEnabled: true, level: 'run' })).toContain(
      'At Never, delegate instead.',
    );
    expect(buildAutoSystemPrompt({ isDelegationEnabled: false })).not.toContain(
      '"action":"propose"',
    );
  });
});
