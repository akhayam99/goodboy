// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { OverrideSettings, WorkspaceId } from '@goodboy/types';
import { overridesWithAttribution } from '../../../../__tests__/helpers/attributionOverrides';
import type { WorkspaceOverridesPatch } from '../../../../store/slices/overrides/patchWorkspaceOverrides';
import { WorkspaceReviewRepliesSection } from './WorkspaceReviewRepliesSection';

const WORKSPACE = 'workspace-1' as WorkspaceId;

const { state, learn } = vi.hoisted(() => ({
  state: {
    workspaces: [] as ReadonlyArray<unknown>,
    workspaceOverrides: {} as Record<string, OverrideSettings>,
    patchWorkspaceOverrides: vi.fn(
      async (_params: { workspaceId: string; patch: WorkspaceOverridesPatch }) => undefined,
    ),
    reportError: vi.fn(async () => undefined),
    settings: {} as Record<string, string>,
    loadSetting: vi.fn(async () => null),
    saveSetting: vi.fn(async () => undefined),
    projects: [
      { id: 'p1', workspaceId: 'workspace-1', kind: 'repo', rootPath: '/repos/ledger-core' },
      { id: 'p2', workspaceId: 'workspace-2', kind: 'repo', rootPath: '/repos/notify-relay' },
    ],
    providers: [
      { id: 'anthropic', connection: 'connected' },
      { id: 'codex', connection: 'disconnected' },
    ],
  },
  learn: vi.fn(),
}));

vi.mock('../../../resolve/learnWorkspaceReplyStyle', () => ({
  learnWorkspaceReplyStyle: learn,
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}));

const renderWith = (patch: Partial<OverrideSettings> = {}) => {
  state.workspaceOverrides = {
    [WORKSPACE]: { ...overridesWithAttribution({ attributionFooter: null }), ...patch },
  };
  return render(<WorkspaceReviewRepliesSection workspaceId={WORKSPACE} />);
};

beforeEach(() => {
  state.patchWorkspaceOverrides.mockClear();
  state.saveSetting.mockClear();
  state.reportError.mockClear();
  state.settings = {};
  learn.mockReset();
});

afterEach(() => {
  cleanup();
});

describe('WorkspaceReviewRepliesSection', () => {
  it('opens on the defaults with a live preview of the fixed reply', () => {
    renderWith();

    expect(screen.getByRole('tab', { name: 'Terse' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByLabelText('When fixed')).toHaveProperty(
      'value',
      '{reason}\n\nFixed in {commit_story}.',
    );
    const preview = screen.getByLabelText('Reply preview');
    expect(preview.textContent).toContain('Retry-After');
    expect(preview.textContent).toContain('4f21c8b');
    expect(preview.textContent).toContain('Written by Goodboy');
    expect(preview.textContent).toContain('Leaving this as is.');
  });

  it('saves the voice and shows the style note only for like my replies', async () => {
    renderWith({ replyVoice: 'mine', replyStyleNote: 'Short. Starts lowercase.' });

    expect(screen.getByLabelText('Style note')).toHaveProperty('value', 'Short. Starts lowercase.');
    fireEvent.click(screen.getByRole('tab', { name: 'Formal' }));

    await waitFor(() =>
      expect(state.patchWorkspaceOverrides).toHaveBeenCalledWith({
        workspaceId: WORKSPACE,
        patch: { replyVoice: 'formal' },
      }),
    );
  });

  it('learns a style note from my replies in this workspace and saves it', async () => {
    learn.mockResolvedValue('Short.\nSays "done in" before the sha.');
    renderWith({ replyVoice: 'mine' });

    fireEvent.click(screen.getByRole('button', { name: /Learn from your replies/ }));

    await waitFor(() =>
      expect(state.patchWorkspaceOverrides).toHaveBeenCalledWith({
        workspaceId: WORKSPACE,
        patch: { replyStyleNote: 'Short.\nSays "done in" before the sha.' },
      }),
    );
    expect(learn).toHaveBeenCalledWith({
      workspaceId: WORKSPACE,
      projectRoots: ['/repos/ledger-core'],
      taskModel: expect.objectContaining({ providerId: 'anthropic' }),
    });
    expect(screen.getByLabelText('Style note')).toHaveProperty(
      'value',
      'Short.\nSays "done in" before the sha.',
    );
  });

  it('says why no note could be learned and saves nothing', async () => {
    learn.mockRejectedValue(new Error("Couldn't find review replies you wrote in this workspace."));
    renderWith({ replyVoice: 'mine' });

    fireEvent.click(screen.getByRole('button', { name: /Learn from your replies/ }));

    expect(
      await screen.findByText("Couldn't find review replies you wrote in this workspace."),
    ).toBeDefined();
    expect(state.patchWorkspaceOverrides).not.toHaveBeenCalled();
  });

  it('flags a template without {reason} or with an unknown variable, and does not save it', () => {
    renderWith();
    const field = screen.getByLabelText('When fixed');

    fireEvent.change(field, { target: { value: 'Fixed in {sha}.' } });
    fireEvent.blur(field);

    expect(screen.getByText('Add {reason}, where the reply goes')).toBeDefined();
    expect(screen.getByText('Unknown variable {sha}')).toBeDefined();
    expect(state.patchWorkspaceOverrides).not.toHaveBeenCalled();
  });

  it('names the voice band apart from its row', () => {
    renderWith();

    screen.getByRole('region', { name: 'Replies' });
    expect(screen.queryByRole('region', { name: 'Voice' })).toBeNull();
  });

  it('shows the placeholders once, under both templates, and adds one to the template in focus', async () => {
    renderWith();

    expect(screen.getAllByRole('button', { name: '{reason}' })).toHaveLength(1);
    const templates = screen.getByRole('region', { name: 'Templates' });
    const placeholders = within(templates).getByRole('group', { name: 'Placeholders' });
    const noChange = screen.getByLabelText('When not changing');
    expect(
      noChange.compareDocumentPosition(placeholders) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    fireEvent.focus(noChange);
    fireEvent.blur(noChange);
    fireEvent.click(within(placeholders).getByRole('button', { name: '{reviewer}' }));

    await waitFor(() =>
      expect(state.patchWorkspaceOverrides).toHaveBeenCalledWith({
        workspaceId: WORKSPACE,
        patch: { replyTemplateNoChange: '{reason}\n\nLeaving this as is. {reviewer}' },
      }),
    );
  });

  it('saves a valid template and stores the default as empty', async () => {
    renderWith({ replyTemplateFixed: '{reason}\n\nDone in {commit}.' });
    const field = screen.getByLabelText('When fixed');

    fireEvent.change(field, { target: { value: '{reason}\n\nFixed in {commit_story}.' } });
    fireEvent.blur(field);

    await waitFor(() =>
      expect(state.patchWorkspaceOverrides).toHaveBeenCalledWith({
        workspaceId: WORKSPACE,
        patch: { replyTemplateFixed: null },
      }),
    );
  });

  it('keeps the old template and says so under it when the save fails', async () => {
    state.patchWorkspaceOverrides.mockRejectedValueOnce(new Error('disk is offline'));
    renderWith();
    const field = screen.getByLabelText('When fixed');

    fireEvent.change(field, { target: { value: '{reason}\n\nDone in {commit}.' } });
    fireEvent.blur(field);

    expect((await screen.findByRole('alert')).textContent).toContain(
      "Couldn't save. Still {reason} Fixed in {commit_story}.",
    );
    expect(field).toHaveProperty('value', '{reason}\n\nFixed in {commit_story}.');
    expect(state.reportError).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() =>
      expect(state.patchWorkspaceOverrides).toHaveBeenLastCalledWith({
        workspaceId: WORKSPACE,
        patch: { replyTemplateFixed: '{reason}\n\nDone in {commit}.' },
      }),
    );
  });

  it('turns off resolving on GitHub and picks the fixup commit style', async () => {
    renderWith();

    fireEvent.click(screen.getByRole('switch', { name: 'Mark thread as resolved' }));

    await waitFor(() =>
      expect(state.patchWorkspaceOverrides).toHaveBeenCalledWith({
        workspaceId: WORKSPACE,
        patch: { resolveOnGithub: false },
      }),
    );
    cleanup();
    renderWith();
    fireEvent.click(screen.getByRole('tab', { name: 'Fixup of the commit that added the line' }));
    await waitFor(() =>
      expect(state.patchWorkspaceOverrides).toHaveBeenCalledWith({
        workspaceId: WORKSPACE,
        patch: { resolveCommitStyle: 'fixup' },
      }),
    );
  });

  it('edits the posted reply by default and saves the switch per workspace', async () => {
    renderWith();

    const editSwitch = screen.getByRole('switch', { name: 'Edit the posted reply' });
    expect(editSwitch.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(editSwitch);

    await waitFor(() =>
      expect(state.saveSetting).toHaveBeenCalledWith(`review.edit_posted_reply.${WORKSPACE}`, '0'),
    );
  });

  it('holds the attribution line in the Replies band, under Voice', async () => {
    renderWith({ attributionFooter: false });

    const band = screen.getByRole('region', { name: 'Replies' });
    const attribution = within(band).getByRole('switch', { name: 'Attribution line' });
    within(band).getByRole('tablist', { name: 'Reply voice' });
    expect(attribution.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(attribution);

    await waitFor(() =>
      expect(state.patchWorkspaceOverrides).toHaveBeenCalledWith({
        workspaceId: WORKSPACE,
        patch: { attributionFooter: true },
      }),
    );
  });

  it('keeps the attribution line as it was when the save fails, and says so under it', async () => {
    state.patchWorkspaceOverrides.mockRejectedValueOnce(new Error('disk full'));
    renderWith({ attributionFooter: false });

    fireEvent.click(screen.getByRole('switch', { name: 'Attribution line' }));

    expect((await screen.findByRole('alert')).textContent).toContain("Couldn't save. Still Off.");
    expect(
      screen.getByRole('switch', { name: 'Attribution line' }).getAttribute('aria-checked'),
    ).toBe('false');
    expect(state.reportError).not.toHaveBeenCalled();
  });
});
