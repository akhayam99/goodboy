// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';

type SessionStudioKind = 'workflow' | 'github' | 'mr';

type FullPageOverlay = 'newSession' | 'workspaceSettings' | 'sessionSettings';

type AppOverlayState = {
  newSessionOpen: boolean;
  workspaceSettingsOpen: boolean;
  sessionSettingsOpen: boolean;
  sessionStudio: SessionStudioKind | null;
};

function emptyState(): AppOverlayState {
  return {
    newSessionOpen: false,
    workspaceSettingsOpen: false,
    sessionSettingsOpen: false,
    sessionStudio: null,
  };
}

function openSessionStudio(state: AppOverlayState, kind: SessionStudioKind): AppOverlayState {
  return {
    ...state,
    newSessionOpen: false,
    workspaceSettingsOpen: false,
    sessionSettingsOpen: false,
    sessionStudio: kind,
  };
}

function openNewSession(state: AppOverlayState): AppOverlayState {
  return {
    ...state,
    workspaceSettingsOpen: false,
    sessionSettingsOpen: false,
    sessionStudio: null,
    newSessionOpen: true,
  };
}

function openWorkspaceSettings(state: AppOverlayState): AppOverlayState {
  return {
    ...state,
    newSessionOpen: false,
    sessionSettingsOpen: false,
    sessionStudio: null,
    workspaceSettingsOpen: true,
  };
}

function openSessionSettings(state: AppOverlayState): AppOverlayState {
  return {
    ...state,
    newSessionOpen: false,
    workspaceSettingsOpen: false,
    sessionStudio: null,
    sessionSettingsOpen: true,
  };
}

function activeFullPageOverlay(state: AppOverlayState): FullPageOverlay | null {
  if (state.newSessionOpen) return 'newSession';
  if (state.workspaceSettingsOpen) return 'workspaceSettings';
  if (state.sessionSettingsOpen) return 'sessionSettings';
  return null;
}

describe('full-page overlay mutual exclusion', () => {
  it('starts with no overlay and no studio', () => {
    const s = emptyState();
    expect(activeFullPageOverlay(s)).toBeNull();
    expect(s.sessionStudio).toBeNull();
  });

  it('opening a session studio clears any full-page overlay', () => {
    let s = openWorkspaceSettings(emptyState());
    expect(activeFullPageOverlay(s)).toBe('workspaceSettings');
    s = openSessionStudio(s, 'workflow');
    expect(activeFullPageOverlay(s)).toBeNull();
    expect(s.sessionStudio).toBe('workflow');
  });

  it('opening a full-page overlay clears the inline studio', () => {
    let s = openSessionStudio(emptyState(), 'github');
    expect(s.sessionStudio).toBe('github');
    s = openSessionSettings(s);
    expect(activeFullPageOverlay(s)).toBe('sessionSettings');
    expect(s.sessionStudio).toBeNull();
  });

  it('a session holds at most one studio (latest wins)', () => {
    let s = openSessionStudio(emptyState(), 'workflow');
    expect(s.sessionStudio).toBe('workflow');
    s = openSessionStudio(s, 'github');
    expect(s.sessionStudio).toBe('github');
    s = openSessionStudio(s, 'mr');
    expect(s.sessionStudio).toBe('mr');
  });

  it('newSession takes priority over workspaceSettings and sessionSettings', () => {
    const s: AppOverlayState = {
      newSessionOpen: true,
      workspaceSettingsOpen: true,
      sessionSettingsOpen: true,
      sessionStudio: null,
    };
    expect(activeFullPageOverlay(s)).toBe('newSession');
  });

  it('workspaceSettings takes priority over sessionSettings', () => {
    const s: AppOverlayState = {
      ...emptyState(),
      workspaceSettingsOpen: true,
      sessionSettingsOpen: true,
    };
    expect(activeFullPageOverlay(s)).toBe('workspaceSettings');
  });

  it('never renders a full-page overlay and an inline studio at once', () => {
    const transitions = [
      (s: AppOverlayState) => openSessionStudio(s, 'github'),
      (s: AppOverlayState) => openSessionStudio(s, 'mr'),
      (s: AppOverlayState) => openSessionStudio(s, 'workflow'),
      openNewSession,
      openWorkspaceSettings,
      openSessionSettings,
    ];
    for (const first of transitions) {
      for (const second of transitions) {
        let s = emptyState();
        s = first(s);
        s = second(s);
        const overlay = activeFullPageOverlay(s);
        const bothVisible = overlay !== null && s.sessionStudio !== null;
        expect(bothVisible).toBe(false);
      }
    }
  });
});

describe('session studio event dispatch contracts', () => {
  it('goodboy:open-plan-studio event carries sessionId and optional planId', () => {
    let received: CustomEvent | null = null;
    const onEvent = (e: Event) => {
      received = e as CustomEvent;
    };
    window.addEventListener('goodboy:open-plan-studio', onEvent);
    window.dispatchEvent(
      new CustomEvent('goodboy:open-plan-studio', {
        detail: { sessionId: 'sess-42', planId: 'plan-7' },
      }),
    );
    window.removeEventListener('goodboy:open-plan-studio', onEvent);
    expect(received).not.toBeNull();
    expect(received!.detail.sessionId).toBe('sess-42');
    expect(received!.detail.planId).toBe('plan-7');
  });

  it('goodboy:open-diff-viewer event carries sessionId and workingDir', () => {
    let received: CustomEvent | null = null;
    const onEvent = (e: Event) => {
      received = e as CustomEvent;
    };
    window.addEventListener('goodboy:open-diff-viewer', onEvent);
    window.dispatchEvent(
      new CustomEvent('goodboy:open-diff-viewer', {
        detail: { sessionId: 'sess-42', workingDir: '/tmp/wt' },
      }),
    );
    window.removeEventListener('goodboy:open-diff-viewer', onEvent);
    expect(received).not.toBeNull();
    expect(received!.detail.sessionId).toBe('sess-42');
    expect(received!.detail.workingDir).toBe('/tmp/wt');
  });

  it('goodboy:open-github-session event carries sessionId, prNumber and threadId', () => {
    let received: CustomEvent | null = null;
    const onEvent = (e: Event) => {
      received = e as CustomEvent;
    };
    window.addEventListener('goodboy:open-github-session', onEvent);
    window.dispatchEvent(
      new CustomEvent('goodboy:open-github-session', {
        detail: { sessionId: 'sess-42', prNumber: 12, threadId: 'PRRT_x' },
      }),
    );
    window.removeEventListener('goodboy:open-github-session', onEvent);
    expect(received).not.toBeNull();
    expect(received!.detail.sessionId).toBe('sess-42');
    expect(received!.detail.prNumber).toBe(12);
    expect(received!.detail.threadId).toBe('PRRT_x');
  });
});
