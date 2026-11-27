// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { invoke } from '@tauri-apps/api/core';
import { ToastProvider } from '../../../../../../shared/components/Toast';
import { UndoToastBridge } from '../../../../UndoToastBridge';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../../store/storyHarness';
import { useAppStore } from '../../../../../../store';
import { clearSceneInvoke } from '../../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../../..';
import { CALENDAR_PLACE_SCENES } from './place';

const WAIT = { timeout: 5_000 };

const THURSDAY_MORNING = new Date(2026, 10, 26, 10, 18);

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'], now: THURSDAY_MORNING });
  await resetStoryStore();
  vi.spyOn(document, 'hasFocus').mockImplementation(() => true);
});

afterEach(() => {
  cleanup();
  clearSceneInvoke();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

type SceneId = keyof typeof CALENDAR_PLACE_SCENES;

type MountParams = {
  readonly id: SceneId;
};

const mount = ({ id }: MountParams): void => {
  const Scene = CALENDAR_PLACE_SCENES[id];
  render(
    <ToastProvider>
      <UndoToastBridge />
      <Scene />
    </ToastProvider>,
  );
};

const today = async (): Promise<HTMLElement> => screen.findByRole('list', { name: 'Today' }, WAIT);

type RowParams = {
  readonly name: RegExp;
};

const row = async ({ name }: RowParams): Promise<HTMLElement> =>
  within(await today()).findByRole('button', { name }, WAIT);

const MERGE = 'Mark done: Merge payments-api #412';

type CheckParams = {
  readonly name: string;
};

const isChecked = ({ name }: CheckParams): boolean => {
  const box = screen.getByRole('checkbox', { name });
  return box instanceof HTMLInputElement && box.checked;
};

describe('the Calendar place scenes', () => {
  it('registers every scene for the capture', () => {
    expect(Object.keys(CALENDAR_PLACE_SCENES).sort()).toEqual([
      'calendar-busy',
      'calendar-day',
      'calendar-empty',
      'calendar-open',
      'calendar-quiet',
      'calendar-week',
    ]);
    expect(MOCK_SCENES['calendar-day']).toBe(CALENDAR_PLACE_SCENES['calendar-day']);
  });

  it('calendar-day draws the head, the facts and one row per event of the day', async () => {
    mount({ id: 'calendar-day' });

    await screen.findByRole('heading', { name: 'Calendar' }, WAIT);
    expect(screen.getByText('Experimental')).toBeTruthy();
    await waitFor(() => expect(screen.getByText(/3 calls · 1h 30m focus/)).toBeTruthy(), WAIT);
    const list = await today();
    await waitFor(() => expect(within(list).getAllByRole('button')).toHaveLength(5), WAIT);
    expect(
      within(list).getByRole('button', { name: /ledger-core standup, 15m, Ended/ }),
    ).toBeTruthy();
    expect(within(list).getByRole('button', { name: /Northwind sync.*in 12m/ })).toBeTruthy();
    expect(within(list).getByRole('button', { name: /Busy, 45m/ })).toBeTruthy();
    expect(within(list).queryByText('Dentist')).toBeNull();
  });

  it('calendar-day shows the needs-you count on the call that starts soon, and only there', async () => {
    mount({ id: 'calendar-day' });

    const soon = await row({ name: /Northwind sync/ });
    await waitFor(() => expect(soon.getAttribute('aria-label')).toMatch(/\d+ need you$/), WAIT);
    const later = await row({ name: /Cascadia design review/ });
    expect(later.getAttribute('aria-label')).not.toMatch(/need you/);
  });

  it('opens the detail panel with Join call, Copy link, Before this call and People', async () => {
    mount({ id: 'calendar-day' });

    fireEvent.click(await row({ name: /Northwind sync/ }));

    const panel = await screen.findByLabelText('Event', {}, WAIT);
    within(panel).getByRole('button', { name: 'Join call' });
    within(panel).getByRole('button', { name: 'Copy link' });
    within(panel).getByRole('region', { name: 'Before this call' });
    const people = within(panel).getByRole('region', { name: 'People' });
    expect(within(people).getByText('Mara Ilic')).toBeTruthy();
    expect(within(people).getByText('Dov Arent')).toBeTruthy();
    expect(within(panel).getByText(/meet\.google\.com/)).toBeTruthy();

    fireEvent.click(within(panel).getByRole('button', { name: 'Join call' }));
    await waitFor(
      () =>
        expect(vi.mocked(invoke)).toHaveBeenCalledWith('open_url', {
          url: 'https://meet.google.com/xyz-abcd-efg',
        }),
      WAIT,
    );
  });

  it('keeps an ended call without Join call', async () => {
    mount({ id: 'calendar-day' });

    fireEvent.click(await row({ name: /ledger-core standup/ }));

    const panel = await screen.findByLabelText('Event', {}, WAIT);
    expect(within(panel).queryByRole('button', { name: 'Join call' })).toBeNull();
  });

  it('calendar-busy never shows the title of a busy only calendar', async () => {
    mount({ id: 'calendar-busy' });

    const list = await today();
    await waitFor(() => expect(within(list).getAllByRole('button')).toHaveLength(5), WAIT);
    expect(within(list).queryByText(/Northwind/)).toBeNull();
    expect(within(list).getAllByText('Busy').length).toBeGreaterThanOrEqual(4);

    const [, second] = within(list).getAllByRole('button');
    if (second === undefined) {
      throw new Error('no second row');
    }
    fireEvent.click(second);
    const panel = await screen.findByLabelText('Event', {}, WAIT);
    expect(within(panel).getByText(/Goodboy never reads its title/)).toBeTruthy();
    expect(within(panel).queryByRole('button', { name: 'Join call' })).toBeNull();
  });

  it('says what a focus block means', async () => {
    mount({ id: 'calendar-day' });

    fireEvent.click(await row({ name: /^\d\d:\d\d, Focus/ }));

    const panel = await screen.findByLabelText('Event', {}, WAIT);
    expect(within(panel).getByText('Agents keep working through this focus block.')).toBeTruthy();
  });

  it('calendar-empty asks to connect a calendar and opens Connections', async () => {
    mount({ id: 'calendar-empty' });

    await screen.findByRole('heading', { name: 'Connect a calendar' }, WAIT);
    fireEvent.click(screen.getByRole('button', { name: 'Connect calendars' }));

    await waitFor(() => expect(useAppStore.getState().appStudio?.kind).toBe('connections'), WAIT);
  });

  it('calendar-quiet says nothing today in one line', async () => {
    mount({ id: 'calendar-quiet' });

    await screen.findByText('Nothing today', {}, WAIT);
  });

  it('calendar-week draws the week grid and opens an event from it', async () => {
    mount({ id: 'calendar-week' });

    const week = await screen.findByRole('group', { name: 'Week' }, WAIT);
    const block = await within(week).findByRole('button', { name: /Northwind sync/ }, WAIT);
    fireEvent.click(block);

    const panel = await screen.findByLabelText('Event', {}, WAIT);
    within(panel).getByRole('button', { name: 'Join call' });
  });

  it('marks a reminder done and brings it back from the undo toast', async () => {
    mount({ id: 'calendar-day' });

    const box = await screen.findByRole('checkbox', { name: MERGE }, WAIT);
    fireEvent.click(box);

    await waitFor(() => expect(isChecked({ name: MERGE })).toBe(true), WAIT);
    const undo = await screen.findByRole('button', { name: /Undo/ }, WAIT);
    fireEvent.click(undo);

    await waitFor(() => expect(isChecked({ name: MERGE })).toBe(false), WAIT);
  });

  it('adds a reminder with the time it reads from the text', async () => {
    mount({ id: 'calendar-day' });

    const input = await screen.findByRole('textbox', { name: 'Add a reminder' }, WAIT);
    fireEvent.change(input, { target: { value: 'Ping Teo about notify-relay at 17:00' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    const added = await screen.findByText('Ping Teo about notify-relay', {}, WAIT);
    const reminderRow = added.closest('li');
    expect(reminderRow?.textContent).toMatch(/(Today|Tomorrow) 17:00/);
  });
});
