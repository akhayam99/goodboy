// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { brandId, type MountId, type PullRequestPerson, type SessionId } from '@goodboy/types';
import { U24_PRPAGE_CREATE_SCENES } from '../../../../app/components/MockScene/scenes/u24/prpage-create';
import { ToastProvider } from '../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { mockSceneIpc } from '../../../../app/components/MockScene/scenes/mockSceneIpc';
import { clearSceneInvoke } from '../../../../test/sceneInvoke';
import { CreatePrPanel } from '../../github/components/PullRequest/CreatePrPanel';
import { CreateReviewForm } from './CreateReviewForm';
import type { CreatedReview, CreateReviewNouns } from './types';

let store: StoryStore;

const actionsOf = (state: ReturnType<StoryStore['getState']>) => ({
  requestScribe: state.requestScribe,
  stopScribe: state.stopScribe,
  createPrForSession: state.createPrForSession,
  createMrForSession: state.createMrForSession,
});

let originals: ReturnType<typeof actionsOf>;

beforeAll(async () => {
  store = await importStore();
  originals = actionsOf(store.getState());
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
  store.setState(originals);
  clearSceneInvoke();
  window.history.replaceState(null, '', '/');
});

type SceneName = keyof typeof U24_PRPAGE_CREATE_SCENES;

const renderScene = ({ name, state }: { readonly name: SceneName; readonly state: string }) => {
  window.history.replaceState(null, '', `/?state=${state}`);
  const Scene = U24_PRPAGE_CREATE_SCENES[name];
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

const titleField = () => screen.findByRole('textbox', { name: 'Pull request title' });

const valueOf = (element: HTMLElement): string => {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    return element.value;
  }
  throw new Error('the element is not a text field');
};

const descriptionValue = (): string =>
  valueOf(screen.getByRole('textbox', { name: 'Pull request description' }));

const firstSessionId = (): SessionId => {
  const session = store.getState().sessions[0];
  if (session === undefined) {
    throw new Error('the scene seeds a session');
  }
  return session.id;
};

const NOUNS: CreateReviewNouns = {
  long: 'pull request',
  create: 'Create pull request',
  createDraft: 'Create draft pull request',
};

const MAYA: PullRequestPerson = { login: 'maya-ortiz', name: 'Maya Ortiz', avatarUrl: null };

describe('the create form', () => {
  it('has no How control, one primary and no bar between the settings and the actions', async () => {
    const { container } = renderScene({ name: 'branch-create', state: 'empty' });
    await titleField();

    expect(screen.queryByRole('tab', { name: 'Manual' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Draft with an agent' })).toBeNull();
    expect(container.querySelectorAll('[data-variant="primary"]').length).toBe(1);
    expect(container.querySelector('[data-slot="form-actions"]')).toBeNull();
    expect(container.querySelector('footer')).toBeNull();
    expect(
      Array.from(container.querySelectorAll('*')).filter((element) =>
        Array.from(element.classList).some(
          (token) => token === 'border-t' || token.startsWith('border-t-'),
        ),
      ),
    ).toEqual([]);
    const card = screen.getByRole('region', { name: 'Pull request text' });
    const actions = container.querySelector('[data-slot="create-actions"]');
    if (actions === null) {
      throw new Error('the form ends in an action row');
    }
    expect(card.compareDocumentPosition(actions) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it('writes with Scribe without ever creating the pull request', async () => {
    renderScene({ name: 'branch-create', state: 'empty' });
    await titleField();
    const requestScribe = vi.fn(async () => 'pr:mount');
    const createPrForSession = vi.fn(async () => ({ number: 318, url: null }));
    act(() => store.setState({ requestScribe, createPrForSession }));

    fireEvent.click(screen.getByRole('button', { name: 'Write with Scribe' }));

    expect(requestScribe).toHaveBeenCalledTimes(1);
    expect(requestScribe).toHaveBeenCalledWith(
      expect.objectContaining({ task: expect.objectContaining({ kind: 'pr', isTextOnly: true }) }),
    );
    expect(createPrForSession).not.toHaveBeenCalled();
  });

  it('shows the writing state in the card, disables Create and stops the job', async () => {
    renderScene({ name: 'branch-create', state: 'writing' });
    const status = await screen.findByText(
      'Scribe is reading 7 commits and writing the text',
      {},
      { timeout: 3_000 },
    );
    const stopScribe = vi.fn(async () => undefined);
    act(() => store.setState({ stopScribe }));

    expect(status.closest('section')).toBe(
      screen.getByRole('region', { name: 'Pull request text' }),
    );
    expect(screen.queryByRole('textbox', { name: 'Pull request title' })).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Push and create pull request' }).hasAttribute('disabled'),
    ).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(stopScribe).toHaveBeenCalledWith({ key: expect.stringMatching(/^pr:/) });
  });

  it('fills the text from the job and says Scribe wrote it', async () => {
    renderScene({ name: 'branch-create', state: 'ready' });

    const title = await titleField();

    expect(valueOf(title)).toBe('Stop duplicate credits when a settlement retries');
    expect(descriptionValue()).toContain('key each credit by the settlement id');
    expect(screen.getByText('Written by Scribe. Edit it as you like.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'More options' })).toBeDefined();
  });

  it('hydrates from the job after the page was left while Scribe wrote', async () => {
    const first = renderScene({ name: 'branch-create', state: 'writing' });
    await screen.findByText('Stop', {}, { timeout: 3_000 });
    first.unmount();
    const state = store.getState();
    const job = Object.values(state.scribeWork)[0];
    const session = state.sessions[0];
    if (job === undefined || session === undefined) {
      throw new Error('the scene seeds a job and a session');
    }
    store.setState({
      scribeWork: {
        [job.key]: {
          ...job,
          status: 'ready',
          output: {
            prTitle: 'Written while away',
            prBody: 'Body written while away',
            commitMessages: [],
            changelogEntry: null,
          },
        },
      },
    });

    render(
      <ToastProvider>
        <CreatePrPanel sessionId={session.id} defaultTitle="Goal" onCreated={() => undefined} />
      </ToastProvider>,
    );

    expect(valueOf(await titleField())).toBe('Written while away');
  });

  it('keeps the text on the card when Scribe fails afterwards, with a Retry', async () => {
    renderScene({ name: 'branch-create', state: 'ready' });
    await titleField();
    const job = Object.values(store.getState().scribeWork)[0];
    if (job === undefined) {
      throw new Error('the scene seeds a job');
    }
    act(() =>
      store.setState({
        scribeWork: {
          [job.key]: {
            ...job,
            status: 'failed',
            output: null,
            error: 'Scribe wrote no text.',
            updatedAt: job.updatedAt + 1,
          },
        },
      }),
    );

    const alert = await screen.findByRole('alert');

    expect(within(alert).getByText('Scribe wrote no text')).toBeDefined();
    expect(within(alert).getByText('Nothing was changed.')).toBeDefined();
    expect(within(alert).getByRole('button', { name: 'Retry' })).toBeDefined();
    expect(descriptionValue()).toContain('key each credit by the settlement id');
  });

  it('discards the text with an Undo that brings it back', async () => {
    renderScene({ name: 'branch-create', state: 'typing' });
    await titleField();

    fireEvent.click(screen.getByRole('button', { name: 'Discard text' }));

    expect(descriptionValue()).toBe('');
    expect(screen.queryByRole('button', { name: 'Discard text' })).toBeNull();
    fireEvent.click(await screen.findByRole('button', { name: 'Undo' }));
    expect(descriptionValue()).toContain('Settlement retries');
    expect(screen.getByRole('button', { name: 'Discard text' })).toBeDefined();
  });

  it('forgets the Scribe job when the written text is discarded, and Undo keeps the text', async () => {
    renderScene({ name: 'branch-create', state: 'ready' });
    await titleField();

    fireEvent.click(screen.getByRole('button', { name: 'Discard text' }));

    expect(Object.keys(store.getState().scribeWork)).toEqual([]);
    expect(descriptionValue()).toBe('');
    fireEvent.click(await screen.findByRole('button', { name: 'Undo' }));
    expect(descriptionValue()).toContain('key each credit by the settlement id');
    expect(screen.getByText('Written by Scribe. Edit it as you like.')).toBeDefined();
  });

  it('shows the push and the opening steps while it creates', async () => {
    renderScene({ name: 'branch-create', state: 'creating' });

    expect(
      await screen.findByText('Pushed hl/fix-duplicate-credit', {}, { timeout: 3_000 }),
    ).toBeDefined();
    expect(screen.getByText('Opening the pull request')).toBeDefined();
    expect(
      screen.getByRole('button', { name: 'Push and create pull request' }).hasAttribute('disabled'),
    ).toBe(true);
  });

  it('keeps the edited text and names the failure when the host refuses', async () => {
    renderScene({ name: 'branch-create', state: 'failed' });

    const alert = await screen.findByRole('alert', {}, { timeout: 3_000 });

    expect(within(alert).getByText("Couldn't open the pull request")).toBeDefined();
    expect(within(alert).getByText('The text is kept.')).toBeDefined();
    expect(descriptionValue()).toContain('Settlement retries');
    expect(
      screen.getByRole('button', { name: 'Push and create pull request' }).hasAttribute('disabled'),
    ).toBe(false);
  });

  it('offers Opens as and Reviewers on GitHub and no Reviewers on GitLab', async () => {
    const github = renderScene({ name: 'branch-create', state: 'empty' });
    await titleField();

    expect(screen.getByRole('tablist', { name: 'Opens as' })).toBeDefined();
    expect(screen.getByRole('region', { name: 'Reviewers' })).toBeDefined();
    expect(screen.getByRole('region', { name: 'Closes' })).toBeDefined();
    github.unmount();

    renderScene({ name: 'branch-create-gitlab', state: 'empty' });
    await screen.findByRole('textbox', { name: 'Merge request title' });

    expect(screen.getByRole('tablist', { name: 'Opens as' })).toBeDefined();
    expect(screen.queryByRole('region', { name: 'Reviewers' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Closes' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Create merge request' })).toBeDefined();
  });

  it('hides Opens as when the host cannot set a draft', async () => {
    const seeded = renderScene({ name: 'branch-create', state: 'empty' });
    await titleField();
    seeded.unmount();
    const sessionId = firstSessionId();

    render(
      <ToastProvider>
        <CreateReviewForm
          sessionId={sessionId}
          defaultTitle="Goal"
          nouns={NOUNS}
          canSetDraft={false}
          loadBases={null}
          searchReviewers={null}
          hasPushStep
          hasCloses
          create={async () => ({ number: 1, url: null })}
          requestReviewers={async () => undefined}
          onCreated={() => undefined}
        />
      </ToastProvider>,
    );
    await titleField();

    expect(screen.queryByRole('tablist', { name: 'Opens as' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Reviewers' })).toBeNull();
  });

  it('requests the chosen reviewers only after the pull request exists', async () => {
    const seeded = renderScene({ name: 'branch-create', state: 'empty' });
    await titleField();
    seeded.unmount();
    const sessionId = firstSessionId();
    const order: Array<string> = [];
    const create = vi.fn(async (): Promise<CreatedReview> => {
      order.push('create');
      return { number: 318, url: null };
    });
    const requestReviewers = vi.fn(async () => {
      order.push('request');
    });
    const onCreated = vi.fn();

    render(
      <ToastProvider>
        <CreateReviewForm
          sessionId={sessionId}
          defaultTitle="Goal"
          nouns={NOUNS}
          canSetDraft
          loadBases={null}
          searchReviewers={async () => [MAYA]}
          hasPushStep
          hasCloses
          create={create}
          requestReviewers={requestReviewers}
          onCreated={onCreated}
        />
      </ToastProvider>,
    );
    await titleField();
    fireEvent.click(screen.getByRole('button', { name: 'Request review' }));
    fireEvent.click(await screen.findByRole('button', { name: 'maya-ortiz' }));
    expect(requestReviewers).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Push and create pull request' }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith({ number: 318, url: null }));
    expect(order).toEqual(['create', 'request']);
    expect(requestReviewers).toHaveBeenCalledWith({
      sessionId,
      number: 318,
      logins: ['maya-ortiz'],
    });
  });

  it('asks for the reviewers in the repository the pull request was created in', async () => {
    const seeded = renderScene({ name: 'branch-create', state: 'empty' });
    await titleField();
    seeded.unmount();
    const sessionId = firstSessionId();
    const first = store.getState().sessionProjectMounts[sessionId]?.[0];
    if (first === undefined) {
      throw new Error('the scene seeds a mount');
    }
    const shown = {
      ...first,
      mountId: brandId<MountId>({ value: 'mount-payments-api' }),
      repoRoot: '/repos/payments-api',
      worktreePath: '/worktrees/payments-api',
      lastWorktreePath: '/worktrees/payments-api',
      parallelIndex: 1,
    };
    const firstView = store.getState().sessionMounts[sessionId]?.[0];
    if (firstView === undefined) {
      throw new Error('the scene seeds a mount view');
    }
    const roots: Array<string> = [];
    mockSceneIpc((command, payload) => {
      const args: unknown = typeof payload === 'object' && payload !== null ? payload : null;
      const line = Array.isArray(Reflect.get(args ?? {}, 'args'))
        ? String(Reflect.get(args ?? {}, 'args'))
        : '';
      if (command !== 'gh_run' || !line.includes('collaborators')) {
        return null;
      }
      roots.push(String(Reflect.get(args ?? {}, 'cwd')));
      return { stdout: 'maya-ortiz\t\n', stderr: '', exitCode: 0 };
    });
    const createPrForSession = vi.fn(async () => ({ number: 44, url: null }));
    const requestReview = vi.fn(async () => undefined);
    act(() =>
      store.setState({
        sessionProjectMounts: { [sessionId]: [first, shown] },
        sessionMounts: {
          [sessionId]: [
            firstView,
            {
              ...firstView,
              id: shown.mountId,
              repoRoot: shown.repoRoot,
              worktreePath: shown.worktreePath,
              lastWorktreePath: shown.lastWorktreePath,
              parallelIndex: 1,
            },
          ],
        },
        createPrForSession,
        requestReview,
      }),
    );

    render(
      <ToastProvider>
        <CreatePrPanel
          sessionId={sessionId}
          mountId={shown.mountId}
          defaultTitle="Goal"
          onCreated={() => undefined}
        />
      </ToastProvider>,
    );
    await titleField();
    fireEvent.click(screen.getByRole('button', { name: 'Request review' }));
    fireEvent.click(await screen.findByRole('button', { name: 'maya-ortiz' }));
    fireEvent.click(screen.getByRole('button', { name: /create pull request$/i }));

    await waitFor(() =>
      expect(requestReview).toHaveBeenCalledWith(sessionId, 44, ['maya-ortiz'], {
        mountId: shown.mountId,
      }),
    );
    expect(roots).toEqual(['/repos/payments-api']);
  });

  describe('on GitLab', () => {
    const typeInto = ({ name, value }: { readonly name: string; readonly value: string }) =>
      fireEvent.change(screen.getByRole('textbox', { name }), { target: { value } });

    it('creates the merge request with the typed text, the target and Ready by default', async () => {
      renderScene({ name: 'branch-create-gitlab', state: 'empty' });
      await screen.findByRole('textbox', { name: 'Merge request title' });
      const createMrForSession = vi.fn(async () => undefined);
      act(() => store.setState({ createMrForSession }));

      typeInto({ name: 'Merge request title', value: 'Ship the GitLab release' });
      typeInto({ name: 'Merge request description', value: 'Documents the release changes.' });
      typeInto({ name: 'Target branch', value: 'develop' });
      fireEvent.click(screen.getByRole('button', { name: 'Create merge request' }));

      await waitFor(() =>
        expect(createMrForSession).toHaveBeenCalledWith({
          sessionId: firstSessionId(),
          title: 'Ship the GitLab release',
          description: 'Documents the release changes.',
          targetBranch: 'develop',
          draft: false,
        }),
      );
    });

    it('opens it as a draft when Draft is picked', async () => {
      renderScene({ name: 'branch-create-gitlab', state: 'empty' });
      await screen.findByRole('textbox', { name: 'Merge request title' });
      const createMrForSession = vi.fn(async () => undefined);
      act(() => store.setState({ createMrForSession }));

      fireEvent.click(screen.getByRole('tab', { name: 'Draft' }));
      fireEvent.click(screen.getByRole('button', { name: 'Create draft merge request' }));

      await waitFor(() =>
        expect(createMrForSession).toHaveBeenCalledWith(expect.objectContaining({ draft: true })),
      );
    });

    it('names the failure and keeps the text when GitLab refuses', async () => {
      renderScene({ name: 'branch-create-gitlab', state: 'empty' });
      await screen.findByRole('textbox', { name: 'Merge request title' });
      const createMrForSession = vi.fn(async () => {
        throw new Error('GitLab token expired');
      });
      act(() => store.setState({ createMrForSession }));
      typeInto({ name: 'Merge request description', value: 'Documents the release changes.' });

      fireEvent.click(screen.getByRole('button', { name: 'Create merge request' }));

      const alert = await screen.findByRole('alert');
      expect(within(alert).getByText("Couldn't open the merge request")).toBeDefined();
      expect(within(alert).getByText('The text is kept.')).toBeDefined();
      expect(valueOf(screen.getByRole('textbox', { name: 'Merge request description' }))).toBe(
        'Documents the release changes.',
      );
    });

    it('asks Scribe for the text on the same job and never creates', async () => {
      renderScene({ name: 'branch-create-gitlab', state: 'empty' });
      await screen.findByRole('textbox', { name: 'Merge request title' });
      const requestScribe = vi.fn(async () => 'pr:mount');
      const createMrForSession = vi.fn(async () => undefined);
      act(() => store.setState({ requestScribe, createMrForSession }));

      fireEvent.click(screen.getByRole('button', { name: 'Write with Scribe' }));

      expect(requestScribe).toHaveBeenCalledWith(
        expect.objectContaining({
          task: expect.objectContaining({ kind: 'pr', isTextOnly: true }),
        }),
      );
      expect(createMrForSession).not.toHaveBeenCalled();
    });
  });
});
