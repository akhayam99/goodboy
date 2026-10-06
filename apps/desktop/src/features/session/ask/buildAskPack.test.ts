// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { AgentId, ArtifactId, OpenQuestionId, WorkflowRunId } from '@goodboy/types';
import { buildAskPack, type AskPackAgent, type AskPackInput } from './buildAskPack';

const LIMITS = {
  settledAgents: 15,
  total: 48_000,
  goal: 1_200,
  transcriptTail: 6_000,
  transcriptFiles: 8,
} as const;

const agent = (overrides: Partial<AskPackAgent>): AskPackAgent => ({
  id: 'agent-implementer' as AgentId,
  name: 'Implementer',
  status: 'completed',
  isNeedsYou: false,
  summary: '',
  since: null,
  transcriptTail: '',
  ...overrides,
});

const input = (overrides: Partial<AskPackInput>): AskPackInput => ({
  title: 'Fix webhook retries',
  rightNow: ['Implementer is running · 12 min', '$3.42 in this session'],
  goal: 'Retry a failed webhook delivery after a 429 without flooding the receiver.',
  decisions: '',
  summary: '',
  agents: [],
  questions: [],
  runs: [],
  comments: [],
  branches: [],
  pullRequest: null,
  artifacts: [],
  events: [],
  ...overrides,
});

describe('buildAskPack', () => {
  it('labels every object with a handle the answer can cite', () => {
    const pack = buildAskPack(
      input({
        agents: [
          agent({ id: 'agent-planner' as AgentId, name: 'Planner', isNeedsYou: true }),
          agent({ status: 'running', since: '09:40', summary: 'Raising the retry limit.' }),
        ],
        questions: [
          {
            id: 'q-1' as OpenQuestionId,
            text: 'Stop after 5 attempts, or keep backing off?',
            from: 'Planner',
            isOpen: true,
            answer: null,
            suggestions: ['Stop after 5', 'Keep backing off'],
          },
        ],
        runs: [
          { id: 'run-fix' as WorkflowRunId, title: 'Fix run', isRunning: true, detail: 'running' },
        ],
        comments: [
          {
            threadId: 'thread-88',
            word: 'couldnt_fix',
            author: 'Theo Varga',
            location: 'webhook.ts:88',
            body: 'Handle Retry-After as an HTTP date',
          },
          {
            threadId: 'thread-41',
            word: 'ready',
            author: 'Mara Quint',
            location: 'webhook.ts:41',
            body: 'Cap at 30s',
          },
        ],
        pullRequest: { number: 318, title: 'Webhook retries', state: 'draft' },
        artifacts: [{ id: 'plan-2' as ArtifactId, title: 'Plan v2', kind: 'plan', isPlan: true }],
      }),
    );
    expect(pack.handles.map((handle) => [handle.key, handle.label])).toEqual([
      ['A1', 'Planner'],
      ['A2', 'Implementer'],
      ['Q1', 'Question 1'],
      ['R1', 'Fix run'],
      ['C1', 'webhook.ts:88'],
      ['PR', '#318'],
      ['D1', 'Plan v2'],
    ]);
    expect(pack.text).toContain('- [A1] Planner · needs you');
    expect(pack.text).toContain(
      '- [A2] Implementer · running since 09:40: Raising the retry limit.',
    );
    expect(pack.text).toContain("2 comments: 1 ready · 1 couldn't fix");
    expect(pack.text).toContain(
      '- [Q1] from Planner: Stop after 5 attempts, or keep backing off? · options: Stop after 5 | Keep backing off',
    );
    expect(pack.text.startsWith('# Session: Fix webhook retries')).toBe(true);
  });

  it('lists live agents in full and folds settled ones past the cap', () => {
    const settled = Array.from({ length: LIMITS.settledAgents + 5 }, (_, index) =>
      agent({
        id: `agent-${index}` as AgentId,
        name: `Scout ${index}`,
        summary: 'x'.repeat(2_000),
      }),
    );
    const live = agent({
      id: 'agent-live' as AgentId,
      status: 'running',
      summary: 'y'.repeat(3_000),
    });
    const pack = buildAskPack(input({ agents: [...settled, live] }));
    const agentHandles = pack.handles.filter((handle) => handle.target.kind === 'agent');
    expect(agentHandles).toHaveLength(LIMITS.settledAgents + 1);
    expect(agentHandles[0]?.label).toBe('Implementer');
    expect(pack.text).toContain('- and 5 more settled agents');
    expect(pack.truncations).toContain('A1 summary cut at 2000 characters');
    expect(pack.truncations).toContain('A2 summary cut at 280 characters');
  });

  it('never grows past the total cap', () => {
    const pack = buildAskPack(
      input({
        goal: 'g'.repeat(10_000),
        decisions: 'd'.repeat(10_000),
        summary: 's'.repeat(10_000),
        events: Array.from(
          { length: 200 },
          (_, index) => `09:${index} pr created: ${'e'.repeat(3_000)}`,
        ),
        agents: Array.from({ length: 40 }, (_, index) =>
          agent({ id: `agent-${index}` as AgentId, status: 'running', summary: 'z'.repeat(5_000) }),
        ),
      }),
    );
    expect(pack.text.length).toBeLessThanOrEqual(LIMITS.total);
    expect(pack.truncations).toContain(`session pack cut at ${LIMITS.total} characters`);
    expect(pack.truncations).toContain(`Goal cut at ${LIMITS.goal} characters`);
  });

  it('stages transcript tails as capped files, never inline', () => {
    const tail = 'Implementer said '.repeat(2_000);
    const pack = buildAskPack(
      input({ agents: [agent({ status: 'running', transcriptTail: tail })] }),
    );
    expect(pack.files).toHaveLength(1);
    expect(pack.files[0]?.name).toBe('agents/A1.md');
    expect(pack.files[0]?.content.length).toBeLessThanOrEqual(LIMITS.transcriptTail + 80);
    expect(pack.text).not.toContain('Implementer said Implementer said');
  });

  it('caps the staged files at eight agents', () => {
    const agents = Array.from({ length: 12 }, (_, index) =>
      agent({ id: `agent-${index}` as AgentId, status: 'running', transcriptTail: 'tail' }),
    );
    expect(buildAskPack(input({ agents })).files).toHaveLength(LIMITS.transcriptFiles);
  });

  it('redacts secrets that leak into summaries', () => {
    const pack = buildAskPack(
      input({
        agents: [
          agent({ status: 'running', summary: 'used token ghp_abcdefghijklmnopqrstuvwxyz123456' }),
        ],
      }),
    );
    expect(pack.text).not.toContain('ghp_abcdefghijklmnopqrstuvwxyz123456');
  });
});
