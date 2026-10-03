import { useEffect, useState } from 'react';
import type { WireframeDocument, WireframeNode, WireframeScreen } from '@goodboy/core';
import type { AgentId, ArtifactId, Session, WireframeArtifact } from '@goodboy/types';
import type { WireframeVersion } from '../../../../../features/wireframes/wireframeVersion';
import { ShellFrame } from '../shellChrome';
import { BRAND_OTHER_SESSIONS } from './canon';
import { CompareStage } from './CompareStage';
import { CTX_SESSION, CTX_SIBLINGS, minutesAgo, seedContextBase } from './contextBase';

const STUCK_INDEX = BRAND_OTHER_SESSIONS.findIndex((entry) => entry.project === 'notify-relay');
const SESSION: Session = CTX_SIBLINGS[STUCK_INDEX] ?? CTX_SESSION;
const ARTIFACT_ID = 'mock-brand-compare-deliveries' as ArtifactId;
const AGENT_ID = 'mock-brand-compare-agent-wireframe' as AgentId;

const NAV: WireframeNode = {
  id: 'deliveries-nav',
  kind: 'navigation',
  variant: 'top',
  items: [
    { id: 'nav-deliveries', label: 'Deliveries', isActive: true },
    {
      id: 'nav-endpoints',
      label: 'Endpoints',
      action: { type: 'navigate', toScreenId: 'endpoints' },
    },
    { id: 'nav-settings', label: 'Settings' },
  ],
};

const TITLE: WireframeNode = {
  id: 'deliveries-title',
  kind: 'text',
  text: 'Deliveries',
  variant: 'title',
};

const BANNER: WireframeNode = {
  id: 'deliveries-stuck-banner',
  kind: 'card',
  title: 'Stuck delivery: evt_4Q2x for 14 min',
  padding: 'sm',
  children: [],
};

const FILTERS: WireframeNode = {
  id: 'deliveries-filters',
  kind: 'stack',
  direction: 'row',
  gap: 'sm',
  align: 'center',
  children: [
    {
      id: 'deliveries-search',
      kind: 'input',
      inputType: 'search',
      placeholder: 'Find an event id',
    },
    {
      id: 'deliveries-status',
      kind: 'input',
      inputType: 'select',
      options: ['All statuses', 'Delivered', 'Retrying', 'Failed'],
    },
    { id: 'deliveries-retry', kind: 'button', label: 'Retry failed', variant: 'secondary' },
  ],
};

const metric = (id: string, label: string, value: string): WireframeNode => ({
  id: `metric-${id}`,
  kind: 'stack',
  direction: 'column',
  gap: 'sm',
  padding: 'sm',
  surface: true,
  children: [
    { id: `metric-${id}-label`, kind: 'text', text: label, variant: 'label' },
    { id: `metric-${id}-value`, kind: 'text', text: value, variant: 'title' },
  ],
});

const METRICS: WireframeNode = {
  id: 'deliveries-metrics',
  kind: 'grid',
  columns: 3,
  gap: 'sm',
  children: [
    metric('delivered', 'Delivered today', '18,402'),
    metric('retrying', 'Retrying', '37'),
    metric('latency', 'Median latency', '212 ms'),
  ],
};

const ROWS_V2: ReadonlyArray<ReadonlyArray<string>> = [
  ['evt_4Q2x', 'ledger-core /credits', 'Retrying', '14 min ago'],
  ['evt_4Q1m', 'payments-api /refunds', 'Delivered', '2 min ago'],
  ['evt_4Q0k', 'ledger-core /credits', 'Delivered', '3 min ago'],
  ['evt_4P9z', 'notify-relay /email', 'Failed', '6 min ago'],
  ['evt_4P8c', 'payments-api /payouts', 'Delivered', '9 min ago'],
];

const ATTEMPTS: ReadonlyArray<string> = ['6', '1', '1', '4', '1'];

const ROWS_V3: ReadonlyArray<ReadonlyArray<string>> = ROWS_V2.map((row, index) => [
  ...row.slice(0, 3),
  ATTEMPTS[index] ?? '1',
  ...row.slice(3),
]);

const table = (
  columns: ReadonlyArray<string>,
  rows: ReadonlyArray<ReadonlyArray<string>>,
): WireframeNode => ({
  id: 'deliveries-table',
  kind: 'table',
  columns,
  rows,
});

const TABLE_V2 = table(['Event', 'Endpoint', 'Status', 'Last try'], ROWS_V2);
const TABLE_V3 = table(['Event', 'Endpoint', 'Status', 'Attempts', 'Last try'], ROWS_V3);

const deliveriesScreen = (children: ReadonlyArray<WireframeNode>): WireframeScreen => ({
  id: 'deliveries',
  title: 'Deliveries',
  viewport: 'tablet',
  note: 'The on-call engineer lands here from the alert.',
  root: {
    id: 'deliveries-root',
    kind: 'stack',
    direction: 'column',
    gap: 'md',
    padding: 'md',
    children,
  },
});

const ENDPOINTS: WireframeScreen = {
  id: 'endpoints',
  title: 'Endpoints',
  viewport: 'tablet',
  root: {
    id: 'endpoints-root',
    kind: 'stack',
    direction: 'column',
    gap: 'md',
    padding: 'md',
    children: [
      { id: 'endpoints-title', kind: 'text', text: 'Endpoints', variant: 'title' },
      {
        id: 'endpoints-list',
        kind: 'list',
        items: [
          {
            id: 'endpoint-credits',
            title: 'ledger-core /credits',
            subtitle: 'Healthy, 99.8% delivered',
          },
          {
            id: 'endpoint-refunds',
            title: 'payments-api /refunds',
            subtitle: 'Healthy, 100% delivered',
          },
          { id: 'endpoint-email', title: 'notify-relay /email', subtitle: 'Degraded, 4 failing' },
        ],
      },
    ],
  },
};

const EVENT: WireframeScreen = {
  id: 'event',
  title: 'Delivery detail',
  viewport: 'tablet',
  root: {
    id: 'event-root',
    kind: 'stack',
    direction: 'column',
    gap: 'md',
    padding: 'md',
    children: [
      { id: 'event-title', kind: 'text', text: 'evt_4Q2x', variant: 'title' },
      {
        id: 'event-attempts',
        kind: 'table',
        columns: ['Try', 'Sent', 'Response'],
        rows: [
          ['1', '09:02:11', '504 after 30 s'],
          ['2', '09:03:12', '504 after 30 s'],
          ['3', '09:05:14', '504 after 30 s'],
        ],
      },
    ],
  },
};

const THEME: WireframeDocument['theme'] = {
  name: 'harborline-console',
  font: 'sans',
  radius: 'md',
  colors: {
    background: '#0f1115',
    surface: '#171a21',
    foreground: '#e7e9ee',
    muted: '#8a90a0',
    border: '#2a2f3a',
    accent: '#3d7cf4',
    accentForeground: '#ffffff',
    danger: '#e5534b',
  },
};

const documentOf = (children: ReadonlyArray<WireframeNode>): WireframeDocument => ({
  version: 2,
  initialScreenId: 'deliveries',
  theme: THEME,
  screens: [deliveriesScreen(children), EVENT, ENDPOINTS],
  transitions: [{ fromNodeId: 'nav-endpoints', toScreenId: 'endpoints', label: 'endpoints tab' }],
});

const V1 = documentOf([NAV, TITLE, FILTERS, TABLE_V2]);
const V2 = documentOf([NAV, TITLE, FILTERS, METRICS, TABLE_V2]);
const V3 = documentOf([NAV, TITLE, BANNER, FILTERS, METRICS, TABLE_V3]);

const source = (document: WireframeDocument): string => JSON.stringify(document, null, 2);

const VERSIONS: ReadonlyArray<WireframeVersion> = [
  {
    revision: 3,
    title: 'Deliveries screen',
    sourceText: source(V3),
    author: 'agent',
    ask: 'Flag a stuck delivery and show how many attempts each event took',
    createdAt: minutesAgo(6),
    summary: null,
  },
  {
    revision: 2,
    title: 'Deliveries screen',
    sourceText: source(V2),
    author: 'agent',
    ask: 'Add the delivery health numbers above the table',
    createdAt: minutesAgo(48),
    summary: null,
  },
  {
    revision: 1,
    title: 'Deliveries screen',
    sourceText: source(V1),
    author: 'agent',
    ask: null,
    createdAt: minutesAgo(95),
    summary: null,
  },
];

const ARTIFACT: WireframeArtifact = {
  id: ARTIFACT_ID,
  sessionId: SESSION.id,
  agentId: AGENT_ID,
  workflowRunId: null,
  kind: 'wireframe',
  schemaVersion: 1,
  title: 'Deliveries screen',
  sourceFormat: 'json',
  sourceText: source(V3),
  metadata: { fidelity: 'high', designProfile: { themeName: 'harborline-console' } },
  status: 'active',
  revision: 3,
  sourceTurnId: 'mock-brand-compare-turn',
  createdAt: minutesAgo(95),
  updatedAt: minutesAgo(6),
  openedAt: null,
};

export const BrandCompareScene = () => {
  const [isReady, setIsReady] = useState(false);
  const [isStaged, setIsStaged] = useState(false);

  useEffect(() => {
    seedContextBase({ lens: null, current: SESSION });
    setIsReady(true);
  }, []);

  useEffect(() => {
    if (isReady) {
      setIsStaged(true);
    }
  }, [isReady]);

  if (!isReady) {
    return null;
  }

  return (
    <ShellFrame
      session={SESSION}
      main={isStaged ? <CompareStage artifact={ARTIFACT} versions={VERSIONS} /> : null}
    />
  );
};
