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
import { brandId, type MountId, type PullRequestState } from '@goodboy/types';
import { ToastProvider } from '../../../../shared/components/Toast';
import { applyMountGithub } from '../../../../store/slices/github/mountGithub';
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

const COMMIT_PATCH = [
  'diff --git a/src/retry.ts b/src/retry.ts',
  'index 1111111..2222222 100644',
  '--- a/src/retry.ts',
  '+++ b/src/retry.ts',
  '@@ -1,1 +1,1 @@',
  '-const retries = 3;',
  '+const retries = 5;',
  '',
].join('\n');

const answer = async (command: string, args: unknown): Promise<unknown> => {
  if (command === 'worktree_diff_commit') {
    return COMMIT_PATCH;
  }
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

type PatchParams = {
  readonly patch: (pr: PullRequestState) => PullRequestState;
};

const patchShownPr = ({ patch }: PatchParams): void => {
  useAppStore.setState((state) => {
    const mountId = state.sessionProjectMounts[SESSION.id]?.[0]?.mountId;
    const current = mountId === undefined ? undefined : state.mountGithub[mountId];
    if (mountId === undefined || current === undefined || current.pr === null) {
      return state;
    }
    return applyMountGithub({
      state,
      sessionId: SESSION.id,
      mountId,
      github: { ...current, pr: patch(current.pr) },
    });
  });
};

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

const shownMountOf = () => {
  const mount = useAppStore.getState().sessionProjectMounts[SESSION.id]?.[0];
  if (mount === undefined) {
    throw new Error('the scene seeds one mount');
  }
  return mount;
};

const collaboratorSearchRoots = (): ReadonlyArray<string> => {
  const roots = new Set<string>();
  for (const [command, args] of vi.mocked(invoke).mock.calls) {
    if (command !== 'gh_run' || typeof args !== 'object' || args === null) {
      continue;
    }
    const isSearch =
      'args' in args && Array.isArray(args.args) && args.args.join(' ').includes('collaborators');
    if (isSearch && 'cwd' in args && typeof args.cwd === 'string') {
      roots.add(args.cwd);
    }
  }
  return [...roots];
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
    screen.getByRole('textbox', { name: 'Description, markdown' });

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
    screen.getByRole('textbox', { name: 'Description, markdown' });
  });

  it('reads body headings as bold lead-ins under the one Description heading', async () => {
    await show();
    act(() => {
      patchShownPr({
        patch: (pr) => ({
          ...pr,
          body: '## Description\n\nSplits the route.\n\n## Scope\nThe guard.',
        }),
      });
    });

    await waitFor(() => expect(within(description()).getByText('Scope').tagName).toBe('STRONG'));
    expect(within(description()).getAllByRole('heading')).toHaveLength(1);
    within(description()).getByText('Splits the route.');
  });

  it('keeps the source headings in the edit preview', async () => {
    await show();

    startEditing();
    typeBody('## Scope\nThe guard.');
    fireEvent.click(screen.getByRole('tab', { name: 'Preview' }));

    within(description()).getByRole('heading', { name: 'Scope' });
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
      patchShownPr({ patch: (pr) => ({ ...pr, body: '' }) });
    });

    within(description()).getByText('No description yet');
    fireEvent.click(within(description()).getByRole('button', { name: 'Add description' }));
    screen.getByRole('textbox', { name: 'Description, markdown' });
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

describe('the reviewers', () => {
  it('lists the collaborators who do not review yet and requests the one picked', async () => {
    await show();

    fireEvent.click(screen.getByRole('button', { name: 'Request review' }));

    fireEvent.click(await screen.findByText('rio-k'));
    expect(stubs.requestReview).toHaveBeenCalledWith(SESSION.id, 318, ['rio-k'], {
      mountId: shownMountOf().mountId,
    });
  });

  it('searches and asks in the repository on screen while another one takes the writes', async () => {
    await show();
    const shown = shownMountOf();
    act(() =>
      useAppStore.setState({
        sessionProjectMounts: {
          [SESSION.id]: [
            shown,
            {
              ...shown,
              mountId: brandId<MountId>({ value: 'mock-u23-mount-ledger-core' }),
              repoRoot: '~/code/harborline/ledger-core',
              worktreePath: '~/code/harborline/ledger-core-main',
              lastWorktreePath: '~/code/harborline/ledger-core-main',
              branch: 'hl/ledger-core-main',
              parallelIndex: 1,
            },
          ],
        },
        sessionActiveMount: {
          [SESSION.id]: brandId<MountId>({ value: 'mock-u23-mount-ledger-core' }),
        },
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Request review' }));
    fireEvent.click(await screen.findByText('rio-k'));

    expect(stubs.requestReview).toHaveBeenCalledWith(SESSION.id, 318, ['rio-k'], {
      mountId: shown.mountId,
    });
    expect(collaboratorSearchRoots()).toEqual(['~/code/harborline/payments-api']);
  });

  it('says why the request failed and keeps the list as it was', async () => {
    await show();
    stubs.requestReview.mockRejectedValueOnce(new Error('Resource not accessible'));
    useAppStore.setState(stubs);

    fireEvent.click(screen.getByRole('button', { name: 'Request review' }));
    fireEvent.click(await screen.findByText('rio-k'));

    const reviewers = await screen.findByRole('region', { name: 'Reviewers' });
    expect(await within(reviewers).findByText(/Resource not accessible/)).toBeDefined();
    expect(within(reviewers).queryByText('rio-k')).toBeNull();
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

    screen.getByRole('textbox', { name: 'Pull request title' });
  });

  it('leaves the title alone on E while Comments is the section', async () => {
    await show();
    act(() => {
      useAppStore.setState((state) => ({
        branchTab: { ...state.branchTab, [SESSION.id]: 'comments' },
      }));
    });

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

type BotReviewParams = {
  readonly author: string;
  readonly minute: number;
};

describe('the Overview grid', () => {
  const grid = (): HTMLElement => {
    const element = document.querySelector<HTMLElement>('[data-slot="overview-grid"]');
    if (element === null) {
      throw new Error('the Overview has no grid');
    }
    return element;
  };

  it.each(['github', 'draft', 'merged'] as const)(
    'puts the status strip on top, then the reading column and the side column in the %s state',
    async (variant) => {
      await show({ variant });

      const children = [...grid().children];
      expect(children[0]).toBe(screen.getByRole('group', { name: 'Status' }));
      const columns = children.find((child) => child.getAttribute('data-slot') === 'page-columns');
      expect(children.at(-1)).toBe(columns);
      const reading = columns?.querySelector('[data-slot="reading-column"]');
      expect(reading?.contains(description())).toBe(true);
      const side = screen.getByRole('group', { name: 'Properties' });
      expect(columns?.getAttribute('data-slot')).toBe('page-columns');
      expect(columns?.contains(side)).toBe(true);
      expect(side.getAttribute('data-slot')).toBe('side-column');
      expect(side.compareDocumentPosition(description()) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      );
    },
  );

  it('keeps Reviewers, Author and Linked issues on the side, with no State, Base, Checks or Readiness', async () => {
    await show();

    const properties = screen.getByRole('group', { name: 'Properties' });
    const names = [...properties.querySelectorAll('section')].map((field) =>
      field.getAttribute('aria-label'),
    );
    expect(names).toContain('Reviewers');
    expect(names).toContain('Author');
    for (const name of ['State', 'Base', 'Checks', 'Readiness']) {
      expect(names).not.toContain(name);
    }
    expect(within(properties).queryByRole('button', { name: /Rebase/ })).toBeNull();
  });

  it('folds the bots that commented in a row into one activity event on the spine', async () => {
    await show();
    act(() => {
      useAppStore.setState((state) => {
        const mountId = state.sessionProjectMounts[SESSION.id]?.[0]?.mountId;
        const current = mountId === undefined ? undefined : state.mountGithub[mountId];
        if (mountId === undefined || current === undefined || current.detail === null) {
          return state;
        }
        const botReview = ({ author, minute }: BotReviewParams) => ({
          id: `review-${author}`,
          author,
          authorAvatarUrl: null,
          state: 'commented' as const,
          submittedAt: `2026-09-27T10:0${minute}:00Z`,
          body: `${author} has a note.`,
        });
        return applyMountGithub({
          state,
          sessionId: SESSION.id,
          mountId,
          github: {
            ...current,
            detail: {
              ...current.detail,
              reviews: [
                ...current.detail.reviews,
                botReview({ author: 'portal-preview[bot]', minute: 1 }),
                botReview({ author: 'size-watch[bot]', minute: 2 }),
              ],
            },
          },
        });
      });
    });

    const activity = screen.getByRole('region', { name: 'Activity' });
    const group = await within(activity).findByText('2 bots commented');
    const row = group.closest('[data-activity]');
    expect(row?.getAttribute('data-activity')).toBe('bots');
    expect(row?.textContent).toContain('portal-preview[bot]');
    const rows = activity.querySelectorAll('[data-activity]');
    expect(activity.querySelectorAll('[data-slot="activity-spine"]')).toHaveLength(rows.length - 1);
  });

  it('puts the asked reviewer first with the verdict beside the name, and the bots apart', async () => {
    await show();
    act(() => {
      useAppStore.setState((state) => {
        const mountId = state.sessionProjectMounts[SESSION.id]?.[0]?.mountId;
        const current = mountId === undefined ? undefined : state.mountGithub[mountId];
        if (mountId === undefined || current === undefined || current.detail === null) {
          return state;
        }
        const bot = {
          id: 'review-bot',
          author: 'portal-preview[bot]',
          authorAvatarUrl: null,
          state: 'commented' as const,
          submittedAt: '2026-10-01T10:00:00Z',
          body: 'Preview deploy ready.',
        };
        return applyMountGithub({
          state,
          sessionId: SESSION.id,
          mountId,
          github: {
            ...current,
            detail: { ...current.detail, reviews: [...current.detail.reviews, bot] },
          },
        });
      });
    });

    const reviewers = await screen.findByRole('region', { name: 'Reviewers' });
    const rows = within(reviewers).getAllByRole('listitem');
    expect(rows[0]?.getAttribute('data-reviewer-state')).toBe('pending');
    expect(rows[0]?.textContent).toContain('Asked');
    expect(within(reviewers).queryByText('portal-preview[bot]')).toBeNull();
    const bots = screen.getByRole('region', { name: 'Bots that commented' });
    within(bots).getByText('portal-preview[bot]');
    expect(within(bots).queryByText('Commented')).toBeNull();
  });

  it('says the queue of a queued pull request in the Merge cell', async () => {
    await show();
    act(() => {
      patchShownPr({
        patch: (pr) => ({ ...pr, state: 'queued', isDraft: false, mergeQueue: { position: 3 } }),
      });
    });

    await waitFor(() =>
      expect(document.querySelector('[data-cell="merge"]')?.textContent).toContain(
        'Queued to merge, 3rd in line',
      ),
    );
  });

  it('opens the Checks section from the Checks cell of the strip', async () => {
    await show();
    useAppStore.setState({ branchTab: { [SESSION.id]: 'pr' } });

    const strip = screen.getByRole('group', { name: 'Status' });
    const checks = within(strip).getByRole('button', { name: /^Checks:/ });
    expect(checks.textContent).toMatch(/passed|failing|Running|No checks|Unknown/);
    fireEvent.click(checks);

    await waitFor(() => expect(useAppStore.getState().branchTab[SESSION.id]).toBe('checks'));
  });

  it('names the state, the number and the base once, in the line under the title', async () => {
    await show();

    const line = document.querySelector<HTMLElement>('[data-pr-header-line]');
    expect(line?.textContent).toContain('#318');
    expect(line?.textContent).toContain('main');
    expect(screen.queryByRole('region', { name: 'Base' })).toBeNull();
  });
});

describe('the Changes summary', () => {
  it('keeps the changes of the branch while the Files tab shows one commit', async () => {
    await show();
    const card = await screen.findByRole('button', { name: 'Open Changes' });
    const branchSummary = card.textContent;
    expect(branchSummary).toContain('6files');

    act(() => {
      useAppStore
        .getState()
        .setDiffFocus(SESSION.id, { kind: 'commit', sha: 'abc1234', path: null });
    });
    await waitFor(() =>
      expect(vi.mocked(invoke).mock.calls.map(([command]) => command)).toContain(
        'worktree_diff_commit',
      ),
    );
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByRole('button', { name: 'Open Changes' }).textContent).toBe(branchSummary);
  });
});
