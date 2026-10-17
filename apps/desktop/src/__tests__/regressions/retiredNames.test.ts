// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { RETIRED_NAMES } from './retiredNames';

type Params = {
  readonly text: string;
};

const retiredIdsIn = ({ text }: Params): ReadonlyArray<string> =>
  RETIRED_NAMES.filter((retired) => retired.pattern.test(text)).map((retired) => retired.id);

describe('retired names match whatever the casing', () => {
  it.each(['Close inbox', 'Refresh inbox', 'refresh inbox', 'INBOX'])('flags %s', (text) => {
    expect(retiredIdsIn({ text })).toContain('inbox-door');
  });

  it('flags a lowercase worktree name', () => {
    expect(retiredIdsIn({ text: 'close worktree' })).toContain('close-worktree');
  });

  it.each(['Spend cap', 'Raise spend cap', 'over its spend cap'])('flags %s for Limit', (text) => {
    expect(retiredIdsIn({ text })).toContain('spend-cap');
  });

  it('leaves the spend_cap cause key alone', () => {
    expect(retiredIdsIn({ text: 'spend_cap' })).toEqual([]);
  });

  it.each([
    ['Ask an agent', 'ask-an-agent'],
    ['Start agent', 'start-agent'],
    ['Start Auto', 'start-auto'],
    ['Orchestrate', 'orchestrate-verb'],
    ['Start another run', 'start-a-run'],
    ['Start a run', 'start-a-run'],
  ])('flags the old start label %s', (text, id) => {
    expect(retiredIdsIn({ text })).toContain(id);
  });

  it.each([
    'Run a workflow',
    'Run an orchestrator',
    'Start an agent',
    'Start an auto',
    'Orchestrated',
  ])('leaves the start verb %s alone', (text) => {
    expect(retiredIdsIn({ text })).toEqual([]);
  });

  it('leaves a data attribute alone', () => {
    expect(retiredIdsIn({ text: '[data-inbox-key="a"]' })).toEqual([]);
  });
});
