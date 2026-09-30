import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MountId, Project, ProjectId } from '@goodboy/types';

const { getSettingMock, setSettingMock, updateStyleMock } = vi.hoisted(() => ({
  getSettingMock: vi.fn(async (_db: unknown, _key: string) => null as string | null),
  setSettingMock: vi.fn(async (_db: unknown, _key: string, _value: string) => undefined),
  updateStyleMock: vi.fn(async (_params: unknown) => undefined),
}));

vi.mock('@goodboy/db', () => ({
  getSetting: getSettingMock,
  setSetting: setSettingMock,
  updateProjectResolveCommitStyle: updateStyleMock,
}));

vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: { execute: vi.fn(), select: vi.fn() } }));

import type { AppState } from '../../types';
import { createReviewCommitsSlice } from './index';
import { selectReviewCommitPreset } from './selectReviewCommitPreset';
import { reviewCommitDraftKey, reviewCommitPresetKey } from './state';

const PROJECT_ID = 'project-payments-api' as ProjectId;

const project = ({ fixup }: { readonly fixup: boolean }): Project =>
  ({
    id: PROJECT_ID,
    overrides: { resolveCommitStyle: fixup ? 'fixup' : null },
  }) as unknown as Project;

const harness = ({ fixup }: { readonly fixup: boolean }) => {
  let state = {
    reviewCommitPresets: {},
    reviewCommitDrafts: {},
    projects: [project({ fixup })],
  } as unknown as AppState;
  const set = (patch: Partial<AppState> | ((s: AppState) => Partial<AppState>)) => {
    state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
  };
  const get = () => state as never;
  const slice = createReviewCommitsSlice(set as never, get);
  return { slice, read: () => state };
};

describe('review commit preset memory', () => {
  beforeEach(() => {
    getSettingMock.mockReset();
    setSettingMock.mockClear();
    updateStyleMock.mockClear();
  });

  it('remembers the preset per project and makes it the commit style', async () => {
    const { slice, read } = harness({ fixup: false });
    await slice.chooseReviewCommitPreset({ projectId: PROJECT_ID, preset: 'fold' });
    expect(selectReviewCommitPreset({ state: read(), projectId: PROJECT_ID })).toBe('fold');
    expect(read().projects[0]?.overrides.resolveCommitStyle).toBe('fixup');
    expect(setSettingMock).toHaveBeenCalledWith(
      expect.anything(),
      reviewCommitPresetKey({ projectId: PROJECT_ID }),
      'fold',
    );
    expect(updateStyleMock).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: PROJECT_ID, commitStyle: 'fixup' }),
    );
  });

  it('writes a new commit style for one commit for the review', async () => {
    const { slice, read } = harness({ fixup: true });
    await slice.chooseReviewCommitPreset({ projectId: PROJECT_ID, preset: 'one' });
    expect(read().projects[0]?.overrides.resolveCommitStyle).toBe('new');
    expect(selectReviewCommitPreset({ state: read(), projectId: PROJECT_ID })).toBe('one');
  });

  it('loads a stored preset and ignores an unknown value', async () => {
    const { slice, read } = harness({ fixup: false });
    getSettingMock.mockResolvedValueOnce('bogus');
    await slice.loadReviewCommitPreset({ projectId: PROJECT_ID });
    expect(selectReviewCommitPreset({ state: read(), projectId: PROJECT_ID })).toBe('keep');
    getSettingMock.mockResolvedValueOnce('one');
    await slice.loadReviewCommitPreset({ projectId: PROJECT_ID });
    expect(selectReviewCommitPreset({ state: read(), projectId: PROJECT_ID })).toBe('one');
  });

  it('falls back to fold when the project already commits as fixups', () => {
    const { read } = harness({ fixup: true });
    expect(selectReviewCommitPreset({ state: read(), projectId: PROJECT_ID })).toBe('fold');
  });

  it('marks the draft the Commits view wrote and reads the mark back', async () => {
    const mountId = 'mount-payments-api' as MountId;
    const { slice, read } = harness({ fixup: false });
    await slice.markReviewCommitDraft({ mountId, signature: 'plan-a' });
    expect(read().reviewCommitDrafts[mountId]).toBe('plan-a');
    expect(setSettingMock).toHaveBeenCalledWith(
      expect.anything(),
      reviewCommitDraftKey({ mountId }),
      'plan-a',
    );
    const other = harness({ fixup: false });
    getSettingMock.mockResolvedValueOnce('plan-b');
    await other.slice.loadReviewCommitDraft({ mountId });
    expect(other.read().reviewCommitDrafts[mountId]).toBe('plan-b');
  });
});
