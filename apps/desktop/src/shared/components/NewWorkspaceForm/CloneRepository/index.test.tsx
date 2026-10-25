// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn(async () => null) }));
vi.mock('@tauri-apps/api/path', () => ({ homeDir: vi.fn(async () => '/mock') }));

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { listen } from '@tauri-apps/api/event';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import type { GitRepoCheck } from '@goodboy/types';
import { aFolderSignals } from '@goodboy/types/testing';
import {
  importStore,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
  storySpies,
  stubStoryInvoke,
} from '../../../../store/storyHarness';
import { NewWorkspaceForm } from '../index';

const LEDGER = '/mock/Developer/ledger-core';
const LEDGER_URL = 'https://github.com/Northwind/ledger-core.git';

type PathParams = {
  readonly path: string;
};

const repoAt = ({ path }: PathParams): GitRepoCheck => ({
  isRepo: true,
  rootPath: path,
  resolvedPath: path,
  defaultBranch: 'main',
  error: null,
  errorKind: null,
});

const missingAt = ({ path }: PathParams): GitRepoCheck => ({
  isRepo: false,
  rootPath: null,
  resolvedPath: null,
  defaultBranch: null,
  error: `path does not exist: ${path}`,
  errorKind: 'not_found',
});

type ArgsParams = {
  readonly args: unknown;
};

const pathOf = ({ args }: ArgsParams): string =>
  typeof args === 'object' && args !== null && 'path' in args ? String(args.path) : '';

type CalledParams = {
  readonly command: string;
};

const callsOf = ({ command }: CalledParams): ReadonlyArray<Record<string, unknown>> =>
  storySpies.tauriInvoke.mock.calls
    .filter(([name]) => name === command)
    .map(([, args]) => (typeof args === 'object' && args !== null ? { ...args } : {}));

type RejectionParams = {
  readonly kind: string;
  readonly message: string;
};

const rejection = ({ kind, message }: RejectionParams) => Promise.reject({ kind, message });

type Deferred<T> = {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
  readonly reject: (reason: unknown) => void;
};

const deferred = <T,>(): Deferred<T> => {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason: unknown) => void = () => undefined;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
};

const FOLDER_ANSWERS = {
  validate_git_repo: (args: unknown) =>
    pathOf({ args }) === LEDGER ? repoAt({ path: LEDGER }) : missingAt({ path: pathOf({ args }) }),
  scan_child_repos: [],
  repo_identity: { rootCommits: [], remoteUrl: null },
  read_folder_signals: (args: unknown) => aFolderSignals({ path: pathOf({ args }) }),
};

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  vi.mocked(listen).mockClear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const openPanel = () => {
  render(<NewWorkspaceForm mode="first-run" />);
  fireEvent.click(screen.getByRole('button', { name: 'Clone it' }));
};

type TypeAddressParams = {
  readonly text: string;
};

const typeAddress = ({ text }: TypeAddressParams) => {
  fireEvent.change(screen.getByLabelText('Repository'), { target: { value: text } });
};

const pressClone = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Clone' }));
  });
};

type ProgressPayload = {
  readonly requestId: unknown;
  readonly phase: string;
  readonly percent: number;
};

const isListening = (): boolean =>
  vi.mocked(listen).mock.calls.some(([name]) => name === 'clone-progress');

type EmitProgressParams = {
  readonly payload: ProgressPayload;
};

const emitProgress = ({ payload }: EmitProgressParams): void => {
  const call = vi.mocked(listen).mock.calls.find(([name]) => name === 'clone-progress');
  const handler = call?.[1];
  if (typeof handler === 'function') {
    handler({ event: 'clone-progress', id: 1, payload });
  }
};

describe('cloning a repository on the Workspace step', () => {
  it('keeps the panel closed until asked and never on the add page', () => {
    stubStoryInvoke(FOLDER_ANSWERS);
    render(<NewWorkspaceForm mode="first-run" />);
    screen.getByRole('button', { name: 'Clone it' });
    expect(screen.queryByRole('group', { name: 'Clone a repository' })).toBeNull();
    cleanup();
    render(<NewWorkspaceForm mode="add" workspaceId={undefined} />);
    expect(screen.queryByRole('button', { name: 'Clone it' })).toBeNull();
  });

  it('clones a GitHub url into ~/Developer and adds it like a ticked folder', async () => {
    stubStoryInvoke({
      ...FOLDER_ANSWERS,
      clone_probe: { route: 'git', host: 'github', name: 'ledger-core' },
      clone_repository: { path: LEDGER },
    });
    openPanel();
    typeAddress({ text: 'https://github.com/Northwind/ledger-core' });
    expect(screen.getByLabelText('Clone into')).toHaveProperty('value', '~/Developer/ledger-core');
    expect(screen.queryByRole('tablist', { name: 'Host' })).toBeNull();

    await pressClone();

    await screen.findByRole('list', { name: 'Folders' });
    screen.getByText('ledger-core');
    expect(callsOf({ command: 'clone_probe' })).toEqual([{ url: LEDGER_URL, destination: LEDGER }]);
    const [cloned] = callsOf({ command: 'clone_repository' });
    expect(cloned).toMatchObject({ url: LEDGER_URL, destination: LEDGER, route: 'git' });
    expect(typeof cloned?.['requestId']).toBe('string');
  });

  it('asks for the host when owner/name is ambiguous, GitLab', async () => {
    stubStoryInvoke({
      ...FOLDER_ANSWERS,
      clone_probe: { route: 'glab', host: 'gitlab', name: 'payments-api' },
      clone_repository: { path: '/mock/Developer/payments-api' },
    });
    openPanel();
    typeAddress({ text: 'acme/payments-api' });
    expect(screen.getByRole('button', { name: 'Clone' })).toHaveProperty('disabled', true);

    fireEvent.click(screen.getByRole('tab', { name: 'GitLab' }));
    await pressClone();

    await waitFor(() => expect(callsOf({ command: 'clone_probe' })).toHaveLength(1));
    expect(callsOf({ command: 'clone_probe' })[0]).toEqual({
      url: 'https://gitlab.com/acme/payments-api.git',
      destination: '/mock/Developer/payments-api',
    });
    expect(callsOf({ command: 'clone_repository' })[0]).toMatchObject({ route: 'glab' });
  });

  it('clones a Bitbucket owner/name with the host chosen and an edited destination', async () => {
    stubStoryInvoke({
      ...FOLDER_ANSWERS,
      clone_probe: { route: 'git', host: 'bitbucket', name: 'notify-relay' },
      clone_repository: { path: '/mock/work/relay' },
    });
    openPanel();
    typeAddress({ text: 'cascadia/notify-relay' });
    fireEvent.click(screen.getByRole('tab', { name: 'Bitbucket' }));
    fireEvent.change(screen.getByLabelText('Clone into'), { target: { value: '~/work/relay' } });
    await pressClone();

    await waitFor(() => expect(callsOf({ command: 'clone_probe' })).toHaveLength(1));
    expect(callsOf({ command: 'clone_probe' })[0]).toEqual({
      url: 'https://bitbucket.org/cascadia/notify-relay.git',
      destination: '/mock/work/relay',
    });
  });

  it.each([
    {
      host: 'github',
      label: 'GitHub',
      text: 'https://github.com/Northwind/ledger-core',
      step: 'gh auth login',
    },
    {
      host: 'gitlab',
      label: 'GitLab',
      text: 'https://gitlab.com/acme/payments-api',
      step: 'glab auth login',
    },
    {
      host: 'bitbucket',
      label: 'Bitbucket',
      text: 'https://bitbucket.org/cascadia/notify-relay',
      step: 'Sign in with git',
    },
  ])(
    'says one line and points to the Tools step when $label has no login',
    async ({ label, text, step }) => {
      stubStoryInvoke({
        ...FOLDER_ANSWERS,
        clone_probe: () => rejection({ kind: 'auth_refused', message: 'no login' }),
      });
      openPanel();
      typeAddress({ text });
      await pressClone();

      const alert = await screen.findByRole('alert');
      expect(alert.textContent).toContain(`No ${label} login found`);
      expect(alert.textContent).toContain(step);
      expect(alert.textContent).toContain('Tools step');
      expect(alert.textContent).toContain('A public repository needs no login.');
      expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
      expect(callsOf({ command: 'clone_repository' })).toHaveLength(0);
    },
  );

  it('offers another name when the destination holds files and never overwrites', async () => {
    stubStoryInvoke({
      ...FOLDER_ANSWERS,
      clone_probe: () => rejection({ kind: 'destination_not_empty', message: 'files' }),
      clone_free_destination: '/mock/Developer/ledger-core-2',
    });
    openPanel();
    typeAddress({ text: 'https://github.com/Northwind/ledger-core' });
    await pressClone();

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('~/Developer/ledger-core already exists');
    expect(alert.textContent).toContain('never overwrites');
    expect(callsOf({ command: 'clone_free_destination' })).toEqual([{ path: LEDGER }]);
    expect(callsOf({ command: 'clone_repository' })).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'Use ~/Developer/ledger-core-2' }));
    expect(screen.getByLabelText('Clone into')).toHaveProperty(
      'value',
      '~/Developer/ledger-core-2',
    );
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('retries after a network failure', async () => {
    let attempts = 0;
    stubStoryInvoke({
      ...FOLDER_ANSWERS,
      clone_probe: { route: 'git', host: 'github', name: 'ledger-core' },
      clone_repository: () => {
        attempts += 1;
        return attempts === 1
          ? rejection({ kind: 'network', message: 'offline' })
          : Promise.resolve({ path: LEDGER });
      },
    });
    openPanel();
    typeAddress({ text: 'https://github.com/Northwind/ledger-core' });
    await pressClone();

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain("couldn't reach GitHub");
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    });

    await screen.findByRole('list', { name: 'Folders' });
    expect(attempts).toBe(2);
  });

  it('names the forms that work when the address is not recognised', async () => {
    stubStoryInvoke(FOLDER_ANSWERS);
    openPanel();
    typeAddress({ text: 'https://example.com/acme/ledger-core' });

    screen.getByText(/Use https:\/\/github\.com\/owner\/name/);
    expect(screen.getByRole('button', { name: 'Clone' })).toHaveProperty('disabled', true);
    expect(callsOf({ command: 'clone_probe' })).toHaveLength(0);
  });

  it('shows progress and cancels mid clone without adding a folder', async () => {
    const running = deferred<{ readonly path: string }>();
    stubStoryInvoke({
      ...FOLDER_ANSWERS,
      clone_probe: { route: 'git', host: 'github', name: 'ledger-core' },
      clone_repository: () => running.promise,
      clone_cancel: null,
    });
    openPanel();
    typeAddress({ text: 'https://github.com/Northwind/ledger-core' });
    await pressClone();

    await waitFor(() => expect(callsOf({ command: 'clone_repository' })).toHaveLength(1));
    const requestId = callsOf({ command: 'clone_repository' })[0]?.['requestId'];
    await waitFor(() => expect(isListening()).toBe(true));
    act(() => {
      emitProgress({ payload: { requestId, phase: 'Receiving objects', percent: 45 } });
    });
    expect(screen.getByRole('status').textContent).toContain('Receiving objects 45%');
    expect(screen.getByRole('button', { name: 'Choose folder' })).toHaveProperty('disabled', true);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    });
    expect(callsOf({ command: 'clone_cancel' })).toEqual([{ requestId }]);
    await act(async () => {
      running.reject({ kind: 'cancelled', message: 'cancelled' });
    });

    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('list', { name: 'Folders' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Clone' })).toHaveProperty('disabled', false);
  });

  it('drops the late answer of a clone the person left', async () => {
    const running = deferred<{ readonly path: string }>();
    stubStoryInvoke({
      ...FOLDER_ANSWERS,
      clone_probe: { route: 'git', host: 'github', name: 'ledger-core' },
      clone_repository: () => running.promise,
      clone_cancel: null,
    });
    const view = render(<NewWorkspaceForm mode="first-run" />);
    fireEvent.click(screen.getByRole('button', { name: 'Clone it' }));
    typeAddress({ text: 'https://github.com/Northwind/ledger-core' });
    await pressClone();
    await waitFor(() => expect(callsOf({ command: 'clone_repository' })).toHaveLength(1));
    const requestId = callsOf({ command: 'clone_repository' })[0]?.['requestId'];

    view.unmount();
    expect(callsOf({ command: 'clone_cancel' })).toEqual([{ requestId }]);
    await act(async () => {
      running.resolve({ path: LEDGER });
    });

    expect(callsOf({ command: 'validate_git_repo' }).map((call) => call['path'])).not.toContain(
      LEDGER,
    );
  });

  it('locks the host choice while a request is in flight', async () => {
    const running = deferred<{ readonly path: string }>();
    stubStoryInvoke({
      ...FOLDER_ANSWERS,
      clone_probe: { route: 'git', host: 'github', name: 'ledger-core' },
      clone_repository: () => running.promise,
      clone_cancel: null,
    });
    openPanel();
    typeAddress({ text: 'Northwind/ledger-core' });
    fireEvent.click(screen.getByRole('tab', { name: 'GitHub' }));
    await pressClone();
    await waitFor(() => expect(callsOf({ command: 'clone_repository' })).toHaveLength(1));

    const gitlab = screen.getByRole('tab', { name: 'GitLab' });
    expect(gitlab).toHaveProperty('disabled', true);
    expect(screen.getByRole('tab', { name: 'Bitbucket' })).toHaveProperty('disabled', true);
    fireEvent.click(gitlab);
    expect(screen.getByRole('tab', { name: 'GitHub' }).getAttribute('aria-selected')).toBe('true');
    expect(callsOf({ command: 'clone_repository' })[0]).toMatchObject({ url: LEDGER_URL });

    await act(async () => {
      running.reject({ kind: 'network', message: 'offline' });
    });
    expect(screen.getByRole('tab', { name: 'GitLab' })).toHaveProperty('disabled', false);
  });

  it('never starts the clone when the panel is left while the listener registers', async () => {
    const registering = deferred<() => void>();
    const unlisten = vi.fn();
    vi.mocked(listen).mockImplementationOnce(() => registering.promise);
    stubStoryInvoke({
      ...FOLDER_ANSWERS,
      clone_probe: { route: 'git', host: 'github', name: 'ledger-core' },
      clone_repository: { path: LEDGER },
      clone_cancel: null,
    });
    const view = render(<NewWorkspaceForm mode="first-run" />);
    fireEvent.click(screen.getByRole('button', { name: 'Clone it' }));
    typeAddress({ text: 'https://github.com/Northwind/ledger-core' });
    await pressClone();
    await waitFor(() => expect(callsOf({ command: 'clone_probe' })).toHaveLength(1));
    await waitFor(() => expect(isListening()).toBe(true));

    view.unmount();
    await act(async () => {
      registering.resolve(unlisten);
    });

    expect(callsOf({ command: 'clone_repository' })).toHaveLength(0);
    expect(callsOf({ command: 'clone_cancel' })).toHaveLength(0);
    expect(unlisten).toHaveBeenCalled();
  });

  it('starts no clone by click or Enter while a folder is being validated', async () => {
    const validating = deferred<GitRepoCheck>();
    vi.mocked(openDialog).mockResolvedValueOnce(LEDGER);
    stubStoryInvoke({
      ...FOLDER_ANSWERS,
      validate_git_repo: (args: unknown) =>
        pathOf({ args }) === LEDGER ? validating.promise : missingAt({ path: pathOf({ args }) }),
      clone_probe: { route: 'git', host: 'github', name: 'ledger-core' },
      clone_repository: { path: LEDGER },
    });
    openPanel();
    typeAddress({ text: 'https://github.com/Northwind/ledger-core' });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Choose folder' }));
    });
    await waitFor(() =>
      expect(
        callsOf({ command: 'validate_git_repo' }).filter((args) => args['path'] === LEDGER),
      ).toHaveLength(1),
    );

    expect(screen.getByRole('button', { name: 'Clone' })).toHaveProperty('disabled', true);
    await act(async () => {
      fireEvent.keyDown(screen.getByLabelText('Repository'), { key: 'Enter' });
      fireEvent.keyDown(screen.getByLabelText('Clone into'), { key: 'Enter' });
    });
    expect(callsOf({ command: 'clone_probe' })).toHaveLength(0);
    expect(callsOf({ command: 'clone_repository' })).toHaveLength(0);

    await act(async () => {
      validating.resolve(repoAt({ path: LEDGER }));
    });
    await screen.findByRole('list', { name: 'Folders' });
    expect(callsOf({ command: 'clone_repository' })).toHaveLength(0);
  });

  it('starts no clone by Retry while a folder is being validated', async () => {
    const validating = deferred<GitRepoCheck>();
    vi.mocked(openDialog).mockResolvedValueOnce(LEDGER);
    stubStoryInvoke({
      ...FOLDER_ANSWERS,
      validate_git_repo: (args: unknown) =>
        pathOf({ args }) === LEDGER ? validating.promise : missingAt({ path: pathOf({ args }) }),
      clone_probe: { route: 'git', host: 'github', name: 'ledger-core' },
      clone_repository: () => rejection({ kind: 'network', message: 'offline' }),
    });
    openPanel();
    typeAddress({ text: 'https://github.com/Northwind/ledger-core' });
    await pressClone();
    await screen.findByRole('alert');
    expect(callsOf({ command: 'clone_repository' })).toHaveLength(1);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Choose folder' }));
    });
    await waitFor(() =>
      expect(
        callsOf({ command: 'validate_git_repo' }).filter((args) => args['path'] === LEDGER),
      ).toHaveLength(1),
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    });
    expect(callsOf({ command: 'clone_repository' })).toHaveLength(1);

    await act(async () => {
      validating.resolve(repoAt({ path: LEDGER }));
    });
  });

  it('keeps a second press from starting a second clone', async () => {
    const running = deferred<{ readonly path: string }>();
    stubStoryInvoke({
      ...FOLDER_ANSWERS,
      clone_probe: { route: 'git', host: 'github', name: 'ledger-core' },
      clone_repository: () => running.promise,
      clone_cancel: null,
    });
    openPanel();
    typeAddress({ text: 'https://github.com/Northwind/ledger-core' });
    const button = screen.getByRole('button', { name: 'Clone' });
    await act(async () => {
      fireEvent.click(button);
      fireEvent.click(button);
    });

    await waitFor(() => expect(callsOf({ command: 'clone_repository' })).toHaveLength(1));
    expect(callsOf({ command: 'clone_probe' })).toHaveLength(1);
  });
});
