// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { OverrideSettings, WorkspaceId } from '@goodboy/types';
import { overridesWithAttribution } from '../../../../__tests__/helpers/attributionOverrides';
import type { WorkspaceOverridesPatch } from '../../../../store/slices/overrides/patchWorkspaceOverrides';
import { SettingRowFocusContext } from '../../settingRowFocusContext';
import { settingRowKeyOfField } from '../../settingRowKeyOfField';
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
  const openWording = () => {
    fireEvent.click(screen.getByRole('button', { name: 'Reply wording' }));
  };

  it('opens on the defaults with the preview under Voice and the wording closed', () => {
    renderWith();

    expect(screen.getByRole('tab', { name: 'Terse' }).getAttribute('aria-selected')).toBe('true');
    const preview = screen.getByRole('region', { name: 'Preview, a fixed comment' });
    expect(preview.textContent).toContain('Retry-After');
    expect(preview.textContent).toContain('4f21c8b');
    expect(preview.textContent).toContain('Written by Goodboy');
    const voice = screen.getByRole('tablist', { name: 'Reply voice' });
    expect(voice.compareDocumentPosition(preview) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Reply wording' }).getAttribute('aria-expanded'),
    ).toBe('false');
    screen.getByText('Default');
    expect(screen.queryByLabelText('When fixed')).toBeNull();
    expect(screen.queryByRole('button', { name: '{reason}' })).toBeNull();
  });

  it('keeps every row in one column, with no preview column beside it', () => {
    renderWith();

    expect(screen.queryByRole('region', { name: 'Reply preview' })).toBeNull();
    const regions = screen
      .getAllByRole('region')
      .map((region) => region.getAttribute('aria-label'));
    expect(regions).toEqual([
      'How replies read',
      'Preview, a fixed comment',
      'After a reply',
      'Commits',
    ]);
  });

  it('moves the preview with the voice and the signature before the save lands', () => {
    const answers: Array<() => void> = [];
    const pending = () =>
      new Promise<undefined>((resolve) => {
        answers.push(() => resolve(undefined));
      });
    state.patchWorkspaceOverrides.mockImplementationOnce(pending).mockImplementationOnce(pending);
    onTestFinished(() => answers.forEach((answer) => answer()));
    renderWith();
    const preview = () => screen.getByRole('region', { name: 'Preview, a fixed comment' });

    fireEvent.click(screen.getByRole('tab', { name: 'Friendly' }));
    expect(preview().textContent).toContain('Good catch, thanks.');

    fireEvent.click(screen.getByRole('switch', { name: 'Sign replies' }));
    expect(preview().textContent).not.toContain('Written by Goodboy');
  });

  it('says Custom on the closed wording when a template was changed', () => {
    renderWith({ replyTemplateNoChange: '{reason}\n\nKept as is, {reviewer}.' });

    screen.getByText('Custom');
    openWording();
    expect(screen.getByLabelText('When not changing')).toHaveProperty(
      'value',
      '{reason}\n\nKept as is, {reviewer}.',
    );
    const noChange = screen.getByRole('region', { name: 'Preview, a comment left as is' });
    expect(noChange.textContent).toContain('Kept as is,');
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
    openWording();
    const field = screen.getByLabelText('When fixed');

    fireEvent.change(field, { target: { value: 'Fixed in {sha}.' } });
    fireEvent.blur(field);

    expect(screen.getByText('Add {reason}, where the reply goes')).toBeDefined();
    expect(screen.getByText('Unknown variable {sha}')).toBeDefined();
    expect(state.patchWorkspaceOverrides).not.toHaveBeenCalled();
  });

  it('names the voice band apart from its row', () => {
    renderWith();

    screen.getByRole('region', { name: 'How replies read' });
    expect(screen.queryByRole('region', { name: 'Voice' })).toBeNull();
  });

  it('inserts a placeholder at the caret of the field that had focus', async () => {
    renderWith();
    openWording();
    const noChange = screen.getByLabelText<HTMLTextAreaElement>('When not changing');

    fireEvent.focus(noChange);
    noChange.setSelectionRange(10, 10);
    fireEvent.blur(noChange);
    expect(screen.getAllByRole('button', { name: /^Insert into/ })).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Insert into When not changing' }));
    const popover = screen.getByRole('dialog', { name: 'Insert into When not changing' });
    fireEvent.click(within(popover).getByRole('button', { name: '{reviewer}' }));

    await waitFor(() =>
      expect(state.patchWorkspaceOverrides).toHaveBeenCalledWith({
        workspaceId: WORKSPACE,
        patch: { replyTemplateNoChange: '{reason}\n\n{reviewer} Leaving this as is.' },
      }),
    );
    expect(screen.queryByRole('dialog', { name: 'Insert into When not changing' })).toBeNull();
  });

  it('adds the placeholder at the end of a field that never had focus', async () => {
    renderWith();
    openWording();

    fireEvent.click(screen.getByRole('button', { name: 'Insert into When fixed' }));
    const popover = screen.getByRole('dialog', { name: 'Insert into When fixed' });
    fireEvent.click(within(popover).getByRole('button', { name: '{file}' }));

    await waitFor(() =>
      expect(state.patchWorkspaceOverrides).toHaveBeenCalledWith({
        workspaceId: WORKSPACE,
        patch: { replyTemplateFixed: '{reason}\n\nFixed in {commit_story}. {file}' },
      }),
    );
  });

  it('saves a valid template and stores the default as empty', async () => {
    renderWith({ replyTemplateFixed: '{reason}\n\nDone in {commit}.' });
    openWording();
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
    openWording();
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

  it('opens the wording when settings search lands on a template', () => {
    state.workspaceOverrides = {
      [WORKSPACE]: overridesWithAttribution({ attributionFooter: null }),
    };
    render(
      <SettingRowFocusContext.Provider
        value={{
          row: settingRowKeyOfField({ field: 'replyTemplateNoChange' }) ?? null,
          onShown: () => undefined,
        }}
      >
        <WorkspaceReviewRepliesSection workspaceId={WORKSPACE} />
      </SettingRowFocusContext.Provider>,
    );

    expect(
      screen.getByRole('button', { name: 'Reply wording' }).getAttribute('aria-expanded'),
    ).toBe('true');
    screen.getByLabelText('When not changing');
  });

  it('keeps the wording open while a template save has failed', async () => {
    state.patchWorkspaceOverrides.mockRejectedValueOnce(new Error('disk is offline'));
    renderWith();
    openWording();
    const field = screen.getByLabelText('When fixed');

    fireEvent.change(field, { target: { value: '{reason}\n\nDone in {commit}.' } });
    fireEvent.blur(field);
    await screen.findByRole('alert');
    openWording();

    expect(
      screen.getByRole('button', { name: 'Reply wording' }).getAttribute('aria-expanded'),
    ).toBe('true');
  });

  it('turns off resolving on GitHub and picks the fixup commit style', async () => {
    renderWith();

    fireEvent.click(screen.getByRole('switch', { name: 'Resolve the thread' }));

    await waitFor(() =>
      expect(state.patchWorkspaceOverrides).toHaveBeenCalledWith({
        workspaceId: WORKSPACE,
        patch: { resolveOnGithub: false },
      }),
    );
    cleanup();
    renderWith();
    fireEvent.click(screen.getByRole('tab', { name: "Fixup of the line's commit" }));
    await waitFor(() =>
      expect(state.patchWorkspaceOverrides).toHaveBeenCalledWith({
        workspaceId: WORKSPACE,
        patch: { resolveCommitStyle: 'fixup' },
      }),
    );
  });

  it('edits the posted reply by default and saves the switch per workspace', async () => {
    renderWith();

    const editSwitch = screen.getByRole('switch', { name: 'Update the reply after a squash' });
    expect(editSwitch.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(editSwitch);

    await waitFor(() =>
      expect(state.saveSetting).toHaveBeenCalledWith(`review.edit_posted_reply.${WORKSPACE}`, '0'),
    );
  });

  it('holds Sign replies in the How replies read band, under Voice', async () => {
    renderWith({ attributionFooter: false });

    const band = screen.getByRole('region', { name: 'How replies read' });
    const attribution = within(band).getByRole('switch', { name: 'Sign replies' });
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

  it('keeps Sign replies as it was when the save fails, and says so under it', async () => {
    state.patchWorkspaceOverrides.mockRejectedValueOnce(new Error('disk full'));
    renderWith({ attributionFooter: false });

    fireEvent.click(screen.getByRole('switch', { name: 'Sign replies' }));

    expect((await screen.findByRole('alert')).textContent).toContain("Couldn't save. Still Off.");
    expect(screen.getByRole('switch', { name: 'Sign replies' }).getAttribute('aria-checked')).toBe(
      'false',
    );
    expect(state.reportError).not.toHaveBeenCalled();
  });
});
