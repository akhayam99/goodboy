// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { AUTO_BLOCK_TEXT } from '@goodboy/core/auto';
import { startRunEventName } from '../../../../../features/session/startRun/startRunEventName';
import { installFakeResizeObserver } from '../../../../../test/fakeResizeObserver';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import {
  registerAutoUserTurnPort,
  type AutoUserTurnPort,
} from '../../../../../features/auto/autoUserTurnPort';
import {
  registerTreeRetryPort,
  type TreeRetryPort,
} from '../../../../../features/auto/treeRetryPort';
import { MOCK_SCENES } from '../..';
import { U25_C07_AUTO_SCENES } from './c07-auto';

const WAIT = { timeout: 15_000 };

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  registerTreeRetryPort({ port: null });
});

type MountParams = {
  readonly id: keyof typeof U25_C07_AUTO_SCENES;
};

const mount = ({ id }: MountParams): void => {
  const Scene = U25_C07_AUTO_SCENES[id];
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

const sessionHead = (): HTMLElement => {
  const head = document.querySelector<HTMLElement>('[data-session-head]');
  if (head === null) {
    throw new Error('no session head');
  }
  return head;
};

const pageCrumb = async (): Promise<HTMLElement> => {
  await screen.findByRole('button', { name: 'More agent actions' }, WAIT);
  const crumb = sessionHead().querySelector<HTMLElement>('[data-crumb-current]');
  if (crumb === null) {
    throw new Error('no page crumb');
  }
  return crumb;
};

const crumbLabels = (): ReadonlyArray<string> =>
  [...document.querySelectorAll('[data-session-crumbs] li')].map(
    (crumb) => crumb.textContent ?? '',
  );

const homeLens = (): string | null => {
  const state = useAppStore.getState();
  const sessionId = state.currentSessionId;
  return sessionId === null ? null : (state.activeLens[sessionId] ?? null);
};

describe('c07 Auto scenes', () => {
  it('registers every scene for the capture', () => {
    for (const [id, Scene] of Object.entries(U25_C07_AUTO_SCENES)) {
      expect(MOCK_SCENES[id]).toBe(Scene);
    }
  });

  it('c07-auto-working keeps the page tabs on the session and the limit on the page', async () => {
    mount({ id: 'c07-auto-working' });

    await pageCrumb();
    expect(homeLens()).toBe('workflows');
    expect(sessionHead().getAttribute('data-head-nav')).toBe('crumbs');
    expect(screen.getByRole('button', { name: /^Limit: \$10\.00/ })).toBeDefined();
  });

  it('u34-p20-auto-narrow keeps the title in the last crumb, the glance beside it and no provider mark', async () => {
    mount({ id: 'u34-p20-auto-narrow' });

    const crumb = await pageCrumb();
    const head = sessionHead();
    expect(within(crumb).queryByTestId('agent-header-settings')).toBeNull();
    expect(document.querySelector('[data-glance]')).not.toBeNull();
    expect(within(crumb).queryByRole('button', { name: 'More agent actions' })).toBeNull();
    expect(within(head).getByRole('button', { name: 'More agent actions' })).toBeDefined();
    expect(within(head).queryByTestId('agent-header-provider')).toBeNull();
  });

  it('c07-auto-working shows one glance line and Settings opens the same chips inline', async () => {
    mount({ id: 'c07-auto-working' });

    await waitFor(() => expect(document.querySelector('[data-glance]')).not.toBeNull(), WAIT);
    const glance = document.querySelector<HTMLElement>('[data-glance]');
    if (glance === null) {
      throw new Error('no glance line');
    }
    expect(glance.dataset.glance).toBe('running');
    expect(within(glance).getByRole('status').textContent).not.toContain('running');
    expect(glance.textContent).not.toContain('Implementer');
    expect(document.querySelector('[data-dock-live]')?.textContent).toContain('Implementer');
    expect(screen.queryByRole('group', { name: 'Working now' })).toBeNull();
    expect(within(glance).queryByRole('button', { name: 'Run settings' })).toBeNull();
    const facts = within(glance).getByRole('group', { name: 'Run settings' });
    const limit = within(facts).getByRole('button', { name: /^Limit: / });
    expect(limit.getAttribute('data-variant')).toBe('fact');

    fireEvent.click(limit);

    expect(limit.getAttribute('aria-expanded')).toBe('true');
  });

  it('c07-auto-working keeps the center lean: no role chip, live cards for running children, one tail', async () => {
    mount({ id: 'c07-auto-working' });

    await screen.findAllByRole('list', { name: 'Delegations' }, WAIT);
    const heading = await pageCrumb();
    expect(within(heading).queryByText('Auto agent')).toBeNull();
    expect(within(heading).queryByText('Experimental')).toBeNull();
    expect(screen.queryByRole('article')).toBeNull();
    expect(screen.queryByText('Delegated to')).toBeNull();
    expect(document.querySelectorAll('[data-auto-child-card]').length).toBeGreaterThan(0);
    const dock = document.querySelector<HTMLElement>('[data-dock-live]');
    expect(dock?.textContent).toContain('Implementer');
    expect(screen.queryByRole('button', { name: 'Mark finished' })).toBeNull();
  });

  it('c07-auto-substep groups each turn of agents in one soft card with a head and a state word', async () => {
    mount({ id: 'c07-auto-substep' });

    await screen.findAllByRole('list', { name: 'Delegations' }, WAIT);
    const cards = Array.from(document.querySelectorAll<HTMLElement>('[data-soft-card]'));
    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) {
      expect(card.querySelector('ul[aria-label="Delegations"]')).not.toBeNull();
      expect(card.textContent).toMatch(/Running|Done/);
    }
  });

  it('c07-auto-plan pins the plan ask in the dock with the approve label as the one primary', async () => {
    mount({ id: 'c07-auto-plan' });

    await screen.findByText('Plan v1 needs approval', undefined, WAIT);
    const dock = document.querySelector<HTMLElement>('[data-auto-dock]');
    if (dock === null) {
      throw new Error('no dock');
    }
    const approve = within(dock).getByRole('button', { name: 'Approve and start Build' });
    expect(within(dock).getByRole('button', { name: /^Open plan / }).textContent).toBe('Open plan');
    expect(within(dock).getByRole('button', { name: 'Ask for changes' })).toBeDefined();
    expect(screen.queryByText('View plan')).toBeNull();
    expect(screen.queryByText('Plan v1 needs your approval')).toBeNull();
    expect(approve).toBeDefined();
  });

  it('c07-auto-idle keeps Mark finished in the menu of the header', async () => {
    mount({ id: 'c07-auto-idle' });

    await pageCrumb();
    expect(screen.queryByRole('button', { name: 'Mark finished' })).toBeNull();
    fireEvent.click(within(sessionHead()).getByRole('button', { name: 'More agent actions' }));
    expect(await screen.findByRole('menuitem', { name: /Mark finished/ }, WAIT)).toBeDefined();
    expect(screen.getAllByRole('menuitem').length).toBeLessThanOrEqual(5);
  });

  it('c07-auto-child opens the Implementer on its page with its why, its tail and one box', async () => {
    mount({ id: 'c07-auto-child' });

    expect(
      await screen.findByText(/^Why the Lead chose Implementer:/, undefined, WAIT),
    ).toBeDefined();
    expect(
      screen.getByText('The Lead started this agent and reads your messages to it.'),
    ).toBeDefined();
    expect(screen.getByPlaceholderText('Message Implementer')).toBeDefined();
    expect(screen.queryByPlaceholderText('Message Lead')).toBeNull();
    expect(
      sessionHead().querySelector('[data-slot="pane-title-row"] [data-session-back]'),
    ).not.toBeNull();
    screen.getByRole('button', { name: /^Back to Why does the ledger retry post a second credit/ });
    expect(crumbLabels().at(-2)).toMatch(/^Why does the ledger retry post a second credit/);
    expect(screen.queryByText(/Reserved up to/)).toBeNull();
    expect(screen.queryByText('Implementer · Implementer')).toBeNull();
    expect(
      screen.getAllByText(/^Post one credit per retry in postCredit and applyCredit\.?$/).length,
    ).toBeGreaterThan(1);
  });

  it('a delegation line opens the child page', async () => {
    mount({ id: 'c07-auto-working' });

    const lists = await screen.findAllByRole('list', { name: 'Delegations' }, WAIT);
    const tester = lists
      .flatMap((list) => within(list).getAllByRole('listitem'))
      .find((line) => within(line).queryByRole('img', { name: 'Tester' }) !== null);
    if (tester === undefined) {
      throw new Error('no Tester line');
    }
    fireEvent.click(within(tester).getByRole('button', { name: /^Open / }));
    expect(await screen.findByPlaceholderText('Message Tester', undefined, WAIT)).toBeDefined();
    expect(screen.queryByRole('complementary', { name: /^Record of/ })).toBeNull();
  });

  it('keeps the session head with its crumbs on a child page', async () => {
    mount({ id: 'c07-auto-child' });

    await screen.findByPlaceholderText('Message Implementer', undefined, WAIT);
    expect(sessionHead().getAttribute('data-head-nav')).toBe('crumbs');
  });

  it('c07-auto-child-done shows what came back and says Returned to the Lead', async () => {
    mount({ id: 'c07-auto-child-done' });

    expect(await screen.findByText('Returned to the Lead', undefined, WAIT)).toBeDefined();
    expect(
      screen.getAllByText('Three tests added in payments-api, all pass.').length,
    ).toBeGreaterThan(0);
    expect(screen.getByText('1 file changed')).toBeDefined();
    expect(screen.getByText('Not checked: timed out')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Retry checks' })).toBeDefined();
  });

  it('c07-auto-child-push says the push did not go out and offers one more try', async () => {
    mount({ id: 'c07-auto-child-push' });

    expect(
      (await screen.findAllByText('Not pushed: connection reset', undefined, WAIT)).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Retry push' }).length).toBeGreaterThan(0);
  });

  it('c07-auto-project asks where the Implementer works and names the primary by the choice', async () => {
    mount({ id: 'c07-auto-project' });

    const ask = await screen.findByText('Where should the Implementer work?', undefined, WAIT);
    expect(ask).toBeDefined();
    expect(ask.closest('[data-conversation-dock]')).not.toBeNull();
    expect(screen.getByPlaceholderText('Pick a project, or write to Lead')).toBeDefined();
    const list = screen.getByRole('list', { name: 'Projects' });
    const boxes = within(list).getAllByRole('checkbox');
    expect(boxes.length).toBeGreaterThan(1);
    expect(screen.getByText('In this session')).toBeDefined();
    expect(screen.queryByText(/, in this session/)).toBeNull();
    const actions = list
      .closest('[data-dock-ask="project"]')
      ?.querySelector('[data-slot="form-actions"]');
    expect(actions?.textContent).toContain('Decline');
    expect(screen.getByRole('button', { name: 'Decline' }).getAttribute('data-variant')).toBe(
      'quiet',
    );
    expect(screen.queryByRole('button', { name: 'More request actions' })).toBeNull();
    const dock = ask.closest<HTMLElement>('[data-conversation-dock]');
    fireEvent.click(within(dock ?? list).getByRole('button', { name: 'Add project' }));
    expect(screen.getByRole('textbox', { name: 'Type a project name' })).toBeDefined();
    expect(list.compareDocumentPosition(actions ?? list) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(screen.getByRole('button', { name: 'Use this project' })).toHaveProperty(
      'disabled',
      true,
    );
    fireEvent.click(boxes[0] ?? list);
    expect(screen.getByRole('button', { name: /^Use / })).toHaveProperty('disabled', false);
    fireEvent.click(boxes[1] ?? list);
    expect(screen.getByRole('button', { name: 'Use both' })).toBeDefined();
  });

  it('Answer without a project tells Auto through its door and collapses the ask', async () => {
    const port = vi.fn<AutoUserTurnPort>(async () => 'queued');
    registerAutoUserTurnPort({ port });
    mount({ id: 'c07-auto-project' });

    fireEvent.click(await screen.findByRole('button', { name: 'Answer without a project' }, WAIT));

    expect(await screen.findByText('Answered without a project', undefined, WAIT)).toBeDefined();
    expect(port).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'No project, just answer in the chat.' }),
    );
    registerAutoUserTurnPort({ port: null });
  });

  it('c07-auto-images passes the screenshots on: the child brief names both', async () => {
    mount({ id: 'c07-auto-images' });

    const shots = await screen.findByRole('list', { name: 'Images the Lead passed on' }, WAIT);
    expect(within(shots).getByText('banner-wide.png')).toBeDefined();
    expect(within(shots).getByText('banner-narrow.png')).toBeDefined();
  });

  it('c07-auto-capped pauses at the limit with Raise to and Change limit in the dock', async () => {
    mount({ id: 'c07-auto-capped' });

    const tail = await waitFor(() => {
      const found = document.querySelector<HTMLElement>('[data-dock-line="paused"]');
      expect(found?.textContent).toContain('At the $10.00 limit.');
      return found;
    }, WAIT);
    if (tail === null || tail === undefined) {
      throw new Error('no tail');
    }
    expect(within(tail).getByRole('button', { name: 'Raise to $20.00' })).toBeDefined();
    fireEvent.click(within(tail).getByRole('button', { name: 'Change limit' }));
    expect(await screen.findByRole('dialog', { name: 'Limit' }, WAIT)).toBeDefined();
  });

  it('c07-auto-limit-popover lists spent, reserved and turns under one Limit title', async () => {
    mount({ id: 'c07-auto-limit-popover' });

    const popover = await screen.findByRole('dialog', { name: 'Limit' }, WAIT);
    expect(within(popover).getByText('Spent')).toBeDefined();
    expect(within(popover).getByText('Reserved')).toBeDefined();
    expect(within(popover).getByText('Turns')).toBeDefined();
    expect(within(popover).getByRole('form', { name: 'Limit for this Lead' })).toBeDefined();
  });

  it('c07-auto-working titles the Auto root with its goal and holds no Open transcript in the menu', async () => {
    mount({ id: 'c07-auto-working' });

    const crumb = await pageCrumb();
    const title = sessionHead();
    expect(within(crumb).queryByText(/^Auto$/)).toBeNull();
    expect(within(title).queryByRole('button', { name: 'Open transcript' })).toBeNull();
    fireEvent.click(within(title).getByRole('button', { name: 'More agent actions' }));
    await screen.findByRole('menu', undefined, WAIT);
    expect(screen.queryByRole('menuitem', { name: 'Open transcript' })).toBeNull();
  });

  it('c07-auto-session-level keeps the Auto chat in the center with the page tabs shown', async () => {
    mount({ id: 'c07-auto-session-level' });

    await waitFor(() => expect(sessionHead()).toBeDefined(), WAIT);
    expect(document.querySelector('[data-dock-live]')?.textContent).toContain('Implementer');
  });

  it('c07-auto-answering rests after Auto answered: no Deciding tail and no Stop', async () => {
    mount({ id: 'c07-auto-answering' });

    await pageCrumb();
    expect(screen.queryByText('Deciding what to do next')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Stop Auto and its agents' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Stop' })).toBeNull();
  });

  it('c07-auto-blocked says why Auto stopped and redelivers on Retry', async () => {
    const retry = vi.fn<TreeRetryPort>(async () => ({ kind: 'retried' }));
    registerTreeRetryPort({ port: retry });
    mount({ id: 'c07-auto-blocked' });

    const tail = await waitFor(() => {
      const found = document.querySelector<HTMLElement>('[data-dock-line="failed"]');
      expect(found?.textContent).toContain('Auto stopped answering before it replied.');
      return found;
    }, WAIT);
    if (tail === null || tail === undefined) {
      throw new Error('no tail');
    }
    fireEvent.click(within(tail).getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(retry).toHaveBeenCalledTimes(1), WAIT);
    expect(within(tail).queryByRole('alert')).toBeNull();
  });

  it('c07-auto-blocked offers Open transcript in the dock and opens the root conversation', async () => {
    mount({ id: 'c07-auto-blocked' });

    const verb = await screen.findByRole('button', { name: 'Open transcript' }, WAIT);
    expect(verb.closest('[data-conversation-dock]')).not.toBeNull();
    fireEvent.click(verb);

    expect(useAppStore.getState().drawer?.kind).toBe('transcript');
  });

  it('c07-auto-blocked shows a refused Retry in the dock, not in a notification', async () => {
    registerTreeRetryPort({
      port: async () => ({ kind: 'refused', message: AUTO_BLOCK_TEXT.budget }),
    });
    mount({ id: 'c07-auto-blocked' });

    const retry = await screen.findByRole('button', { name: 'Retry' }, WAIT);
    fireEvent.click(retry);

    const title = await screen.findByText("Couldn't retry the Lead", undefined, WAIT);
    const alert = title.closest('[role="alert"]');
    expect(alert?.closest('[data-conversation-dock]')).not.toBeNull();
    expect(alert?.textContent).toContain(AUTO_BLOCK_TEXT.budget);
  });

  it('c07-auto-stop-failed shows the failed Stop inline in the dock', async () => {
    mount({ id: 'c07-auto-stop-failed' });

    const title = await screen.findByText("Couldn't stop the run", undefined, WAIT);
    const alert = title.closest('[role="alert"]');
    expect(alert?.closest('[data-conversation-dock]')).not.toBeNull();
    expect(alert?.textContent).toContain('The Lead is still starting. Retry in a moment.');
  });

  it('c07-auto-list lists every Auto conversation on one grid and opens one', async () => {
    mount({ id: 'c07-auto-list' });

    const list = await screen.findByRole('list', { name: 'Runs' }, WAIT);
    expect(screen.queryByRole('textbox', { name: 'Describe the work' })).toBeNull();
    expect(screen.queryByText('No runs yet')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Start an auto' })).toBeNull();
    const rows = within(list).getAllByRole('button', { name: /, Lead, / });
    expect(rows).toHaveLength(2);
    expect(within(list).getByRole('button', { name: /, Lead, Resting$/ })).toBeDefined();
    expect(within(list).getByRole('button', { name: /, Lead, Finished$/ })).toBeDefined();
    expect(sessionHead()).toBeDefined();

    fireEvent.click(rows[0] ?? list);
    await waitFor(() => expect(document.querySelector('[data-auto-dock]')).not.toBeNull());
    expect(screen.queryByRole('region', { name: 'Agents' })).toBeNull();
    expect(sessionHead()).toBeDefined();
  });

  it('c07-auto-start starts Auto from the Start a run field on the Runs page, with no Auto form', async () => {
    mount({ id: 'c07-auto-start' });

    await screen.findByRole('list', { name: 'Runs' }, WAIT);
    expect(screen.queryByRole('button', { name: 'Start a run' })).toBeNull();
    const sessionId = useAppStore.getState().currentSessionId;
    act(() => {
      if (sessionId !== null) {
        window.dispatchEvent(new CustomEvent(startRunEventName({ sessionId })));
      }
    });
    expect(await screen.findByRole('textbox', { name: 'Start a run' }, WAIT)).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Start an auto' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Start an auto' })).toBeNull();
  });
});
