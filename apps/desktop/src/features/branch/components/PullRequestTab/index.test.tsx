// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { SESSION } from '../../../../app/components/MockScene/scenes/resolveSeed';
import {
  prPageHandlers,
  type PrPageVariant,
} from '../../../../app/components/MockScene/scenes/u23/prPageSeed';
import { PrPageScene } from '../../../../app/components/MockScene/scenes/u23/PrPageScene';
import { ToastProvider } from '../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const COLLABORATORS = 'omar-t\t\nkenji-w\t\nrio-k\thttps://avatars.example/rio\n';

let behindMain = 0;

const answer = async (command: string, args: unknown): Promise<unknown> => {
  const handlers = prPageHandlers({ behind: behindMain });
  const handler = handlers[command];
  if (handler !== undefined) {
    return handler(undefined);
  }
  const argv =
    typeof args === 'object' && args !== null && 'args' in args && Array.isArray(args.args)
      ? args.args.join(' ')
      : '';
  if (command === 'gh_run' && argv.includes('collaborators')) {
    return { stdout: COLLABORATORS, stderr: '', exitCode: 0 };
  }
  return new Promise<never>(() => undefined);
};

type StoreState = ReturnType<StoryStore['getState']>;

type Stubs = {
  readonly editPr: ReturnType<typeof vi.fn<StoreState['editPr']>>;
  readonly requestReview: ReturnType<typeof vi.fn<StoreState['requestReview']>>;
};

let stubs: Stubs;

beforeEach(async () => {
  await resetStoryStore();
  behindMain = 0;
  vi.mocked(invoke).mockImplementation(answer);
  stubs = {
    editPr: vi.fn<StoreState['editPr']>(async () => undefined),
    requestReview: vi.fn<StoreState['requestReview']>(async () => undefined),
  };
  useAppStore.setState(stubs);
});

afterEach(cleanup);

const show = async ({ variant = 'github' }: { readonly variant?: PrPageVariant } = {}) => {
  render(
    <ToastProvider>
      <PrPageScene variant={variant} />
    </ToastProvider>,
  );
  await screen.findByRole('region', { name: 'Description' });
  useAppStore.setState(stubs);
};

const description = (): HTMLElement => screen.getByRole('region', { name: 'Description' });

const startEditing = (): void => {
  fireEvent.click(within(description()).getByRole('button', { name: 'Edit' }));
};

const typeBody = (value: string): void => {
  fireEvent.change(screen.getByRole('textbox', { name: 'Description, markdown' }), {
    target: { value },
  });
};

describe('the description', () => {
  it('swaps the rendered text for the editor on Edit and saves to the host', async () => {
    await show();

    startEditing();
    typeBody('Retried deliveries no longer post a second credit.');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(stubs.editPr).toHaveBeenCalledTimes(1));
    expect(stubs.editPr).toHaveBeenCalledWith(SESSION.id, 318, {
      body: 'Retried deliveries no longer post a second credit.',
      isQuiet: true,
      mountId: useAppStore.getState().sessionProjectMounts[SESSION.id]?.[0]?.mountId,
    });
    expect(await screen.findByText('Saved to GitHub')).toBeDefined();
    expect(screen.queryByRole('textbox', { name: 'Description, markdown' })).toBeNull();
  });

  it('closes the editor when the session moves to the same number in another repository', async () => {
    await show();
    startEditing();
    typeBody('Half written.');
    expect(screen.getByRole('textbox', { name: 'Description, markdown' })).toBeDefined();

    const [first] = useAppStore.getState().sessionProjectMounts[SESSION.id] ?? [];
    if (first === undefined) {
      throw new Error('the scene seeds a mount');
    }
    const other = { ...first, mountId: 'mount-notify-relay' as typeof first.mountId };
    act(() => {
      useAppStore.setState({
        sessionProjectMounts: { [SESSION.id]: [first, other] },
        sessionActiveMount: { [SESSION.id]: other.mountId },
      });
    });

    await waitFor(() =>
      expect(screen.queryByRole('textbox', { name: 'Description, markdown' })).toBeNull(),
    );
  });

  it('shows the edit in the activity once it is saved', async () => {
    await show();

    startEditing();
    typeBody('A new description.');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    const activity = screen.getByRole('region', { name: 'Activity' });
    expect(await within(activity).findByText(/edited the description/)).toBeDefined();
  });

  it('previews the markdown before saving', async () => {
    await show();

    startEditing();
    typeBody('Retries stay at **three**.');
    fireEvent.click(screen.getByRole('tab', { name: 'Preview' }));

    expect(screen.queryByRole('textbox', { name: 'Description, markdown' })).toBeNull();
    expect(within(description()).getByText('three').tagName).toBe('STRONG');
    fireEvent.click(screen.getByRole('tab', { name: 'Write' }));
    expect(screen.getByRole('textbox', { name: 'Description, markdown' })).toBeDefined();
  });

  it('cancels with the button or Escape and writes nothing', async () => {
    await show();

    startEditing();
    typeBody('Half a thought');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('textbox', { name: 'Description, markdown' })).toBeNull();

    startEditing();
    expect(
      (screen.getByRole('textbox', { name: 'Description, markdown' }) as HTMLTextAreaElement).value,
    ).toContain('Retried webhooks posted a second credit');
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(screen.queryByRole('textbox', { name: 'Description, markdown' })).toBeNull();
    expect(stubs.editPr).not.toHaveBeenCalled();
  });

  it('keeps the draft and offers Retry when the host refuses', async () => {
    stubs.editPr.mockRejectedValueOnce(new Error('Resource not accessible by integration'));
    await show();

    startEditing();
    typeBody('Keep this draft');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain("Couldn't save the description");
    expect(alert.textContent).toContain('Resource not accessible by integration');
    expect(
      (screen.getByRole('textbox', { name: 'Description, markdown' }) as HTMLTextAreaElement).value,
    ).toBe('Keep this draft');

    fireEvent.click(within(alert).getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(stubs.editPr).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.queryByRole('textbox', { name: 'Description, markdown' })).toBeNull(),
    );
  });

  it('says there is no description and offers to add one', async () => {
    await show();
    act(() => {
      useAppStore.setState((state) => ({
        sessionGithub: {
          ...state.sessionGithub,
          [SESSION.id]: {
            ...state.sessionGithub[SESSION.id]!,
            pr: { ...state.sessionGithub[SESSION.id]!.pr!, body: '' },
          },
        },
      }));
    });

    expect(within(description()).getByText('No description yet')).toBeDefined();
    fireEvent.click(within(description()).getByRole('button', { name: 'Add description' }));
    expect(screen.getByRole('textbox', { name: 'Description, markdown' })).toBeDefined();
  });

  it('shows no edit affordance on a pull request that is not yours', async () => {
    useAppStore.setState({
      githubStatus: {
        available: true,
        mode: 'pat',
        user: 'someone-else',
        scopes: [],
        scoped: true,
      },
    });
    await show();

    expect(within(description()).queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Stop retried webhooks/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Request review' })).toBeNull();
    fireEvent.click(within(description()).getByText(/guard keyed on the delivery id/));
    expect(screen.queryByRole('textbox', { name: 'Description, markdown' })).toBeNull();
  });
});

describe('the branch row', () => {
  it('says how far behind the base the branch is and offers the rebase', async () => {
    behindMain = 3;
    await show();

    const row = (await screen.findByText('3 behind main')).parentElement as HTMLElement;
    expect(within(row).getByRole('button', { name: 'Rebase on main' })).toBeDefined();
  });

  it('says nothing about the distance when the pull request targets another base than the one measured', async () => {
    behindMain = 3;
    await show();
    const row = (await screen.findByText('3 behind main')).parentElement as HTMLElement;
    const [first] = useAppStore.getState().sessionProjectMounts[SESSION.id] ?? [];
    if (first === undefined) {
      throw new Error('the scene seeds a mount');
    }
    act(() => {
      useAppStore.setState({
        sessionProjectMounts: { [SESSION.id]: [{ ...first, baseBranch: 'release' }] },
      });
    });

    await waitFor(() => expect(screen.queryByText('3 behind main')).toBeNull());
    expect(row.isConnected).toBe(false);
  });
});

describe('the reviewers', () => {
  it('lists the collaborators who do not review yet and requests the one picked', async () => {
    await show();

    fireEvent.click(screen.getByRole('button', { name: 'Request review' }));

    fireEvent.click(await screen.findByText('rio-k'));
    expect(stubs.requestReview).toHaveBeenCalledWith(SESSION.id, 318, ['rio-k']);
  });

  it('leaves out the people already in the list', async () => {
    await show();

    fireEvent.click(screen.getByRole('button', { name: 'Request review' }));
    await screen.findByText('rio-k');

    const popup = document.querySelector('[data-dropdown-portal]') as HTMLElement;
    expect(within(popup).queryByText('omar-t')).toBeNull();
    expect(within(popup).queryByText('kenji-w')).toBeNull();
  });
});

describe('the keys', () => {
  it('opens the title editor on E, never the comment editor', async () => {
    await show();

    fireEvent.keyDown(window, { code: 'KeyE', key: 'e' });

    expect(screen.getByRole('textbox', { name: 'Pull request title' })).toBeDefined();
  });

  it('leaves the title alone on E while Comments is the tab', async () => {
    await show();
    fireEvent.click(screen.getByRole('tab', { name: /^Comments/ }));

    fireEvent.keyDown(window, { code: 'KeyE', key: 'e' });

    expect(screen.queryByRole('textbox', { name: 'Pull request title' })).toBeNull();
  });
});

describe('the draft and merged pull requests', () => {
  it('opens a draft with Ready for review as the one primary', async () => {
    await show({ variant: 'draft' });

    expect(document.querySelectorAll('[data-branch-primary]')).toHaveLength(1);
    expect(document.querySelector('[data-branch-primary="pullRequest.markReady"]')).not.toBeNull();
  });

  it('shows a merged pull request without edit or request controls', async () => {
    await show({ variant: 'merged' });

    expect(within(description()).queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Request review' })).toBeNull();
  });
});
