import { describe, expect, it } from 'vitest';
import type { AgentId, DiffComment, SessionId } from '@goodboy/types';
import { openDiffComments } from './openDiffComments';

const SID = 'sess-1' as SessionId;

const buildComment = (overrides: Partial<DiffComment>): DiffComment =>
  ({
    id: 'd1',
    sessionId: SID,
    filePath: 'src/App.tsx',
    body: 'use the constant',
    status: 'open',
    createdAt: '2026-08-01T00:00:00Z' as DiffComment['createdAt'],
    ...overrides,
  }) as DiffComment;

describe('openDiffComments', () => {
  it('keeps open notes with no consumer', () => {
    const result = openDiffComments({
      comments: [buildComment({}), buildComment({ id: 'd2' })],
    });
    expect(result.map((comment) => comment.id)).toEqual(['d1', 'd2']);
  });

  it('drops notes already consumed by a resolver', () => {
    const result = openDiffComments({
      comments: [buildComment({ consumedByAgentId: 'agent-1' as AgentId })],
    });
    expect(result).toEqual([]);
  });

  it('drops resolved notes', () => {
    const result = openDiffComments({
      comments: [buildComment({ id: 'r', status: 'resolved' })],
    });
    expect(result).toEqual([]);
  });
});
