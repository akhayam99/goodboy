import { describe, expect, it } from 'vitest';
import type { SessionArtifact } from '@goodboy/types';
import { appendArtifactAttachment } from './artifactConversationAttachment';

const report = {
  id: 'artifact-report',
  sessionId: 'sess-1',
  agentId: 'agent-1',
  workflowRunId: null,
  kind: 'report',
  schemaVersion: 1,
  title: 'Harborline rollout report',
  sourceFormat: 'markdown',
  sourceText: '## outcome\nledger-core shipped',
  metadata: { reportType: 'session-summary' },
  status: 'active',
  revision: 3,
  sourceTurnId: 'run-1',
  createdAt: '2026-01-02T03:04:05.000Z',
  updatedAt: '2026-01-02T03:04:05.000Z',
} as unknown as SessionArtifact;

describe('appendArtifactAttachment', () => {
  it('carries the content the user is looking at, not a reference to it', () => {
    const next = appendArtifactAttachment({ draft: '', artifact: report });
    expect(next).toContain('Harborline rollout report');
    expect(next).toContain('rev 3');
    expect(next).toContain('ledger-core shipped');
  });

  it('carries an edit the agent never saw', () => {
    const edited = { ...report, sourceText: '## outcome\nnotify-relay was cut' } as SessionArtifact;
    const next = appendArtifactAttachment({ draft: 'what changed?', artifact: edited });
    expect(next).toContain('notify-relay was cut');
    expect(next).not.toContain('ledger-core shipped');
  });

  it('keeps what the user already typed above the attachment', () => {
    const next = appendArtifactAttachment({ draft: 'tighten the summary', artifact: report });
    expect(next.indexOf('tighten the summary')).toBeLessThan(next.indexOf('attached report'));
  });

  it('fences a wireframe as json so the agent reads it as a document', () => {
    const wireframe = {
      ...report,
      kind: 'wireframe',
      sourceFormat: 'json',
      sourceText: '{"screens":[]}',
    } as unknown as SessionArtifact;
    expect(appendArtifactAttachment({ draft: '', artifact: wireframe })).toContain('```json');
  });
});
