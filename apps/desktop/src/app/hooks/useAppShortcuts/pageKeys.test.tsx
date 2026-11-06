// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import type { AgentId, ArtifactId } from '@goodboy/types';
import { aSession, aWorkspace } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../store/storyHarness';
import type { StudioPlace } from '../../../store/slices/navigation/studio';
import { pressShortcut } from '../../../__tests__/helpers/pressKey';
import { useAppShortcuts } from './index';

const workspace = aWorkspace({ name: 'Harborline', slug: 'harborline' });
const session = aSession({ workspaceId: workspace.id, goal: 'Retry failed webhook deliveries' });
const RUN_AGENT_ID: AgentId = JSON.parse(JSON.stringify('page-keys-run-agent'));
const ARTIFACT_ID: ArtifactId = JSON.parse(JSON.stringify('page-keys-artifact'));

const SETTINGS: StudioPlace = { kind: 'settings', focus: { scope: 'app' } };
const CHANGELOG: StudioPlace = { kind: 'changelog' };

let useAppStore: StoryStore;

const Harness = () => {
  useAppShortcuts({
    armDeleteConfirm: () => undefined,
    openPalette: () => undefined,
    openSettings: () => undefined,
    openTerminalStudio: () => undefined,
    openNewChat: () => undefined,
    openShortcutHelp: () => undefined,
    toggleSidebar: () => undefined,
  });
  return null;
};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({ db_select: [] });
  useAppStore.setState({
    workspaces: [workspace],
    currentWorkspaceId: workspace.id,
    sessions: [session],
    currentSessionId: session.id,
    appStudio: null,
  });
});

afterEach(cleanup);

const spyOnNavigate = () => {
  const navigate = vi.fn(useAppStore.getState().navigate);
  useAppStore.setState({ navigate });
  return navigate;
};

const showList = ({ lens }: { readonly lens: 'workflows' | 'plans' }) =>
  useAppStore.setState({ activeLens: { [session.id]: lens } });

const press = ({ id }: { readonly id: 'lens.workflows' | 'lens.plans' }) => {
  render(<Harness />);
  act(() => pressShortcut({ id }));
};

describe.each([
  { id: 'lens.workflows', lens: 'workflows' },
  { id: 'lens.plans', lens: 'plans' },
] as const)('the $lens page key over its own list', ({ id, lens }) => {
  it('stays put when the list is what is visible', () => {
    showList({ lens });
    const navigate = spyOnNavigate();

    press({ id });

    expect(navigate).not.toHaveBeenCalled();
  });

  it.each([
    { name: 'settings', studio: SETTINGS },
    { name: 'a changelog studio', studio: CHANGELOG },
  ])('leaves $name open over the list for the list', ({ studio }) => {
    showList({ lens });
    useAppStore.setState({ appStudio: studio });

    press({ id });

    expect(useAppStore.getState().appStudio).toBeNull();
    expect(useAppStore.getState().activeLens[session.id]).toBe(lens);
  });

  it('closes a drawer open over the list', () => {
    showList({ lens });
    useAppStore.getState().openDrawer({
      kind: 'artifact',
      sessionId: session.id,
      payload: { artifactId: ARTIFACT_ID, tab: 'details' },
    });

    press({ id });

    expect(useAppStore.getState().drawer).toBeNull();
    expect(useAppStore.getState().activeLens[session.id]).toBe(lens);
  });
});

describe('the Artifacts key on a generating artifact page', () => {
  it('lands on the Artifacts list and clears the focused run', () => {
    showList({ lens: 'plans' });
    useAppStore.getState().setFocusedRunAgent({ sessionId: session.id, agentId: RUN_AGENT_ID });
    const navigate = spyOnNavigate();

    press({ id: 'lens.plans' });

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().focusedRunAgentId[session.id] ?? null).toBeNull();
    expect(useAppStore.getState().activeLens[session.id]).toBe('plans');
  });

  it('keeps the focused run when another page is on top of Artifacts', () => {
    useAppStore.setState({ activeLens: { [session.id]: 'questions' } });
    useAppStore.getState().setFocusedRunAgent({ sessionId: session.id, agentId: RUN_AGENT_ID });

    press({ id: 'lens.plans' });

    expect(useAppStore.getState().activeLens[session.id]).toBe('plans');
    expect(useAppStore.getState().focusedRunAgentId[session.id]).toBe(RUN_AGENT_ID);
  });
});
