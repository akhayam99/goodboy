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

  it('reads body headings as bold lead-ins, with no heading of its own in the card', async () => {
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
    expect(within(description()).queryAllByRole('heading')).toHaveLength(0);
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
    'puts the merge box above the description in the reading column, beside the rail, in the %s state',
    async (variant) => {
      await show({ variant });

      const children = [...grid().children];
      expect(children).toHaveLength(2);
      const reading = children.find(
        (child) => child.getAttribute('data-slot') === 'reading-column',
      );
      expect(reading?.firstElementChild).toBe(screen.getByRole('region', { name: 'Merge status' }));
      expect(reading?.contains(description())).toBe(true);
      const side = screen.getByRole('group', { name: 'Properties' });
      expect(children[0]?.contains(side)).toBe(true);
      expect(side.getAttribute('data-slot')).toBe('side-column');
      expect(side.compareDocumentPosition(description()) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      );
    },
  );

  it('keeps Reviewers, Checks, People and Linked issues on the side in one style, with no State, Base, Author or Readiness', async () => {
    await show();

    const properties = screen.getByRole('group', { name: 'Properties' });
    const names = [...properties.querySelectorAll(':scope > section')].map((field) =>
      field.getAttribute('aria-label'),
    );
    expect(names[0]).toBe('Reviewers');
    expect(names).toContain('People');
    expect(names.at(-1)).toBe('Linked issues');
    for (const name of ['State', 'Base', 'Author', 'Bots', 'Readiness']) {
      expect(names).not.toContain(name);
    }
    expect(within(properties).queryByRole('button', { name: /Rebase/ })).toBeNull();
  });

  it('gives each bot one activity row on the spine and filters the activity by who acted', async () => {
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
    await waitFor(() => expect(activity.querySelectorAll('[data-activity="bot"]')).toHaveLength(3));
    const botRows = [...activity.querySelectorAll('[data-activity="bot"]')];
    expect(botRows[0]?.textContent).toContain('portal-preview[bot]');
    expect(botRows[1]?.textContent).toContain('size-watch[bot]');
    expect(botRows[2]?.textContent).toContain('acme-review');
    expect(within(activity).queryByText(/bots commented/)).toBeNull();
    const rows = activity.querySelectorAll('[data-activity]');
    expect(rows.length).toBeGreaterThan(3);
    expect(activity.querySelectorAll('[data-slot="activity-spine"]')).toHaveLength(1);

    const filter = within(activity).getByRole('tablist', { name: 'Activity filter' });
    within(filter).getByRole('tab', { name: /Bots/ });
    fireEvent.click(within(filter).getByRole('tab', { name: /Bots/ }));
    const kinds = [...activity.querySelectorAll('[data-activity]')].map((row) =>
      row.getAttribute('data-activity'),
    );
    expect(kinds).toEqual(['bot', 'bot', 'bot']);
    fireEvent.click(within(filter).getByRole('tab', { name: /All/ }));
    expect(activity.querySelectorAll('[data-activity]').length).toBeGreaterThan(3);
  });

  it('keeps the activity filter of a pull request across a visit to Comments', async () => {
    await show();

    const chooseBots = (): void => {
      const activity = screen.getByRole('region', { name: 'Activity' });
      const filter = within(activity).getByRole('tablist', { name: 'Activity filter' });
      fireEvent.click(within(filter).getByRole('tab', { name: /Bots/ }));
    };
    const selectedFilterOf = (): string | undefined => {
      const activity = screen.getByRole('region', { name: 'Activity' });
      const filter = within(activity).getByRole('tablist', { name: 'Activity filter' });
      return (
        within(filter)
          .getAllByRole('tab')
          .find((tab) => tab.getAttribute('aria-selected') === 'true')?.textContent ?? undefined
      );
    };
    chooseBots();
    expect(selectedFilterOf()).toMatch(/Bots/);

    act(() => {
      useAppStore.setState((state) => ({
        branchTab: { ...state.branchTab, [SESSION.id]: 'comments' },
      }));
    });
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Activity' })).toBeNull());
    act(() => {
      useAppStore.setState((state) => ({
        branchTab: { ...state.branchTab, [SESSION.id]: 'pr' },
      }));
    });

    await screen.findByRole('region', { name: 'Activity' });
    expect(selectedFilterOf()).toMatch(/Bots/);
  });

  it('folds a bot summary behind Show summary', async () => {
    await show();
    act(() => {
      useAppStore.setState((state) => {
        const mountId = state.sessionProjectMounts[SESSION.id]?.[0]?.mountId;
        const current = mountId === undefined ? undefined : state.mountGithub[mountId];
        if (mountId === undefined || current === undefined || current.detail === null) {
          return state;
        }
        const botReview = {
          id: 'review-northwind-scan',
          author: 'northwind-scan',
          authorAvatarUrl: null,
          isAuthorBot: true,
          state: 'commented' as const,
          submittedAt: '2026-09-27T10:01:00Z',
          body: 'Dependency audit clean across 9 packages.',
        };
        return applyMountGithub({
          state,
          sessionId: SESSION.id,
          mountId,
          github: {
            ...current,
            detail: { ...current.detail, reviews: [...current.detail.reviews, botReview] },
          },
        });
      });
    });

    const activity = screen.getByRole('region', { name: 'Activity' });
    const who = await within(activity).findByText('northwind-scan');
    const row = within(who.closest<HTMLElement>('[data-activity]') ?? activity);
    expect(row.queryByText(/Dependency audit clean/)).toBeNull();
    fireEvent.click(row.getByRole('button', { name: 'Show summary' }));
    row.getByText(/Dependency audit clean/);
    row.getByRole('button', { name: 'Hide summary' });
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
    expect(rows[0]?.textContent).toContain('Not yet reviewed');
    expect(within(reviewers).queryByText('portal-preview[bot]')).toBeNull();
    const people = screen.getByRole('region', { name: 'People' });
    const portal = within(people).getByText('portal-preview[bot]').closest('li');
    expect(portal?.textContent).toBe('portal-preview[bot]Bot · 1 comment');
    expect(within(people).getByText('acme-review').closest('li')?.textContent).toMatch(
      /^acme-reviewBot( · \d+ comments?)?$/,
    );
  });

  it('keeps Nobody asked yet when only a commenting bot is on a review-required pull request', async () => {
    await show();
    act(() => {
      useAppStore.setState((state) => {
        const mountId = state.sessionProjectMounts[SESSION.id]?.[0]?.mountId;
        const current = mountId === undefined ? undefined : state.mountGithub[mountId];
        if (
          mountId === undefined ||
          current === undefined ||
          current.pr === null ||
          current.detail === null
        ) {
          return state;
        }
        const bot = {
          id: 'review-bot',
          author: 'acme-review',
          authorAvatarUrl: null,
          state: 'commented' as const,
          submittedAt: '2026-10-01T10:00:00Z',
          body: 'No issues in 4 areas.',
          isAuthorBot: true,
        };
        return applyMountGithub({
          state,
          sessionId: SESSION.id,
          mountId,
          github: {
            ...current,
            pr: { ...current.pr, reviewDecision: 'review_required' },
            detail: { ...current.detail, reviews: [bot], reviewRequests: [] },
          },
        });
      });
    });

    await waitFor(() => {
      const box = screen.getByRole('region', { name: 'Merge status' });
      expect(box.textContent).toContain('No approval yet');
      expect(box.textContent).toContain('Nobody asked yet');
    });
  });

  it('says the queue of a queued pull request in the merge box', async () => {
    await show();
    act(() => {
      patchShownPr({
        patch: (pr) => ({ ...pr, state: 'queued', isDraft: false, mergeQueue: { position: 3 } }),
      });
    });

    await waitFor(() => {
      const box = screen.getByRole('region', { name: 'Merge status' });
      expect(box.querySelector('[data-verdict]')?.getAttribute('data-verdict')).toBe('queued');
      expect(box.textContent).toContain('Queued to merge, 3rd in line');
    });
  });

  it('opens the place that fixes a row of the merge box, and repeats no merge button', async () => {
    await show();
    useAppStore.setState({ branchTab: { [SESSION.id]: 'pr' } });

    const box = screen.getByRole('region', { name: 'Merge status' });
    expect(within(box).queryByRole('button', { name: /merge/i })).toBeNull();
    expect(box.querySelector('[data-verdict]')?.textContent).toContain('Not ready to merge');
    const first = within(box).getAllByRole('listitem')[0];
    const checks = within(first ?? box).getByRole('button', { name: /check.* failing/ });
    expect(checks.textContent).toContain('Checks');
    fireEvent.click(checks);

    await waitFor(() => expect(useAppStore.getState().branchTab[SESSION.id]).toBe('checks'));
  });

  it('folds a long description after 320 pixels and opens it in place', async () => {
    const tall = vi.spyOn(Element.prototype, 'scrollHeight', 'get').mockReturnValue(400);
    const short = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(120);
    try {
      await show();

      const toggle = await within(description()).findByRole('button', {
        name: 'Show the full description',
      });
      expect(description().querySelector('[data-folded="true"]')).not.toBeNull();
      fireEvent.click(toggle);

      const less = within(description()).getByRole('button', { name: 'Show less' });
      expect(less.getAttribute('aria-expanded')).toBe('true');
      expect(description().querySelector('[data-folded]')).toBeNull();
    } finally {
      tall.mockRestore();
      short.mockRestore();
    }
  });

  it('keeps a short description whole, with nothing to unfold', async () => {
    await show();

    expect(
      within(description()).queryByRole('button', { name: 'Show the full description' }),
    ).toBeNull();
  });

  it('names the state, the number and the base once, in the line under the title', async () => {
    await show();

    const line = document.querySelector<HTMLElement>('[data-pr-header-line]');
    expect(line?.textContent).toContain('#318');
    expect(line?.textContent).toContain('main');
    expect(screen.queryByRole('region', { name: 'Base' })).toBeNull();
  });
});
