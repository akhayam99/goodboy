import { describe, expect, it } from 'vitest';
import { extractStepDone } from '../context/marker-parsing';
import { AUTO_DELEGATION_ROLES } from './roles';
import {
  AUTO_DEFAULT_DONE_WHEN,
  AUTO_KICKOFF_HEADER,
  composeDelegationKickoff,
  type DelegationKickoffParams,
} from './kickoff';

const base = (overrides: Partial<DelegationKickoffParams> = {}): DelegationKickoffParams => ({
  role: 'implementer',
  childAgentId: 'agent-implementer-1',
  task: 'add the ledger export to ledger-core',
  doneWhen: null,
  expected: null,
  inputs: [],
  revise: null,
  mountLabel: 'mount-ledger-core (ledger-core, branch ak/ledger-export)',
  ...overrides,
});

describe('the kickoff of a delegated child', () => {
  it('starts with the header that says who started the child and where a question goes', () => {
    const text = composeDelegationKickoff(base());
    expect(text.startsWith(AUTO_KICKOFF_HEADER)).toBe(true);
    expect(AUTO_KICKOFF_HEADER).toContain('A question you ask goes to Auto first.');
  });

  it('forbids a child to split its work or start agents of its own', () => {
    for (const marker of ['<<fan-out>>', '<<scout-split>>', '<<handoff>>']) {
      expect(AUTO_KICKOFF_HEADER).toContain(marker);
    }
    expect(AUTO_KICKOFF_HEADER).toContain('never start other agents yourself');
  });

  it('ends with a closing line the app can read back for that exact agent', () => {
    const text = composeDelegationKickoff(base());
    expect(extractStepDone(text)?.id).toBe('agent-implementer-1');
    expect(text).toContain('<<ctx-question blocking="true">>');
  });

  it('tells a writer which mount it changes and a reader that it never changes a file', () => {
    expect(composeDelegationKickoff(base())).toContain('**Mount** mount-ledger-core');
    const reader = composeDelegationKickoff(base({ role: 'scout', mountLabel: null }));
    expect(reader).toContain('You read only. You never change a file.');
    expect(reader).not.toContain('**Mount**');
  });

  it('says on a retry that the earlier attempt did not finish, right after the role', () => {
    const text = composeDelegationKickoff(
      base({ retryNote: 'The earlier attempt ended timed_out (deadline_passed).' }),
    );
    expect(text).toContain('**Retry** The earlier attempt ended timed_out (deadline_passed).');
    expect(text.indexOf('**Retry**')).toBeGreaterThan(text.indexOf('**Role**'));
    expect(text.indexOf('**Retry**')).toBeLessThan(text.indexOf('**Task**'));
    expect(composeDelegationKickoff(base())).not.toContain('**Retry**');
  });

  it('uses the role default for done-when and keeps a given one', () => {
    for (const role of AUTO_DELEGATION_ROLES) {
      expect(composeDelegationKickoff(base({ role }))).toContain(AUTO_DEFAULT_DONE_WHEN[role]);
    }
    const given = composeDelegationKickoff(base({ doneWhen: 'the build passes' }));
    expect(given).toContain('**Done when** the build passes');
    expect(given).not.toContain(AUTO_DEFAULT_DONE_WHEN.implementer);
  });

  it('forbids handing work on, fan-out and subagents', () => {
    const text = composeDelegationKickoff(base());
    expect(text).toContain('Do not hand the work to another agent');
    expect(text).toContain('do not start subagents');
  });

  it('passes earlier artifacts in full, with id and version', () => {
    const text = composeDelegationKickoff(
      base({
        inputs: [
          {
            artifactId: 'artifact-plan-1',
            kind: 'plan',
            title: 'Plan for notify-relay',
            revision: 3,
            body: '# Plan\n\n- step one',
          },
        ],
      }),
    );
    expect(text).toContain('**Earlier plan** Plan for notify-relay (artifact-plan-1, version 3)');
    expect(text).toContain('# Plan\n\n- step one');
  });

  it('builds a revise request in the order the design fixes', () => {
    const text = composeDelegationKickoff(
      base({
        role: 'planner',
        childAgentId: 'agent-planner-1',
        mountLabel: null,
        revise: {
          artifactId: 'artifact-plan-1',
          kind: 'plan',
          title: 'Plan for notify-relay',
          revision: 2,
          body: '# Plan v2',
          userWords: ['drop the second step', 'keep the rollout'],
          autoReading: 'remove step two only',
          history: [{ revision: 2, author: 'agent', ask: 'add a rollout' }],
        },
      }),
    );
    const order = [
      'Revise the plan Plan for notify-relay, now at version 2, into version 3',
      '**The user wrote (verbatim)**\ndrop the second step\nkeep the rollout',
      "**Auto's reading** remove step two only",
      '**Rules** Write the full updated plan as one plan block, never a patch',
      '**Earlier changes, newest first**',
      '**Current version 2**\n# Plan v2',
    ].map((part) => text.indexOf(part));
    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });
});
