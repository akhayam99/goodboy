// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { OverrideSettings, WorkspaceId } from '@goodboy/types';
import { overridesWithAttribution } from '../../../../__tests__/helpers/attributionOverrides';
import type { WorkspaceOverridesPatch } from '../../../../store/slices/overrides/patchWorkspaceOverrides';
import { WorkspaceReviewRepliesSection } from './WorkspaceReviewRepliesSection';

const WORKSPACE = 'workspace-1' as WorkspaceId;

const { state, learn } = vi.hoisted(() => ({
  state: {
    workspaceOverrides: {} as Record<string, OverrideSettings>,
    patchWorkspaceOverrides: vi.fn(
      async (_params: { workspaceId: string; patch: WorkspaceOverridesPatch }) => undefined,
    ),
    reportError: vi.fn(async () => undefined),
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
      '{reason}\n\nFixed in {commit}.',
    );
    const preview = screen.getByLabelText('Reply preview');
    expect(preview.textContent).toContain('Retry-After');
    expect(preview.textContent).toContain('4f21c8b');
    expect(preview.textContent).toContain('Written by Goodboy');
    expect(preview.textContent).toContain('Leaving this as is.');
  });

  it('saves the voice and shows the style note only for like my replies', () => {
    renderWith({ replyVoice: 'mine', replyStyleNote: 'Short. Starts lowercase.' });

    expect(screen.getByLabelText('Style note')).toHaveProperty('value', 'Short. Starts lowercase.');
    fireEvent.click(screen.getByRole('tab', { name: 'Formal' }));

    expect(state.patchWorkspaceOverrides).toHaveBeenCalledWith({
      workspaceId: WORKSPACE,
      patch: { replyVoice: 'formal' },
    });
  });

  it('learns a style note from my replies in this workspace and saves it', async () => {
    learn.mockResolvedValue('Short.\nSays "done in" before the sha.');
    renderWith({ replyVoice: 'mine' });

    fireEvent.click(screen.getByRole('button', { name: /Learn from my replies/ }));

    await waitFor(() =>
      expect(state.patchWorkspaceOverrides).toHaveBeenCalledWith({
        workspaceId: WORKSPACE,
        patch: { replyStyleNote: 'Short.\nSays "done in" before the sha.' },
      }),
    );
    expect(learn).toHaveBeenCalledWith({
      workspaceId: WORKSPACE,
      projectRoots: ['/repos/ledger-core'],
      overrides: state.workspaceOverrides[WORKSPACE],
      connectedProviders: ['anthropic'],
      limitContext: null,
    });
    expect(screen.getByLabelText('Style note')).toHaveProperty(
      'value',
      'Short.\nSays "done in" before the sha.',
    );
  });

  it('says why no note could be learned and saves nothing', async () => {
    learn.mockRejectedValue(new Error("Couldn't find review replies you wrote in this workspace."));
    renderWith({ replyVoice: 'mine' });

    fireEvent.click(screen.getByRole('button', { name: /Learn from my replies/ }));

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

  it('saves a valid template and stores the default as empty', () => {
    renderWith({ replyTemplateFixed: '{reason}\n\nDone in {commit}.' });
    const field = screen.getByLabelText('When fixed');

    fireEvent.change(field, { target: { value: '{reason}\n\nFixed in {commit}.' } });
    fireEvent.blur(field);

    expect(state.patchWorkspaceOverrides).toHaveBeenCalledWith({
      workspaceId: WORKSPACE,
      patch: { replyTemplateFixed: null },
    });
  });

  it('turns off resolving on GitHub and picks the fixup commit style', () => {
    renderWith();

    const [, resolveSwitch] = screen.getAllByRole('switch');
    if (resolveSwitch === undefined) {
      throw new Error('resolve switch missing');
    }
    fireEvent.click(resolveSwitch);

    expect(state.patchWorkspaceOverrides).toHaveBeenCalledWith({
      workspaceId: WORKSPACE,
      patch: { resolveOnGithub: false },
    });
    cleanup();
    renderWith();
    fireEvent.click(screen.getByRole('tab', { name: 'Fixup of the commit that added the line' }));
    expect(state.patchWorkspaceOverrides).toHaveBeenCalledWith({
      workspaceId: WORKSPACE,
      patch: { resolveCommitStyle: 'fixup' },
    });
  });

  it('resets every reply setting after a confirm and keeps signing as it is', async () => {
    renderWith({ replyVoice: 'friendly', attributionFooter: false });

    fireEvent.click(screen.getByRole('button', { name: 'Reset to default' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));

    await waitFor(() =>
      expect(state.patchWorkspaceOverrides).toHaveBeenCalledWith({
        workspaceId: WORKSPACE,
        patch: {
          replyVoice: null,
          replyStyleNote: null,
          replyTemplateFixed: null,
          replyTemplateNoChange: null,
          resolveOnGithub: null,
          resolveCommitStyle: null,
        },
      }),
    );
  });
});
