// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { leadPermissionsOf } from '@goodboy/core/auto';
import { brandId, type AgentId } from '@goodboy/types';
import { SETTING_WORK_ENABLED } from '../../../shared/lib/workSetting';
import { anAgent } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../store/storyHarness';
import type { AutoTreeView } from '../../../store/slices/auto-view/state';
import { AutoDockUnderTest } from '../testing/AutoDockUnderTest';
import { FIXTURE_SESSION } from '../testing/autoViewFixtures';
import { workLeadDependencyView } from '../testing/workLeadDependencyView';
import { workLeadPushView } from '../testing/workLeadPushView';
import { CONFIRM_REFUSED_REASON } from '../CONFIRM_REFUSED_REASON';
import { registerAskAnswerPort, type AskAnswerPort } from '../askAnswerPort';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
  registerAskAnswerPort({ port: null });
});

const ROOT = anAgent({ id: brandId<AgentId>({ value: 'agent-auto' }) });

type RenderParams = {
  readonly view: AutoTreeView;
  readonly port: AskAnswerPort;
};

const renderDock = ({ view, port }: RenderParams) => {
  registerAskAnswerPort({ port });
  useAppStore.setState({
    autoTreeViews: { [FIXTURE_SESSION]: [view] },
    loadAutoTrees: async () => undefined,
    settings: { ...useAppStore.getState().settings, [SETTING_WORK_ENABLED]: 'true' },
    readLeadPermissions: async () =>
      leadPermissionsOf({
        leadRows: { push: 'ask', dependencies: 'ask' },
        defaultRows: {},
        sessionLevel: 'plan',
        workspaceLevel: null,
        isPlanApprovalOff: false,
        isWorkFlowOn: true,
        spendLimitUsd: 10,
      }),
  });
  return render(<AutoDockUnderTest view={view} rootAgent={ROOT} onOpenArtifact={vi.fn()} />);
};

describe('AutoDock asks', () => {
  it('draws a dependency ask with one primary and one quiet answer', () => {
    renderDock({
      view: workLeadDependencyView(),
      port: vi.fn<AskAnswerPort>(async () => 'allowed'),
    });

    screen.getByText('Tester needs a dependency');
    screen.getByRole('button', { name: 'Allow nock@14.0.1' });
    screen.getByRole('button', { name: 'Do it without' });
    expect(document.querySelectorAll('[data-ask-bar] button')).toHaveLength(2);
  });

  it('draws the push ask first and counts the pull request behind it', () => {
    renderDock({ view: workLeadPushView(), port: vi.fn<AskAnswerPort>(async () => 'allowed') });

    screen.getByRole('button', { name: 'Push' });
    screen.getByRole('button', { name: "Don't push" });
    screen.getByText('+1 more');
  });

  it('answers by ask id once and drops a second answer to the same ask', async () => {
    const port = vi.fn<AskAnswerPort>(async () => 'allowed');
    renderDock({ view: workLeadDependencyView(), port });

    const allow = screen.getByRole('button', { name: 'Allow nock@14.0.1' });
    fireEvent.click(allow);
    fireEvent.click(allow);
    await waitFor(() => expect(port).toHaveBeenCalledTimes(1));
    expect(port).toHaveBeenCalledWith({
      askId: 'grant:grant-dependency-attempt-tester',
      answer: 'allow',
    });
  });

  it('keeps the ask and shows the reason when the answer is refused', async () => {
    renderDock({
      view: workLeadDependencyView(),
      port: vi.fn<AskAnswerPort>(async () => 'refused'),
    });

    fireEvent.click(screen.getByRole('button', { name: 'Do it without' }));

    await screen.findByText(CONFIRM_REFUSED_REASON);
    screen.getByRole('button', { name: 'Allow nock@14.0.1' });
  });

  it('keeps the ask and shows the error when the answer fails', async () => {
    renderDock({
      view: workLeadDependencyView(),
      port: vi.fn<AskAnswerPort>(async () => {
        throw new Error('The database is locked.');
      }),
    });

    fireEvent.click(screen.getByRole('button', { name: 'Allow nock@14.0.1' }));

    await screen.findByText('The database is locked.');
  });

  it('clears when the same ask is answered from the board row', () => {
    const view = workLeadDependencyView();
    const { rerender } = renderDock({ view, port: vi.fn<AskAnswerPort>(async () => 'allowed') });
    screen.getByText('Tester needs a dependency');

    rerender(
      <AutoDockUnderTest
        view={{ ...view, grantAsks: [] }}
        rootAgent={ROOT}
        onOpenArtifact={vi.fn()}
      />,
    );

    expect(screen.queryByText('Tester needs a dependency')).toBeNull();
  });
});
