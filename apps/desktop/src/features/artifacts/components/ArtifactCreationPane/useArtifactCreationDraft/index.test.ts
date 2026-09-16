// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';

const { state } = vi.hoisted(() => ({
  state: {
    artifactDrafts: {} as Record<string, Record<string, unknown>>,
    setArtifactDraft: vi.fn(),
    clearArtifactDraft: vi.fn(),
  },
}));

vi.mock('../../../../../store', () => ({
  EMPTY_ARRAY: [] as readonly never[],
  useAppStore: <T>(selector: (s: typeof state) => T) => selector(state),
}));

import { useArtifactCreationDraft } from './index';

const SESSION_ID = JSON.parse(JSON.stringify('session-harborline'));

beforeEach(() => {
  vi.clearAllMocks();
  state.artifactDrafts = {};
});

afterEach(cleanup);

describe('useArtifactCreationDraft', () => {
  it('seeds from the stored draft once and writes every change back', () => {
    state.artifactDrafts = {
      [SESSION_ID]: {
        report: {
          kind: 'report',
          reportType: 'change-summary',
          brief: 'the residual convention',
          basedOn: { kind: 'session' },
          routing: null,
          updatedAt: '2026-09-16T10:00:00.000Z',
        },
      },
    };
    const { result } = renderHook(() =>
      useArtifactCreationDraft({ sessionId: SESSION_ID, kind: 'report' }),
    );
    expect(result.current.brief).toBe('the residual convention');
    expect(result.current.choice).toBe('change-summary');

    act(() => result.current.setBrief('a different brief'));
    const last = state.setArtifactDraft.mock.calls.at(-1)?.[0] as {
      readonly draft: { readonly brief: string };
    };
    expect(last.draft.brief).toBe('a different brief');
  });

  it('clears the slice when the draft becomes empty', () => {
    const { result } = renderHook(() =>
      useArtifactCreationDraft({ sessionId: SESSION_ID, kind: 'wireframe' }),
    );
    expect(state.clearArtifactDraft).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      kind: 'wireframe',
    });
    act(() => result.current.setBrief('the settlement flow'));
    expect(state.setArtifactDraft).toHaveBeenCalled();
    state.clearArtifactDraft.mockClear();
    act(() => result.current.setBrief('   '));
    expect(state.clearArtifactDraft).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      kind: 'wireframe',
    });
  });
});
