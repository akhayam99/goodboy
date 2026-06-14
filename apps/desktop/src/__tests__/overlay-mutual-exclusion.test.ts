// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

type OverlayKind =
  | 'planStudio'
  | 'diffViewer'
  | 'githubSession'
  | 'sessionSettings'
  | 'workspaceSettings'
  | 'newSession'
  | 'workflowBuilder';

type OverlayState = {
  planStudioSession: string | null;
  diffViewerSession: string | null;
  githubSessionPane: string | null;
  sessionSettingsOpen: boolean;
  workspaceSettingsOpen: boolean;
  newSessionOpen: boolean;
  workflowBuilderSessionId: string | null;
};

function emptyState(): OverlayState {
  return {
    planStudioSession: null,
    diffViewerSession: null,
    githubSessionPane: null,
    sessionSettingsOpen: false,
    workspaceSettingsOpen: false,
    newSessionOpen: false,
    workflowBuilderSessionId: null,
  };
}

function applyOpenPlanStudio(state: OverlayState, sessionId: string): OverlayState {
  return {
    ...state,
    newSessionOpen: false,
    workspaceSettingsOpen: false,
    sessionSettingsOpen: false,
    workflowBuilderSessionId: null,
    diffViewerSession: null,
    githubSessionPane: null,
    planStudioSession: sessionId,
  };
}

function applyOpenDiffViewer(state: OverlayState, sessionId: string): OverlayState {
  return {
    ...state,
    newSessionOpen: false,
    workspaceSettingsOpen: false,
    sessionSettingsOpen: false,
    workflowBuilderSessionId: null,
    planStudioSession: null,
    githubSessionPane: null,
    diffViewerSession: sessionId,
  };
}

function applyOpenGithubSession(state: OverlayState, sessionId: string): OverlayState {
  return {
    ...state,
    newSessionOpen: false,
    workspaceSettingsOpen: false,
    sessionSettingsOpen: false,
    workflowBuilderSessionId: null,
    planStudioSession: null,
    diffViewerSession: null,
    githubSessionPane: sessionId,
  };
}

function applyOpenSessionSettings(state: OverlayState): OverlayState {
  return {
    ...state,
    workspaceSettingsOpen: false,
    workflowBuilderSessionId: null,
    newSessionOpen: false,
    planStudioSession: null,
    diffViewerSession: null,
    githubSessionPane: null,
    sessionSettingsOpen: true,
  };
}

function applyOpenWorkspaceSettings(state: OverlayState): OverlayState {
  return {
    ...state,
    sessionSettingsOpen: false,
    newSessionOpen: false,
    planStudioSession: null,
    diffViewerSession: null,
    githubSessionPane: null,
    workspaceSettingsOpen: true,
  };
}

function applyOpenNewSession(state: OverlayState): OverlayState {
  return {
    ...state,
    workspaceSettingsOpen: false,
    sessionSettingsOpen: false,
    workflowBuilderSessionId: null,
    planStudioSession: null,
    diffViewerSession: null,
    githubSessionPane: null,
    newSessionOpen: true,
  };
}

function applyOpenWorkflowBuilder(state: OverlayState, sessionId: string): OverlayState {
  return {
    ...state,
    workspaceSettingsOpen: false,
    sessionSettingsOpen: false,
    newSessionOpen: false,
    planStudioSession: null,
    diffViewerSession: null,
    githubSessionPane: null,
    workflowBuilderSessionId: sessionId,
  };
}

function activeOverlay(state: OverlayState): OverlayKind | null {
  if (state.newSessionOpen) return 'newSession';
  if (state.workspaceSettingsOpen) return 'workspaceSettings';
  if (state.sessionSettingsOpen) return 'sessionSettings';
  if (state.workflowBuilderSessionId) return 'workflowBuilder';
  if (state.planStudioSession) return 'planStudio';
  if (state.diffViewerSession) return 'diffViewer';
  if (state.githubSessionPane) return 'githubSession';
  return null;
}

describe('overlay mutual exclusion state machine', () => {
  it('starts with no active overlay', () => {
    expect(activeOverlay(emptyState())).toBeNull();
  });

  it('opening plan studio clears diff viewer', () => {
    let s = emptyState();
    s = applyOpenDiffViewer(s, 'sess-1');
    expect(activeOverlay(s)).toBe('diffViewer');
    s = applyOpenPlanStudio(s, 'sess-1');
    expect(activeOverlay(s)).toBe('planStudio');
    expect(s.diffViewerSession).toBeNull();
  });

  it('opening diff viewer clears plan studio', () => {
    let s = emptyState();
    s = applyOpenPlanStudio(s, 'sess-1');
    expect(activeOverlay(s)).toBe('planStudio');
    s = applyOpenDiffViewer(s, 'sess-1');
    expect(activeOverlay(s)).toBe('diffViewer');
    expect(s.planStudioSession).toBeNull();
  });

  it('opening session settings clears plan studio and diff viewer', () => {
    let s = emptyState();
    s = applyOpenPlanStudio(s, 'sess-1');
    s = applyOpenSessionSettings(s);
    expect(activeOverlay(s)).toBe('sessionSettings');
    expect(s.planStudioSession).toBeNull();
    expect(s.diffViewerSession).toBeNull();
  });

  it('opening workspace settings clears plan studio and diff viewer', () => {
    let s = emptyState();
    s = applyOpenDiffViewer(s, 'sess-1');
    s = applyOpenWorkspaceSettings(s);
    expect(activeOverlay(s)).toBe('workspaceSettings');
    expect(s.planStudioSession).toBeNull();
    expect(s.diffViewerSession).toBeNull();
  });

  it('opening new session clears all overlays', () => {
    let s = emptyState();
    s = applyOpenPlanStudio(s, 'sess-1');
    s = applyOpenNewSession(s);
    expect(activeOverlay(s)).toBe('newSession');
    expect(s.planStudioSession).toBeNull();
    expect(s.diffViewerSession).toBeNull();
    expect(s.workspaceSettingsOpen).toBe(false);
    expect(s.sessionSettingsOpen).toBe(false);
    expect(s.workflowBuilderSessionId).toBeNull();
  });

  it('opening workflow builder clears plan studio and diff viewer', () => {
    let s = emptyState();
    s = applyOpenDiffViewer(s, 'sess-1');
    s = applyOpenWorkflowBuilder(s, 'sess-1');
    expect(activeOverlay(s)).toBe('workflowBuilder');
    expect(s.diffViewerSession).toBeNull();
    expect(s.planStudioSession).toBeNull();
  });

  it('opening github session clears plan studio and diff viewer', () => {
    let s = emptyState();
    s = applyOpenDiffViewer(s, 'sess-1');
    s = applyOpenGithubSession(s, 'sess-1');
    expect(activeOverlay(s)).toBe('githubSession');
    expect(s.diffViewerSession).toBeNull();
    expect(s.planStudioSession).toBeNull();
  });

  it('opening diff viewer clears github session', () => {
    let s = emptyState();
    s = applyOpenGithubSession(s, 'sess-1');
    expect(activeOverlay(s)).toBe('githubSession');
    s = applyOpenDiffViewer(s, 'sess-1');
    expect(activeOverlay(s)).toBe('diffViewer');
    expect(s.githubSessionPane).toBeNull();
  });

  it('at most one overlay renders across all transition pairs (priority chain)', () => {
    const transitions = [
      (s: OverlayState) => applyOpenPlanStudio(s, 'sess-1'),
      (s: OverlayState) => applyOpenDiffViewer(s, 'sess-1'),
      (s: OverlayState) => applyOpenGithubSession(s, 'sess-1'),
      (s: OverlayState) => applyOpenSessionSettings(s),
      (s: OverlayState) => applyOpenWorkspaceSettings(s),
      (s: OverlayState) => applyOpenNewSession(s),
      (s: OverlayState) => applyOpenWorkflowBuilder(s, 'sess-1'),
    ];

    for (const first of transitions) {
      for (const second of transitions) {
        let s = emptyState();
        s = first(s);
        s = second(s);

        const rendered = activeOverlay(s);
        expect(rendered).not.toBeNull();
      }
    }
  });
});

describe('overlay rendering priority chain', () => {
  it('newSession takes priority over everything', () => {
    const s: OverlayState = {
      planStudioSession: 'sess-1',
      diffViewerSession: 'sess-1',
      githubSessionPane: 'sess-1',
      sessionSettingsOpen: true,
      workspaceSettingsOpen: true,
      newSessionOpen: true,
      workflowBuilderSessionId: 'sess-1',
    };
    expect(activeOverlay(s)).toBe('newSession');
  });

  it('workspaceSettings takes priority over sessionSettings and below', () => {
    const s: OverlayState = {
      ...emptyState(),
      workspaceSettingsOpen: true,
      sessionSettingsOpen: true,
      planStudioSession: 'sess-1',
    };
    expect(activeOverlay(s)).toBe('workspaceSettings');
  });

  it('sessionSettings takes priority over workflowBuilder, planStudio, diffViewer', () => {
    const s: OverlayState = {
      ...emptyState(),
      sessionSettingsOpen: true,
      workflowBuilderSessionId: 'sess-1',
      planStudioSession: 'sess-1',
      diffViewerSession: 'sess-1',
    };
    expect(activeOverlay(s)).toBe('sessionSettings');
  });

  it('planStudio takes priority over diffViewer', () => {
    const s: OverlayState = {
      ...emptyState(),
      planStudioSession: 'sess-1',
      diffViewerSession: 'sess-1',
    };
    expect(activeOverlay(s)).toBe('planStudio');
  });

  it('diffViewer takes priority over githubSession', () => {
    const s: OverlayState = {
      ...emptyState(),
      diffViewerSession: 'sess-1',
      githubSessionPane: 'sess-1',
    };
    expect(activeOverlay(s)).toBe('diffViewer');
  });
});

describe('overlay event dispatch contracts', () => {
  beforeEach(() => {
    window.dispatchEvent = window.dispatchEvent.bind(window);
  });

  afterEach(() => {
    (window as Window & { _listeners?: unknown[] })._listeners = [];
  });

  it('goodboy:open-plan-studio event carries sessionId and optional planId', () => {
    let received: CustomEvent | null = null;
    window.addEventListener('goodboy:open-plan-studio', (e) => {
      received = e as CustomEvent;
    });
    window.dispatchEvent(
      new CustomEvent('goodboy:open-plan-studio', {
        detail: { sessionId: 'sess-42', planId: 'plan-7' },
      }),
    );
    expect(received).not.toBeNull();
    expect(received!.detail.sessionId).toBe('sess-42');
    expect(received!.detail.planId).toBe('plan-7');
  });

  it('goodboy:open-diff-viewer event carries sessionId and workingDir', () => {
    let received: CustomEvent | null = null;
    window.addEventListener('goodboy:open-diff-viewer', (e) => {
      received = e as CustomEvent;
    });
    window.dispatchEvent(
      new CustomEvent('goodboy:open-diff-viewer', {
        detail: { sessionId: 'sess-42', workingDir: '/tmp/wt' },
      }),
    );
    expect(received).not.toBeNull();
    expect(received!.detail.sessionId).toBe('sess-42');
    expect(received!.detail.workingDir).toBe('/tmp/wt');
  });

  it('goodboy:open-diff-viewer with missing sessionId is a no-op by convention', () => {
    let received: CustomEvent | null = null;
    window.addEventListener('goodboy:open-diff-viewer', (e) => {
      received = e as CustomEvent;
    });
    window.dispatchEvent(new CustomEvent('goodboy:open-diff-viewer', { detail: {} }));
    expect(received).not.toBeNull();
    expect(received!.detail.sessionId).toBeUndefined();
  });

  it('goodboy:open-github-session event carries sessionId, prNumber and threadId', () => {
    let received: CustomEvent | null = null;
    window.addEventListener('goodboy:open-github-session', (e) => {
      received = e as CustomEvent;
    });
    window.dispatchEvent(
      new CustomEvent('goodboy:open-github-session', {
        detail: { sessionId: 'sess-42', prNumber: 12, threadId: 'PRRT_x' },
      }),
    );
    expect(received).not.toBeNull();
    expect(received!.detail.sessionId).toBe('sess-42');
    expect(received!.detail.prNumber).toBe(12);
    expect(received!.detail.threadId).toBe('PRRT_x');
  });
});
