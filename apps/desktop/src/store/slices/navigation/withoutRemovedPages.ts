import { isProviderListLens } from './isProviderListLens';
import { contextSectionOf } from './contextSectionOf';
import { brandId, type AgentId, type SessionId, type WorkflowRunId } from '@goodboy/types';
import { IPHONE_SETTINGS_PLACE } from '../../../features/settings/iphoneSettingsPlace';
import type { OpenDrawer } from '../drawer/state';
import { LENS_KINDS, type LensKind } from '../session-view/types';
import { sessionPlace } from './place';
import { PLACE_ROWS } from './placeRows';
import type { StudioPlace } from './studio';
import type { Focus, Location, Place, SessionTarget } from './types';

type Params = {
  readonly location: Location;
};

type Rows = Readonly<Record<string, string>>;

type StudioParams = {
  readonly studio: StudioPlace | null;
};

type TargetParams = {
  readonly target: SessionTarget | null;
};

const RETIRED_RUNS_LENSES: ReadonlySet<string> = new Set(['agents', 'auto']);

const REMOVED_TARGETS: ReadonlySet<string> = new Set(['terminal', 'explore', 'scripts', 'agent']);

const REMOVED_DRAWERS: ReadonlySet<string> = new Set(['auto-child', 'run-step']);

const CONTEXT_SECTIONS: ReadonlySet<unknown> = new Set([
  'goal',
  'decisions',
  'summary',
  'explanations',
]);

const REMOVED_STUDIOS: ReadonlyMap<string, StudioPlace> = new Map<string, StudioPlace>([
  ['companion', IPHONE_SETTINGS_PLACE],
]);

const NO_ROWS: Rows = {};

const ALL_FILES: Rows = { [PLACE_ROWS.changesMode]: 'all' };

const RUNNING_RUNS: Rows = { [PLACE_ROWS.runsFilter]: 'running' };

type RowsParams = {
  readonly focus: Focus;
  readonly rows: Rows;
};

const withRows = ({ focus, rows }: RowsParams): Focus =>
  Object.keys(rows).length === 0
    ? focus
    : { ...focus, returnRows: { ...focus.returnRows, ...rows } };

const studioStillThere = ({ studio }: StudioParams): StudioPlace | null => {
  if (studio === null) {
    return null;
  }
  return REMOVED_STUDIOS.get(String(studio.kind)) ?? studio;
};

const withoutRemovedStudio = ({ location }: Params): Location => {
  const studio = studioStillThere({ studio: location.studio });
  return studio === location.studio ? location : { ...location, studio };
};

const targetStillThere = ({ target }: TargetParams): SessionTarget | null => {
  if (target === null || REMOVED_TARGETS.has(String(target.kind))) {
    return null;
  }
  if (target.kind === 'thread' && 'pane' in target) {
    return { kind: 'thread', threadId: target.threadId };
  }
  return target;
};

type LensFold = {
  readonly lens: LensKind | null;
  readonly pane: OpenDrawer | null;
  readonly rows: Rows;
};

type LensFoldParams = {
  readonly lens: string;
  readonly sessionId: SessionId;
};

const foldOfRemovedLens = ({ lens, sessionId }: LensFoldParams): LensFold | null => {
  const section = contextSectionOf({ lens });
  if (section !== null) {
    return { lens: 'context', pane: null, rows: { [PLACE_ROWS.contextSection]: section } };
  }
  if (lens === 'explore') {
    return { lens: 'files', pane: null, rows: ALL_FILES };
  }
  if (lens === 'scripts') {
    return { lens: null, pane: { kind: 'scripts', sessionId, payload: null }, rows: NO_ROWS };
  }
  if (lens === 'terminal') {
    return { lens: null, pane: null, rows: NO_ROWS };
  }
  return null;
};

type KnownParams = {
  readonly lens: LensKind | null;
};

const isKnownLens = ({ lens }: KnownParams): boolean => lens === null || LENS_KINDS.has(lens);

const withoutRemovedLens = ({ location }: Params): Location => {
  const { place } = location;
  if (place.at !== 'session') {
    return location;
  }
  const { view, sessionId } = place;
  const lens = String(view.lens);
  const fold = foldOfRemovedLens({ lens, sessionId });
  if (fold !== null) {
    return {
      ...location,
      place: { ...place, view: { ...view, lens: fold.lens, target: null } },
      focus: withRows({
        focus: { ...location.focus, drawer: location.focus.drawer ?? fold.pane },
        rows: fold.rows,
      }),
    };
  }
  if (RETIRED_RUNS_LENSES.has(lens)) {
    const rows = lens === 'agents' && view.agentId === null ? RUNNING_RUNS : NO_ROWS;
    return {
      ...location,
      place: {
        ...place,
        view: { ...view, lens: 'workflows', target: targetStillThere({ target: view.target }) },
      },
      focus: withRows({ focus: location.focus, rows }),
    };
  }
  const isProviderList = isProviderListLens({ lens }) && view.target === null;
  if (isProviderList || !isKnownLens({ lens: view.lens })) {
    return { ...location, place: sessionPlace({ sessionId }) };
  }
  const target = targetStillThere({ target: view.target });
  return target === view.target
    ? location
    : { ...location, place: { ...place, view: { ...view, target } } };
};

type DrawerParams = {
  readonly drawer: OpenDrawer | null;
};

const pageOfRemovedDrawer = ({ drawer }: DrawerParams): Place | null => {
  if (drawer === null || !REMOVED_DRAWERS.has(String(drawer.kind))) {
    return null;
  }
  const { sessionId } = drawer;
  if (sessionId === null) {
    return null;
  }
  const saved: object | null = drawer.payload;
  if (saved === null || !('agentId' in saved) || typeof saved.agentId !== 'string') {
    return sessionPlace({ sessionId });
  }
  const agentId = brandId<AgentId>({ value: saved.agentId });
  if (!('runId' in saved) || typeof saved.runId !== 'string') {
    return sessionPlace({ sessionId, lens: 'workflows', agentId });
  }
  const runId = brandId<WorkflowRunId>({ value: saved.runId });
  return sessionPlace({ sessionId, lens: 'workflows', agentId, target: { kind: 'run', runId } });
};

const withoutRemovedDrawer = ({ location }: Params): Location => {
  const place = pageOfRemovedDrawer({ drawer: location.focus.drawer });
  return place === null
    ? location
    : { ...location, place, focus: { ...location.focus, drawer: null } };
};

const withoutFormerSection = ({ location }: Params): Location => {
  const drawer = location.focus.drawer;
  if (drawer?.kind !== 'context') {
    return location;
  }
  const current: unknown = Reflect.get(drawer.payload, 'section');
  const former: unknown = Reflect.get(drawer.payload, 'tab');
  const value = current ?? former;
  const section = value === 'learned' ? 'explanations' : value;
  if (
    section !== 'goal' &&
    section !== 'decisions' &&
    section !== 'summary' &&
    section !== 'explanations'
  ) {
    return location;
  }
  if (current === section) {
    return location;
  }
  return {
    ...location,
    focus: {
      ...location.focus,
      drawer: {
        ...drawer,
        payload: {
          section,
          view: drawer.payload.view,
          ...(drawer.payload.highlight === undefined
            ? {}
            : { highlight: drawer.payload.highlight }),
        },
      },
    },
  };
};

type PanelFold = {
  readonly place: Place;
  readonly rows: Rows;
};

type ContextPanelParams = {
  readonly drawer: Extract<OpenDrawer, { readonly kind: 'context' }>;
};

const contextRowOf = ({ drawer }: ContextPanelParams): string => {
  if (Reflect.get(drawer.payload, 'view') === 'versions') {
    return 'history';
  }
  const section: unknown = Reflect.get(drawer.payload, 'section');
  return CONTEXT_SECTIONS.has(section) ? String(section) : 'goal';
};

type FilePanelParams = {
  readonly drawer: Extract<OpenDrawer, { readonly kind: 'explore-file' }>;
};

const treeFileOf = ({ drawer }: FilePanelParams): string | null => {
  if (drawer.payload.from !== 'explore') {
    return null;
  }
  const entry: unknown = Reflect.get(drawer.payload, 'entry');
  const path: unknown =
    typeof entry === 'object' && entry !== null ? Reflect.get(entry, 'relPath') : null;
  return typeof path === 'string' && path !== '' ? path : null;
};

const foldOfPanel = ({ drawer }: DrawerParams): PanelFold | null => {
  if (drawer === null || drawer.sessionId === null) {
    return null;
  }
  const { sessionId } = drawer;
  if (drawer.kind === 'context') {
    return {
      place: sessionPlace({ sessionId, lens: 'context' }),
      rows: { [PLACE_ROWS.contextSection]: contextRowOf({ drawer }) },
    };
  }
  if (drawer.kind === 'ask') {
    return {
      place: sessionPlace({ sessionId, lens: 'context' }),
      rows: { [PLACE_ROWS.contextSection]: 'ask' },
    };
  }
  if (drawer.kind === 'explore') {
    return { place: sessionPlace({ sessionId, lens: 'files' }), rows: ALL_FILES };
  }
  if (drawer.kind === 'spawned') {
    return { place: sessionPlace({ sessionId, lens: 'workflows' }), rows: RUNNING_RUNS };
  }
  if (drawer.kind !== 'explore-file') {
    return null;
  }
  const path = treeFileOf({ drawer });
  if (path === null) {
    return null;
  }
  return {
    place: sessionPlace({
      sessionId,
      lens: 'files',
      target: { kind: 'diff', mountPath: null, focus: { kind: 'branch', path } },
    }),
    rows: ALL_FILES,
  };
};

const withoutRemovedPanel = ({ location }: Params): Location => {
  const fold = foldOfPanel({ drawer: location.focus.drawer });
  if (fold === null) {
    return location;
  }
  return {
    ...location,
    place: fold.place,
    focus: withRows({ focus: { ...location.focus, drawer: null }, rows: fold.rows }),
  };
};

export const withoutRemovedPages = ({ location }: Params): Location =>
  withoutRemovedPanel({
    location: withoutRemovedLens({
      location: withoutFormerSection({
        location: withoutRemovedDrawer({ location: withoutRemovedStudio({ location }) }),
      }),
    }),
  });
