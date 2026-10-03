import { expect } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import type { AgentId, IsoDateTime, MountId, SearchHit } from '@goodboy/types';
import { STORY_NOW } from '../../../store/storyHarness';
import { currentPlatform } from '../../../shared/platform';
import {
  type Ctx,
  type Row,
  WAIT,
  band,
  both,
  click,
  clickButton,
  clickFirstButton,
  heading,
  lens,
  openCrumb,
  settle,
  useAppStore,
  visible,
} from './harness';

const pressCommand = async (code: string): Promise<void> => {
  const isMac = currentPlatform() === 'darwin';
  fireEvent.keyDown(window, { code, metaKey: isMac, ctrlKey: !isMac });
  await settle();
};

type SearchHitParams = {
  readonly ctx: Ctx;
  readonly overrides: Partial<SearchHit>;
};

const searchHit = ({ ctx, overrides }: SearchHitParams): SearchHit => ({
  docId: `${overrides.kind ?? 'session'}:hit`,
  kind: 'session',
  refId: 'hit',
  workspaceId: useAppStore.getState().currentWorkspaceId,
  sessionId: ctx.sessionId,
  sessionTitle: 'Stop retried webhooks',
  agentId: null,
  agentName: null,
  mountId: null,
  provider: null,
  container: null,
  status: null,
  ordinal: null,
  url: null,
  isArchived: false,
  occurredAt: STORY_NOW as IsoDateTime,
  title: [{ text: 'Retried webhook ledger', isMatch: false }],
  snippet: [{ text: 'ledger', isMatch: true }],
  ...overrides,
});

type SearchJumpParams = {
  readonly ctx: Ctx;
  readonly overrides: (ctx: Ctx) => Partial<SearchHit>;
};

const searchAndOpen = async ({ ctx, overrides }: SearchJumpParams): Promise<void> => {
  const hit = searchHit({ ctx, overrides: overrides(ctx) });
  useAppStore.setState({ runSearch: async () => [hit] } as never);
  await pressCommand('KeyF');
  const input = await screen.findByRole('combobox', { name: 'Search' });
  fireEvent.change(input, { target: { value: 'ledger' } });
  await settle(8);
  fireEvent.keyDown(input, { key: 'Enter' });
  await settle(6);
};

const firstMountId = (ctx: Ctx): MountId =>
  useAppStore.getState().sessionMounts[ctx.sessionId]?.[0]?.id ?? ('none' as MountId);

const SEARCH_JUMPS: ReadonlyArray<{
  readonly kind: string;
  readonly overrides: (ctx: Ctx) => Partial<SearchHit>;
  readonly lands: (ctx: Ctx) => Promise<void>;
}> = [
  { kind: 'session', overrides: () => ({ kind: 'session' }), lands: lens(null) },
  {
    kind: 'message',
    overrides: () => ({ kind: 'message', agentId: 'agent-gone' as AgentId, status: 'user' }),
    lands: lens('agents'),
  },
  { kind: 'plan', overrides: () => ({ kind: 'plan', refId: 'plan-1' }), lands: lens('plans') },
  {
    kind: 'decision',
    overrides: () => ({ kind: 'decision', ordinal: 1 }),
    lands: async (ctx) => {
      await waitFor(
        () =>
          expect(useAppStore.getState().drawer).toMatchObject({
            kind: 'context',
            sessionId: ctx.sessionId,
            payload: { tab: 'decisions', highlight: [1] },
          }),
        WAIT,
      );
    },
  },
  {
    kind: 'question',
    overrides: () => ({ kind: 'question', refId: 'q-1' }),
    lands: lens('questions'),
  },
  { kind: 'pr', overrides: () => ({ kind: 'pr' }), lands: lens('pr') },
  {
    kind: 'comment',
    overrides: () => ({ kind: 'comment', refId: 'c-1' }),
    lands: async (ctx) => {
      await lens('files')(ctx);
      await waitFor(
        () =>
          expect(useAppStore.getState().drawer).toMatchObject({
            kind: 'diff-notes',
            sessionId: ctx.sessionId,
          }),
        WAIT,
      );
    },
  },
  {
    kind: 'workflow',
    overrides: () => {
      const state = useAppStore.getState();
      const workspaceId = state.currentWorkspaceId;
      const first = workspaceId === null ? undefined : state.phaseTemplates[workspaceId]?.[0];
      return { kind: 'workflow', sessionId: null, refId: first?.id ?? 'workflow-none' };
    },
    lands: () => band('Workflows'),
  },
  {
    kind: 'branch',
    overrides: (ctx) => ({ kind: 'branch', mountId: firstMountId(ctx), status: 'attached' }),
    lands: lens('files'),
  },
];

export const CREATE_AND_SEARCH_ROWS: ReadonlyArray<Row> = [
  {
    name: 'mount row: changes to the mount diff',
    covers: ['openMountDiff'],
    open: () => clickFirstButton(/^View the changes of /),
    lands: both(lens('files'), () => heading('Diff')),
  },
  ...(['Report', 'Wireframe'] as const).map((kind): Row => ({
    name: `overview new menu: ${kind.toLowerCase()}`,
    covers: ['openArtifactCreation'],
    open: async () => {
      await clickButton(/^New$/);
      await click(await screen.findByRole('menuitem', { name: new RegExp(`^${kind}`) }));
    },
    lands: () => heading(`Create ${kind.toLowerCase()}`),
  })),
  {
    name: 'search: Cmd+F opens search scoped to the session',
    covers: ['search.open'],
    open: () => pressCommand('KeyF'),
    lands: async () => {
      await visible('dialog', 'Search');
      expect(await screen.findByText('In session')).toBeDefined();
    },
  },
  ...SEARCH_JUMPS.map((jump): Row => ({
    name: `search: a ${jump.kind} hit lands in context`,
    covers: [jump.kind === 'workflow' ? 'openStudio' : 'navigate', `search:${jump.kind}`],
    open: (ctx) => searchAndOpen({ ctx, overrides: jump.overrides }),
    lands: jump.lands,
  })),
  {
    name: 'back arrow history menu jumps to an entry',
    covers: ['goToHistory'],
    open: async () => {
      await openCrumb(/^Diff/);
      fireEvent.contextMenu(await screen.findByRole('button', { name: /^Back/ }));
      await settle();
      const entries = await screen.findAllByRole('menuitemradio');
      const target = entries.find((entry) => entry.getAttribute('aria-checked') !== 'true');
      if (target === undefined) {
        throw new Error('the history menu has no other entry');
      }
      await click(target);
    },
    lands: lens(null),
  },
];
