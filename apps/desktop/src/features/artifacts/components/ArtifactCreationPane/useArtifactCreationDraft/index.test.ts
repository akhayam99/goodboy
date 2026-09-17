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
          attachments: [],
          mountIds: ['mount-web'],
          basedOn: { kind: 'session' },
          routing: null,
          updatedAt: '2026-09-16T10:00:00.000Z',
        },
      },
    };
    const { result } = renderHook(() =>
      useArtifactCreationDraft({ sessionId: SESSION_ID, kind: 'report', defaultMountIds: [] }),
    );
    expect(result.current.brief).toBe('the residual convention');
    expect(result.current.choice).toBe('change-summary');
    expect(result.current.mountIds).toEqual(['mount-web']);

    act(() => result.current.setBrief('a different brief'));
    const last = state.setArtifactDraft.mock.calls.at(-1)?.[0] as {
      readonly draft: { readonly brief: string };
    };
    expect(last.draft.brief).toBe('a different brief');
  });

  it('clears the slice when the draft becomes empty', () => {
    const { result } = renderHook(() =>
      useArtifactCreationDraft({ sessionId: SESSION_ID, kind: 'wireframe', defaultMountIds: [] }),
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

  it('keeps a repository choice that differs from the preselection', () => {
    const { result } = renderHook(() =>
      useArtifactCreationDraft({
        sessionId: SESSION_ID,
        kind: 'wireframe',
        defaultMountIds: ['mount-web', 'mount-api'] as never,
      }),
    );
    state.setArtifactDraft.mockClear();
    state.clearArtifactDraft.mockClear();

    act(() => result.current.setMountIds(['mount-api'] as never));

    const last = state.setArtifactDraft.mock.calls.at(-1)?.[0] as {
      readonly draft: { readonly mountIds: ReadonlyArray<string> };
    };
    expect(last.draft.mountIds).toEqual(['mount-api']);
    expect(state.clearArtifactDraft).not.toHaveBeenCalled();
  });

  it('reads an untouched preselection as an empty draft, whatever its order', () => {
    const { result } = renderHook(() =>
      useArtifactCreationDraft({
        sessionId: SESSION_ID,
        kind: 'wireframe',
        defaultMountIds: ['mount-web', 'mount-api'] as never,
      }),
    );
    state.clearArtifactDraft.mockClear();

    act(() => result.current.setMountIds(['mount-api', 'mount-web'] as never));

    expect(result.current.isEmpty).toBe(true);
    expect(state.clearArtifactDraft).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      kind: 'wireframe',
    });
  });

  it('adopts the preselected repositories until the user says otherwise', () => {
    const { result, rerender } = renderHook(
      ({ defaultMountIds }: { readonly defaultMountIds: ReadonlyArray<string> }) =>
        useArtifactCreationDraft({
          sessionId: SESSION_ID,
          kind: 'wireframe',
          defaultMountIds: defaultMountIds as never,
        }),
      { initialProps: { defaultMountIds: [] as ReadonlyArray<string> } },
    );
    expect(result.current.mountIds).toEqual([]);
    rerender({ defaultMountIds: ['mount-web', 'mount-api'] });
    expect(result.current.mountIds).toEqual(['mount-web', 'mount-api']);
    act(() => result.current.setMountIds([]));
    expect(result.current.mountIds).toEqual([]);
    rerender({ defaultMountIds: ['mount-web', 'mount-api'] });
    expect(result.current.mountIds).toEqual([]);
  });
});
