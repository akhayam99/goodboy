// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { aProject } from '@goodboy/types/testing';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { PublishPanel } from '../../../../../features/bootstrap/PublishPanel';
import { expectBaseline } from '../../../../../__tests__/a11y/baseline';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { SettingsWorkspaceScene } from '../audit/SettingsWorkspaceScene';
import { U23_POLICY_FAILURES_SCENES } from './policy-failures';

const SETTLE_MS = 2_000;
const STAGE_FAILURE = "Cannot read properties of undefined (reading 'path')";

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
  await import('../../../../../features/settings/components/SettingsStudio');
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  cleanup();
  clearSceneInvoke();
});

const settle = async (): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
};

const mount = async (name: string): Promise<Element> => {
  const Scene = U23_POLICY_FAILURES_SCENES[name];
  if (Scene === undefined) {
    throw new Error(`no scene ${name}`);
  }
  const { container } = render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await settle();
  expect(screen.queryByText('Something went wrong')).toBeNull();
  return container;
};

type NoticeShape = {
  readonly title: string;
  readonly body: string;
  readonly raw: string;
  readonly retry: boolean;
};

const expectFailureNotice = ({
  alert,
  shape,
}: {
  readonly alert: HTMLElement;
  readonly shape: NoticeShape;
}) => {
  expect(within(alert).getByText(shape.title)).toBeDefined();
  expect(within(alert).getByText(shape.body)).toBeDefined();
  expect(alert.textContent).not.toContain(shape.raw);
  const details = within(alert).getByRole('button', { name: 'Details' });
  expect(details.getAttribute('aria-expanded')).toBe('false');
  fireEvent.click(details);
  expect(alert.textContent).toContain(shape.raw);
  expect(within(alert).queryByRole('button', { name: 'Retry' }) !== null).toBe(shape.retry);
};

describe('the policy and failure scenes', () => {
  it('names the five scenes of the unit', () => {
    expect(Object.keys(U23_POLICY_FAILURES_SCENES).sort()).toEqual([
      'first-lap-publish-no-gh',
      'scribe-failed',
      'settings-providers-scope',
      'settings-run-defaults-link',
      'wireframe-failed',
    ]);
  });

  it('settings-providers-scope names the workspace in the header and opens the policy with the spread option', async () => {
    await mount('settings-providers-scope');

    const heading = screen.getByRole('heading', { level: 1, name: 'Models' });
    expect(heading.parentElement?.parentElement?.textContent).toContain('Harborline');
    const popover = within(screen.getByRole('dialog', { name: 'When a provider is out' }));
    const toggle = popover.getByRole('switch', {
      name: 'Send new steps to the provider with the most room',
    });
    expect(toggle.hasAttribute('disabled')).toBe(false);
    expect(popover.getAllByRole('switch')).toHaveLength(1);
  });

  it('settings-run-defaults-link shows the policy as a summary and a link, with no switch for it', async () => {
    await mount('settings-run-defaults-link');

    const band = screen.getByRole('region', { name: 'Providers' });
    expect(within(band).getByText('When a provider is out')).toBeDefined();
    expect(within(band).getByRole('button', { name: 'Open Providers & models' })).toBeDefined();
    expect(within(band).queryAllByRole('switch')).toEqual([]);
  });

  it('wireframe-failed explains the failure in a notice and keeps the raw message behind Details', async () => {
    await mount('wireframe-failed');

    expectFailureNotice({
      alert: screen.getByRole('alert'),
      shape: {
        title: "Couldn't show the pages",
        body: 'The wireframe is saved, but its preview did not render.',
        raw: STAGE_FAILURE,
        retry: true,
      },
    });
  });

  it('scribe-failed explains the failure in a notice and the header says Failed', async () => {
    await mount('scribe-failed');

    expectFailureNotice({
      alert: screen.getByRole('alert'),
      shape: {
        title: "Couldn't write the pull request text",
        body: 'The text is kept, so you can try again.',
        raw: 'Permission to harborline/ledger-core.git denied',
        retry: true,
      },
    });
    expect(screen.getAllByText('Failed').length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText('Done')).toBeNull();
  });

  it('first-lap-publish-no-gh starts on the existing repository, offers the install help and no primary', async () => {
    await mount('first-lap-publish-no-gh');

    const panel = screen.getByRole('region', { name: 'Publish this project' });
    expect(
      within(panel)
        .getByRole('tab', { name: 'Use an existing repository' })
        .getAttribute('aria-selected'),
    ).toBe('true');
    fireEvent.click(within(panel).getByRole('tab', { name: 'Create on GitHub' }));
    expect(within(panel).getByText("GitHub's command line tool isn't installed")).toBeDefined();
    expect(within(panel).getByRole('button', { name: 'Check again' })).toBeDefined();
    expect(within(panel).queryByRole('button', { name: /^Publish/ })).toBeNull();
    expect(within(panel).getByRole('button', { name: 'Cancel' })).toBeDefined();
  });

  it('shapes a failed publish like the other two failures', async () => {
    const project = aProject({ name: 'cascadia', kind: 'repo', rootPath: '/mock/cascadia' });
    useAppStore.setState({
      githubStatus: { available: false, mode: 'absent', scopes: [], scoped: false },
      publishFirstLap: async () => ({
        kind: 'failed',
        step: 'push',
        message: 'remote: Permission to northwind/cascadia.git denied',
        remoteUrl: 'https://github.com/northwind/cascadia',
      }),
    });
    render(
      <PublishPanel project={project} onPublished={() => undefined} onCancel={() => undefined} />,
    );
    fireEvent.change(screen.getByLabelText('Repository address'), {
      target: { value: 'https://github.com/northwind/cascadia.git' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await settle();

    expectFailureNotice({
      alert: screen.getByRole('alert'),
      shape: {
        title: 'Publishing main failed',
        body: 'The repository exists at https://github.com/northwind/cascadia and was not removed.',
        raw: 'Permission to northwind/cascadia.git denied',
        retry: true,
      },
    });
  });

  it('shows the workspace name once on Settings > Workspace > Projects, in the top bar', async () => {
    useAppStore.setState({ loadProjectGitStatus: async () => undefined });
    render(
      <ToastProvider>
        <SettingsWorkspaceScene />
      </ToastProvider>,
    );
    await settle();

    expect(screen.getByRole('heading', { level: 1, name: 'Projects' })).toBeDefined();
    expect(screen.getAllByText('Harborline')).toHaveLength(1);
    const page = document.querySelector('[data-settings-detail]');
    expect(page).not.toBeNull();
    expect(within(page as HTMLElement).queryAllByText(/Harborline/)).toEqual([]);
    expect(screen.getByLabelText('Workspace name')).toHaveProperty('value', 'Harborline');
  });

  it.each(Object.keys(U23_POLICY_FAILURES_SCENES))(
    '%s has no accessibility violation beyond its baseline',
    async (name) => {
      const container = await mount(name);
      vi.useRealTimers();

      await expectBaseline({ name: `scene ${name}`, container });
    },
  );
});
