import { describe, expect, it } from 'vitest';
import { extractStepDone } from '../context/marker-parsing';
import { AUTO_DELEGATION_ROLES, isAutoWriterRole } from './roles';
import {
  AUTO_DEFAULT_DONE_WHEN,
  AUTO_DEPENDENCIES_RULE,
  AUTO_KICKOFF_HEADER,
  composeAnswerKickoff,
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

describe('the kickoff of an answered question', () => {
  const answered = {
    childAgentId: 'agent-implementer-1',
    question: 'Which format?',
    answer: 'Json.',
  };

  it('holds only the question and the answer when the session is kept', () => {
    const text = composeAnswerKickoff(answered);
    expect(text).toContain('**Your question** Which format?');
    expect(text).toContain('**Answer** Json.');
    expect(text).not.toContain('Your session was not kept');
  });

  it('puts the first brief and where the child stopped before the question when it is not kept', () => {
    const text = composeAnswerKickoff({
      ...answered,
      memory: { brief: '**Task** add the export', tail: 'Wrote the header.' },
    });
    expect(text.indexOf('**Task** add the export')).toBeLessThan(text.indexOf('**Your question**'));
    expect(text).toContain('**Where you stopped** Wrote the header.');
  });

  it('leaves out where the child stopped when nothing was kept', () => {
    const text = composeAnswerKickoff({ ...answered, memory: { brief: '**Task** x', tail: null } });
    expect(text).not.toContain('**Where you stopped**');
  });
});

describe('the kickoff of a delegated child', () => {
  it('tells the child to follow a settling decision instead of asking', () => {
    const text = composeDelegationKickoff(base());
    expect(text).toContain('follow it and do not ask');
    expect(text).toContain('even when it says assumed or proposed');
  });

  it('starts with the header that says who started the child and where a question goes', () => {
    const text = composeDelegationKickoff(base());
    expect(text.startsWith(AUTO_KICKOFF_HEADER)).toBe(true);
    expect(AUTO_KICKOFF_HEADER).toContain('A question you ask goes to Auto first.');
  });

  it('puts the decisions of the brief before the task and writes nothing without them', () => {
    const decisions = '**Decisions** Written in full.\n- D27 Round once per batch.';
    const text = composeDelegationKickoff(base({ decisions }));
    expect(text.indexOf(decisions)).toBeGreaterThan(0);
    expect(text.indexOf(decisions)).toBeLessThan(text.indexOf('**Task**'));
    expect(composeDelegationKickoff(base())).not.toContain('**Decisions**');
  });

  it('lets a writer put a long report in a report artifact and keeps the scout expectation', () => {
    for (const role of ['implementer', 'tester', 'docs', 'ci-fixer'] as const) {
      expect(composeDelegationKickoff(base({ role }))).toContain('<<artifact v=1 kind=report>>');
    }
    expect(composeDelegationKickoff(base({ role: 'scout', mountLabel: null }))).toContain(
      '**Expected output** A report artifact',
    );
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

  it('tells every writer to install missing dependencies in its own mount, and no reader', () => {
    for (const role of AUTO_DELEGATION_ROLES) {
      const text = composeDelegationKickoff(base({ role }));
      expect(text.includes(AUTO_DEPENDENCIES_RULE)).toBe(isAutoWriterRole({ role }));
    }
    expect(AUTO_DEPENDENCIES_RULE).toContain('Never link or copy node_modules');
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

  it('tells an implementer that nothing is pushed', () => {
    const text = composeDelegationKickoff(base({ role: 'implementer' }));
    expect(text).toContain('Nothing is pushed.');
    expect(AUTO_DEFAULT_DONE_WHEN.implementer.endsWith('Nothing is pushed.')).toBe(true);
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

describe('the guidance of one run in a child brief', () => {
  const GUIDANCE = 'Keep every change inside payments-api.';

  it('puts a Guidance section right before the task', () => {
    const text = composeDelegationKickoff(base({ guidance: GUIDANCE }));

    expect(text).toContain(`**Guidance**\n${GUIDANCE}\n\n**Task** add the ledger export`);
  });

  it('puts the Guidance section before the revise task too', () => {
    const text = composeDelegationKickoff(
      base({
        guidance: GUIDANCE,
        revise: {
          artifactId: 'artifact-plan-1',
          kind: 'plan',
          title: 'Plan for notify-relay',
          revision: 1,
          body: '# Plan v1',
          userWords: [],
          autoReading: null,
          history: [],
        },
      }),
    );

    expect(text.indexOf('**Guidance**')).toBeGreaterThan(-1);
    expect(text.indexOf('**Guidance**')).toBeLessThan(text.indexOf('**Task** Revise the plan'));
  });

  it('leaves the brief byte for byte the same when the guidance is unset, null or blank', () => {
    const plain = composeDelegationKickoff(base());

    expect(composeDelegationKickoff(base({ guidance: null }))).toBe(plain);
    expect(composeDelegationKickoff(base({ guidance: '   ' }))).toBe(plain);
    expect(plain).not.toContain('**Guidance**');
  });
});
