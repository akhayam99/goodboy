// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { OverrideSettings, SessionId } from '@goodboy/types';
import { overridesWithAttribution } from '../../../../__tests__/helpers/attributionOverrides';
import { ReplySettingsLine } from './ReplySettingsLine';

const SESSION = 'session-1' as SessionId;

const { state } = vi.hoisted(() => ({
  state: {
    sessions: [{ id: 'session-1', workspaceId: 'workspace-1' }],
    sessionActiveProject: {},
    projects: [],
    workspaceOverrides: {} as Record<string, OverrideSettings>,
  },
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}));

afterEach(() => {
  cleanup();
});

describe('ReplySettingsLine', () => {
  it('says how the reply will go out and opens the review replies settings', () => {
    state.workspaceOverrides = {
      'workspace-1': {
        ...overridesWithAttribution({ attributionFooter: null }),
        replyVoice: 'friendly',
        resolveOnGithub: false,
      },
    };
    const opened = vi.fn();
    window.addEventListener('goodboy:open-settings', opened);

    render(<ReplySettingsLine sessionId={SESSION} />);
    fireEvent.click(screen.getByRole('button', { name: 'Review reply settings' }));

    expect(screen.getByText('Friendly · signed · leaves the thread open')).toBeDefined();
    expect((opened.mock.calls[0]?.[0] as CustomEvent).detail).toEqual({
      scope: 'workspace',
      section: 'review-replies',
    });
    window.removeEventListener('goodboy:open-settings', opened);
  });

  it('reads the defaults when the workspace chose nothing', () => {
    state.workspaceOverrides = {};

    render(<ReplySettingsLine sessionId={SESSION} />);

    expect(screen.getByText('Terse · signed · resolves the thread on GitHub')).toBeDefined();
  });
});
