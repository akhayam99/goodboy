import { describe, expect, it } from 'vitest';
import type {
  AgentId,
  HandoffSender,
  IsoDateTime,
  OpenQuestionId,
  PlanId,
  WorkflowRunId,
} from '@goodboy/types';
import { buildHandoff, handoffLine, type BuildHandoffParams } from './buildHandoff';

const RUN = 'run-1' as WorkflowRunId;

const base = (): BuildHandoffParams => ({
  agentId: 'agent-4' as AgentId,
  provider: 'anthropic',
  createdAt: '2026-09-25T12:04:00.000Z' as IsoDateTime,
  sender: { kind: 'orchestrator', workflowRunId: RUN, stepOrdinal: 4 },
  instruction:
    'Replay every batch settled since Jul 1 through settle_batch. Keep the old path behind a flag.',
  machineInstructions: null,
  why: 'Rounding now lands once per batch.',
  doneWhen: 'A dry run report lists every batch.',
  goal: 'Settlement totals are off by a few cents per batch.',
  earlierSteps: [
    { agentId: 'agent-1' as AgentId, ordinal: 1, name: 'Trace the rounding', summary: null },
    {
      agentId: 'agent-3' as AgentId,
      ordinal: 3,
      name: 'Round once per batch',
      summary: 'Rounding moved to settle_batch. 3 tests updated.',
    },
  ],
  plan: { id: 'plan-1' as PlanId, title: 'Round once per batch' },
  files: [{ label: 'settlement-drift.csv', path: '/tmp/settlement-drift.csv' }],
  threads: [],
  scopeSummary: 'Writes ledger-core',
  rules: [
    { label: 'Projects', text: '[projects-scope]\nWrites ledger-core.\n[/projects-scope]' },
    { label: 'Language', text: '' },
  ],
  profile: '[user-profile]\nTech lead.\n[/user-profile]',
  role: { label: 'Implementer', instructions: 'you are an implementation agent.', isEdited: false },
  sent: { system: 'system text', message: 'message text' },
});

describe('buildHandoff', () => {
  it('lists only the sections the agent received, in a fixed order', () => {
    const handoff = buildHandoff(base());

    expect(handoff.sections.map((section) => section.kind)).toEqual([
      'ask',
      'goal',
      'earlierSteps',
      'plan',
      'files',
      'scope',
      'profile',
      'role',
    ]);
    expect(handoff.ask).toBe('Replay every batch settled since Jul 1 through settle_batch.');
    expect(handoff.why).toBe('Rounding now lands once per batch.');
    expect(handoff.doneWhen).toBe('A dry run report lists every batch.');
    expect(handoff.sentSystem).toBe('system text');
    expect(handoff.sentMessage).toBe('message text');
  });

  it('summarizes each section in one line', () => {
    const sections = buildHandoff(base()).sections;
    const summary = (kind: string) => sections.find((section) => section.kind === kind)?.summary;

    expect(summary('ask')).toBe(
      'Replay every batch settled since Jul 1 through settle_batch. Done when: A dry run report lists every batch.',
    );
    expect(summary('earlierSteps')).toBe('2 steps passed their results to this one');
    expect(summary('plan')).toBe('Round once per batch');
    expect(summary('scope')).toBe('Writes ledger-core');
    expect(summary('role')).toBe('Implementer · built in');
    expect(sections.find((section) => section.kind === 'earlierSteps')?.refs).toEqual([
      {
        kind: 'agent',
        agentId: 'agent-3',
        ordinal: 3,
        label: 'Round once per batch',
        detail: 'Rounding moved to settle_batch.',
      },
      {
        kind: 'agent',
        agentId: 'agent-1',
        ordinal: 1,
        label: 'Trace the rounding',
        detail: null,
      },
    ]);
  });

  it.each<HandoffSender>([
    { kind: 'you' },
    { kind: 'workflowStep', workflowRunId: RUN, stepOrdinal: 3, stepCount: 5 },
    { kind: 'resolve', threadIds: ['t1'], prNumber: 412 },
    { kind: 'recheck', threadIds: ['t1'], prNumber: 412 },
    { kind: 'scribe' },
    { kind: 'historyRewrite' },
    { kind: 'parent', parentAgentId: 'agent-2' as AgentId, label: 'cluster 2 of 3' },
    { kind: 'question', questionId: 'q1' as OpenQuestionId },
    { kind: 'followUp', sourceAgentId: 'agent-2' as AgentId },
  ])('keeps the sender %o', (sender) => {
    expect(buildHandoff({ ...base(), sender }).sender).toEqual(sender);
  });

  it('turns resolve threads into one section', () => {
    const handoff = buildHandoff({
      ...base(),
      sender: { kind: 'resolve', threadIds: ['t1'], prNumber: 412 },
      threads: [
        {
          threadId: 't1',
          author: 'mira',
          location: 'src/settle/batch.rs:42',
          link: 'https://example.test/pr/412#t1',
          body: 'Round **once** per batch here. Not per line.',
        },
      ],
    });

    const threads = handoff.sections.find((section) => section.kind === 'threads');
    expect(threads?.summary).toBe('1 comment');
    expect(threads?.refs).toEqual([
      {
        kind: 'thread',
        threadId: 't1',
        label: 'Round once per batch here.',
        author: 'mira',
        location: 'src/settle/batch.rs:42',
        link: 'https://example.test/pr/412#t1',
      },
    ]);
  });

  it('puts the machine rules in their own Instructions section after the ask', () => {
    const handoff = buildHandoff({
      ...base(),
      sender: { kind: 'resolve', threadIds: ['t1'], prNumber: 412 },
      instruction: 'Fix the retry cap.',
      machineInstructions: 'Reply contract: end with <<comment-resolved>>.',
      sent: {
        system: null,
        message: 'Fix the retry cap.\n\nReply contract: end with <<comment-resolved>>.',
      },
    });

    const kinds = handoff.sections.map((section) => section.kind);
    const instructions = handoff.sections.find((section) => section.kind === 'instructions');

    expect(kinds.indexOf('instructions')).toBe(kinds.indexOf('ask') + 1);
    expect(instructions?.summary).toBe('Added by Goodboy');
    expect(instructions?.bodyMd).toBe('Reply contract: end with <<comment-resolved>>.');
    expect(handoff.ask).toBe('Fix the retry cap.');
    expect(handoff.sentMessage).toContain('Reply contract');
  });

  it('has no Instructions section without machine rules', () => {
    const kinds = buildHandoff(base()).sections.map((section) => section.kind);

    expect(kinds).not.toContain('instructions');
  });

  it('drops empty sections and a blank why', () => {
    const handoff = buildHandoff({
      ...base(),
      why: '  ',
      doneWhen: null,
      goal: null,
      earlierSteps: [],
      plan: null,
      files: [],
      rules: [],
      profile: '',
      role: null,
    });

    expect(handoff.sections.map((section) => section.kind)).toEqual(['ask']);
    expect(handoff.why).toBeNull();
  });
});

describe('handoffLine', () => {
  it('takes the first sentence of the first line and drops markdown', () => {
    expect(handoffLine({ text: '\n**Goal** Fix it. Then ship.' })).toBe('Goal Fix it.');
    expect(handoffLine({ text: '## Round once per batch\nmore' })).toBe('Round once per batch');
    expect(handoffLine({ text: '' })).toBe('');
  });

  it('truncates a long line', () => {
    expect(handoffLine({ text: 'x'.repeat(400) })).toHaveLength(160);
  });
});
