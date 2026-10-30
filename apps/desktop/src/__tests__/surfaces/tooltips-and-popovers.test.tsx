// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  brandId,
  DEFAULT_WORKFLOW_RULES,
  type AgentId,
  type IsoDateTime,
  type ProviderRunId,
  type Session,
  type WorkflowId,
  type WorkflowRun,
  type WorkflowRunId,
} from '@goodboy/types';
import { anAgent, aSession } from '@goodboy/types/testing';
import { ContextMenu, POPOVER_WIDTH_PX } from '@goodboy/ui';
import { ToastProvider } from '../../shared/components/Toast';
import { ObjectMenuProvider } from '../../features/actions/components/ObjectMenuProvider';
import { aDelegation, FIXTURE_SESSION } from '../../features/auto/testing/autoViewFixtures';
import { AutoChildCard } from '../../features/auto/chat/AutoChildCard';
import { delegationCardOf } from '../../features/auto/chat/delegationCardOf';
import { RUN_AUTONOMY_HEADER } from '../../features/workflows/runAutonomy';
import { LiveRow } from '../../features/session/central/now/LiveRow';
import { layoutTimelineRail } from '../../features/workTreeModel/railGeometry';
import type { TimelineRowItem } from '../../features/session/timeline/buildTimelineStream';
import { RunTreeRow } from '../../features/workflows/components/RunTree/RunTreeRow';
import {
  baseAgents,
  streamOf,
} from '../../features/workflows/components/RunTree/testing/runTreeFixtures';
import { FilterButton } from '../../shared/components/FilterButton';
import { RoutingPicker } from '../../shared/components/RoutingPicker';
import { ModelControlChip } from '../../shared/components/ModelControlChip';
import {
  importStore,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from '../../store/storyHarness';

let useAppStore: StoryStore;
let RunSettingsLine: typeof import('../../features/workflows/components/RunSettingsLine').RunSettingsLine;

const VIEWPORT = { width: 1024, height: 640 };
const MARGIN = 8;
const POPUP_HEIGHT = 320;
const LONG_TITLE =
  'Reconcile every duplicated credit in the Harborline ledger export before the Northwind close';

const RUN_ID = brandId<WorkflowRunId>({ value: 'run-popover-placement' });

const RUN: WorkflowRun = {
  id: RUN_ID,
  workflowId: brandId<WorkflowId>({ value: 'workflow-orchestrated' }),
  ordinal: 0,
  currentStep: 0,
  autoRun: false,
  triggerMode: 'immediate',
  executionMode: 'dynamic',
  spendLimitUsd: 5,
  rulesSnapshot: { ...DEFAULT_WORKFLOW_RULES, autonomy: 'step' },
};

const SESSION: Session = aSession({ goal: 'Close the Northwind books', workflowRuns: [RUN] });

const PROVIDERS = JSON.parse(
  JSON.stringify(
    ['anthropic', 'codex'].map((id) => ({
      id,
      binary: id,
      label: id,
      error: null,
      docsUrl: '',
      version: '1.0.0',
      identity: null,
      connection: 'connected',
      capabilities: { models: [], efforts: [], features: [] },
    })),
  ),
);

type Corner = 'bottom-right' | 'top-left';

const TRIGGER_AT: Record<Corner, DOMRect> = {
  'bottom-right': new DOMRect(VIEWPORT.width - 64, VIEWPORT.height - 40, 56, 28),
  'top-left': new DOMRect(4, 4, 56, 28),
};

type PlacementParams = {
  readonly corner: Corner;
};

const ORIGINAL_SIZE = { width: window.innerWidth, height: window.innerHeight };

const stubLayout = ({ corner }: PlacementParams): void => {
  Object.defineProperty(window, 'innerWidth', { value: VIEWPORT.width, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: VIEWPORT.height, configurable: true });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    const isPopup = this.matches('[role="dialog"], [role="menu"], [role="listbox"]');
    if (!isPopup) {
      return TRIGGER_AT[corner];
    }
    const token = / w-(\d+) /.exec(` ${this.className} `);
    const width = token === null ? POPOVER_WIDTH_PX.standard : Number(token[1]) * 4;
    return new DOMRect(0, 0, width, POPUP_HEIGHT);
  });
};

type PopupBoxParams = {
  readonly popup: HTMLElement;
};

const boxOf = ({ popup }: PopupBoxParams) => ({
  left: Number.parseFloat(popup.style.left),
  top: popup.style.top === '' ? null : Number.parseFloat(popup.style.top),
  bottom: popup.style.bottom === '' ? null : Number.parseFloat(popup.style.bottom),
  maxWidth: Number.parseFloat(popup.style.maxWidth),
  maxHeight: Number.parseFloat(popup.style.maxHeight),
  width: / w-(\d+) /.exec(` ${popup.className} `),
});

type FamilyParams = {
  readonly popup: HTMLElement;
  readonly widthPx: number;
};

const expectInsideTheWindow = ({ popup, widthPx }: FamilyParams): void => {
  const box = boxOf({ popup });
  expect(box.left).toBeGreaterThanOrEqual(MARGIN);
  expect(box.left + widthPx).toBeLessThanOrEqual(VIEWPORT.width - MARGIN);
  expect(box.maxWidth).toBeLessThanOrEqual(VIEWPORT.width - MARGIN * 2);
  expect(box.maxHeight).toBeLessThanOrEqual(VIEWPORT.height - MARGIN * 2);
  expect(Object.values(POPOVER_WIDTH_PX)).toContain(widthPx);
  expect(Number(box.width?.[1]) * 4).toBe(widthPx);
};

beforeAll(async () => {
  useAppStore = await importStore();
  ({ RunSettingsLine } = await import('../../features/workflows/components/RunSettingsLine'));
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({ sessions: [SESSION], providers: PROVIDERS });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  Object.defineProperty(window, 'innerWidth', { value: ORIGINAL_SIZE.width, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: ORIGINAL_SIZE.height, configurable: true });
});

const showRunSettings = () => render(<RunSettingsLine session={SESSION} run={RUN} isOpen />);

type ChipParams = {
  readonly label: string;
};

const chip = ({ label }: ChipParams) =>
  within(screen.getByRole('group', { name: 'Run settings' })).getByRole('button', {
    name: new RegExp(`^${label}:`),
  });

describe('a popover opens beside its trigger and stays inside the window', () => {
  const FAMILIES = [
    { family: 'Asks you', label: RUN_AUTONOMY_HEADER },
    { family: 'run limit', label: 'Limit' },
    { family: 'run models', label: 'Models' },
  ] as const;

  for (const { family, label } of FAMILIES) {
    it(`opens the ${family} popover upward at the bottom edge, shifted in from the right edge`, () => {
      stubLayout({ corner: 'bottom-right' });
      showRunSettings();

      fireEvent.click(chip({ label }));
      const popup = screen.getByRole('dialog', { name: label });
      const box = boxOf({ popup });

      expect(box.bottom).not.toBeNull();
      expect(box.top).toBeNull();
      expect(box.bottom).toBe(VIEWPORT.height - TRIGGER_AT['bottom-right'].top + 4);
      expectInsideTheWindow({ popup, widthPx: POPOVER_WIDTH_PX.standard });
    });

    it(`opens the ${family} popover downward at the top edge, shifted in from the left edge`, () => {
      stubLayout({ corner: 'top-left' });
      showRunSettings();

      fireEvent.click(chip({ label }));
      const popup = screen.getByRole('dialog', { name: label });
      const box = boxOf({ popup });

      expect(box.top).toBe(TRIGGER_AT['top-left'].bottom + 4);
      expect(box.bottom).toBeNull();
      expect(box.left).toBe(MARGIN);
      expectInsideTheWindow({ popup, widthPx: POPOVER_WIDTH_PX.standard });
    });
  }

  it('opens the model picker on the wide width from the scale, upward at the bottom edge', () => {
    stubLayout({ corner: 'bottom-right' });
    const route = { provider: 'anthropic', model: 'opus', effort: 'high' } as const;
    render(
      <ModelControlChip
        connectedProviders={['anthropic', 'codex']}
        effective={route}
        suggestion={route}
        isOverridden={false}
        onChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /^Model/ }));
    const popup = screen.getByRole('dialog', { name: 'Model' });
    const box = boxOf({ popup });

    expect(box.bottom).not.toBeNull();
    expect(box.top).toBeNull();
    expectInsideTheWindow({ popup, widthPx: POPOVER_WIDTH_PX.wide });
  });

  it('keeps a menu on a row inside the window when it opens at the bottom right corner', () => {
    stubLayout({ corner: 'bottom-right' });
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(220);
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(120);
    const rect = TRIGGER_AT['bottom-right'];
    render(
      <ContextMenu
        label="Agent actions"
        point={{ x: rect.left + 20, y: rect.top + 10 }}
        entries={[
          { kind: 'item', key: 'open', label: 'Open the agent', onSelect: vi.fn() },
          { kind: 'item', key: 'stop', label: 'Stop this agent', onSelect: vi.fn() },
        ]}
        onClose={vi.fn()}
      />,
    );

    const menu = document.querySelector<HTMLElement>('[data-context-menu]');
    if (menu === null) {
      throw new Error('the menu did not open');
    }
    const left = Number.parseFloat(menu.style.left);
    const top = Number.parseFloat(menu.style.top);

    expect(left).toBeGreaterThanOrEqual(MARGIN);
    expect(top).toBeGreaterThanOrEqual(MARGIN);
    expect(left).toBeLessThan(rect.left + 20);
    expect(top).toBeLessThan(rect.top + 10);
  });
});

const STARTED = brandId<IsoDateTime>({ value: '2026-10-29T09:00:00.000Z' });
const CHILD = brandId<AgentId>({ value: 'agent-impl' });

const cutTextEverywhere = (): void => {
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(320);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(120);
};

type ShowChildParams = {
  readonly onOpen: () => void;
};

describe('a cut title in a row is reachable by hover and by keyboard', () => {
  beforeEach(() => {
    useAppStore.setState({
      sessionPhaseRuns: {
        [FIXTURE_SESSION]: [
          anAgent({
            id: CHILD,
            sessionId: FIXTURE_SESSION,
            name: LONG_TITLE,
            status: 'running',
            kind: 'implementer',
          }),
        ],
      },
      agentTurnState: {
        [CHILD]: {
          kind: 'running',
          runId: brandId<ProviderRunId>({ value: 'run-impl' }),
          startedAt: STARTED,
        },
      },
    });
  });

  const showChild = ({ onOpen }: ShowChildParams) => {
    const delegation = aDelegation({ key: 'impl', role: 'implementer', state: 'running' });
    const card = delegationCardOf({ delegation, childAgent: null });
    render(
      <ToastProvider>
        <ObjectMenuProvider>
          <AutoChildCard
            sessionId={FIXTURE_SESSION}
            delegation={delegation}
            card={card}
            agent={null}
            name={LONG_TITLE}
            revision={null}
            onOpen={onOpen}
          />
        </ObjectMenuProvider>
      </ToastProvider>,
    );
    return { title: screen.getByText(LONG_TITLE), tip: card.task ?? LONG_TITLE };
  };

  it('opens the full title in a tooltip on hover and still opens the row from a click on it', () => {
    cutTextEverywhere();
    const onOpen = vi.fn();
    const { title, tip } = showChild({ onOpen });

    vi.useFakeTimers();
    fireEvent.mouseEnter(title);
    act(() => {
      vi.advanceTimersByTime(400);
    });
    vi.useRealTimers();

    expect(screen.getByRole('tooltip').textContent).toBe(tip);
    fireEvent.click(title);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('opens the same tooltip when the keyboard reaches the cut title, with no delay', async () => {
    cutTextEverywhere();
    const user = userEvent.setup();
    const { title, tip } = showChild({ onOpen: vi.fn() });

    await user.tab();
    await user.tab();

    expect(document.activeElement).toBe(title);
    expect(screen.getByRole('tooltip').textContent).toBe(tip);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('keeps a title that fits out of the tab order and shows no tooltip', async () => {
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(100);
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(100);
    const user = userEvent.setup();
    const { title } = showChild({ onOpen: vi.fn() });

    await user.tab();
    await user.tab();

    expect(document.activeElement).not.toBe(title);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('opens the title of an overview row the same way, from a row with its own overlay', () => {
    cutTextEverywhere();
    const onOpen = vi.fn();
    render(
      <LiveRow
        glyph={<svg />}
        kindWord="Implementer"
        title={LONG_TITLE}
        openLabel="Open the agent"
        onOpen={onOpen}
        where={null}
        end={null}
        time={<span>2m</span>}
      />,
    );
    const title = screen.getByText(LONG_TITLE);

    vi.useFakeTimers();
    fireEvent.mouseEnter(title);
    act(() => {
      vi.advanceTimersByTime(400);
    });
    vi.useRealTimers();

    expect(screen.getByRole('tooltip').textContent).toBe(LONG_TITLE);
    fireEvent.click(title);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});

describe('a trigger never labels itself over its own popover', () => {
  it('shows its tooltip while closed and keeps it away once the popover is open', () => {
    render(
      <FilterButton popoverLabel="Filter the agents" activeCount={0} facets={<p>Facets</p>} />,
    );
    const trigger = screen.getByRole('button', { name: 'Filters' });

    vi.useFakeTimers();
    fireEvent.mouseEnter(trigger);
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(screen.getByRole('tooltip').textContent).toBe('Filters');
    fireEvent.mouseLeave(trigger);

    fireEvent.click(trigger);
    screen.getByRole('dialog', { name: 'Filter the agents' });
    fireEvent.mouseEnter(trigger);
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    vi.useRealTimers();

    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});

describe('a run tree row and a routing pill follow the same rules', () => {
  it('reaches the cut title of a run tree row from the keyboard and opens its tooltip', async () => {
    cutTextEverywhere();
    const stream = streamOf({ agents: baseAgents });
    const layout = layoutTimelineRail({
      rows: stream.items,
      groups: stream.groups,
      hasSpine: false,
    });
    const item = stream.items.find(
      (candidate): candidate is TimelineRowItem => candidate.kind === 'row',
    );
    const rail = layout.rows.find((candidate) => candidate.id === item?.id);
    if (item === undefined || rail === undefined || item.entry.kind !== 'agent') {
      throw new Error('the fixture has no agent row');
    }
    const { agent } = item.entry;
    render(
      <RunTreeRow
        density="page"
        item={item}
        entry={item.entry}
        rail={rail}
        railWidth={layout.width}
        routing={{
          stepById: new Map(),
          roleModels: null,
          sessionProvider: null,
          sessionEffort: null,
        }}
        costUsd={0}
        isNested={false}
        hasActionColumn={false}
        plan={null}
        parentStepName={null}
        isSelected={false}
        isHighlighted={false}
        skip={null}
        onSelect={vi.fn()}
        onAnswer={vi.fn()}
      />,
    );
    const title = screen
      .getAllByText(agent.name)
      .find((node) => node.hasAttribute('data-truncated-text'));
    const user = userEvent.setup();

    for (let step = 0; step < 8 && document.activeElement !== title; step += 1) {
      await user.tab();
    }

    expect(document.activeElement).toBe(title);
    expect(screen.getByRole('tooltip').textContent).toBe(agent.name);
  });

  it('keeps the label of the routing pill away from its own popover', () => {
    render(
      <RoutingPicker
        connectedProviders={['anthropic', 'codex']}
        provider="anthropic"
        model="claude-opus-5"
        effort={{ editable: true, value: 'high' }}
        disabled={false}
        ariaLabel="routing"
        variant="pill"
        onChange={vi.fn()}
      />,
    );
    const trigger = screen.getByRole('button', { name: /^routing:/ });

    fireEvent.click(trigger);
    screen.getByRole('dialog', { name: 'routing' });
    vi.useFakeTimers();
    fireEvent.mouseEnter(trigger);
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    vi.useRealTimers();

    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});
