// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

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
    workflowRunAttachments: {},
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

vi.mock('../../../../chat/attachment-kinds', () => ({
  fileIconFor: () => () => null,
}));

vi.mock('../../../../chat/turn', () => ({
  readAttachment: vi.fn(async () => ''),
}));

vi.mock('../../../../chat/components/ImageLightbox', () => ({
  ImageLightbox: () => null,
}));

vi.mock('../../../../providers/attachment-routing', () => ({
  ATTACHMENT_KIND_ROUTING: { file: ['claude'], image: ['claude'] },
}));

import { GoalAttachmentsStrip } from './GoalAttachmentsStrip';

afterEach(cleanup);

describe('GoalAttachmentsStrip', () => {
  it('reveals the remove control on keyboard focus, not only on hover', () => {
    render(<GoalAttachmentsStrip owner={{ type: 'session', id: 'sess-1' as never }} />);
    const remove = screen.getByRole('button', { name: 'Remove notes.txt' });

    expect(remove.className).toContain('opacity-0');
    expect(remove.className).toContain('focus-visible:opacity-100');
    expect(remove.className).toContain('group-hover:opacity-100');
  });
});
