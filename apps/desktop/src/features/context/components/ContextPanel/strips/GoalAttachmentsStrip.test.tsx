// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { brandId, type SessionId, type WorkflowRunId } from '@goodboy/types';

type Attachment = {
  id: string;
  fileName: string;
  mimeType: string;
  kind: 'image' | 'file';
  relPath: string;
};

type MockState = {
  sessionAttachments: Record<string, ReadonlyArray<Attachment>>;
  workflowRunAttachments: Record<string, ReadonlyArray<Attachment>>;
  sessionWorktrees: Record<string, ReadonlyArray<string>>;
  currentSessionId: string | null;
  loadGoalAttachments: ReturnType<typeof vi.fn>;
  removeGoalAttachment: ReturnType<typeof vi.fn>;
};

const { state } = vi.hoisted<{ state: MockState }>(() => ({
  state: {
    sessionAttachments: {
      'sess-1': [
        { id: 'att-1', fileName: 'notes.txt', mimeType: 'text/plain', kind: 'file', relPath: '' },
      ],
    },
    workflowRunAttachments: {
      'run-1': [
        {
          id: 'att-2',
          fileName: 'brief.pdf',
          mimeType: 'application/pdf',
          kind: 'file',
          relPath: '',
        },
      ],
    },
    sessionWorktrees: {},
    currentSessionId: 'sess-1',
    loadGoalAttachments: vi.fn(async () => undefined),
    removeGoalAttachment: vi.fn(async () => undefined),
  },
}));

vi.mock('../../../../../store', () => ({
  EMPTY_ARRAY: [],
  useAppStore: <T,>(selector: (s: MockState) => T) => selector(state),
}));

vi.mock('../../../../chat/turn', () => ({
  readAttachment: vi.fn(async () => ''),
}));

vi.mock('../../../../../shared/components/ImageLightbox', () => ({
  ImageLightbox: () => null,
}));

vi.mock('../../../../providers/attachment-routing', () => ({
  ATTACHMENT_KIND_ROUTING: { file: ['claude'], image: ['claude'] },
}));

import { GoalAttachmentsStrip } from './GoalAttachmentsStrip';

afterEach(cleanup);

describe('GoalAttachmentsStrip', () => {
  it('shows the remove control at rest', () => {
    render(
      <GoalAttachmentsStrip
        owner={{ type: 'session', id: brandId<SessionId>({ value: 'sess-1' }) }}
      />,
    );
    const remove = screen.getByRole('button', { name: 'Remove notes.txt' });

    expect(remove.className).not.toContain('opacity-0');
  });

  it('reads as a plain chip on a run, with no remove control', () => {
    render(
      <GoalAttachmentsStrip
        owner={{ type: 'workflow_run', id: brandId<WorkflowRunId>({ value: 'run-1' }) }}
      />,
    );

    expect(screen.getByText('brief.pdf')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Remove brief.pdf' })).toBeNull();
  });
});
