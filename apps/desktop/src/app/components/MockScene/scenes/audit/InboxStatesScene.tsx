import { useEffect, useState } from 'react';
import { mockIPC } from '@tauri-apps/api/mocks';
import type {
  IntegrationBinding,
  IntegrationBindingId,
  IntegrationCredentialId,
  IsoDateTime,
} from '@goodboy/types';
import { InboxStudio } from '../../../../../features/inbox/components/InboxStudio';
import { useAppStore } from '../../../../../store';
import { ShellFrame, seedShellChrome } from '../shellChrome';
import { SESSION, SESSION_ID, seedArtifactScene } from '../artifactSeed';
import { payloadStrings } from './ipcPayload';
import { sceneParam } from './sceneParams';
import { useSceneClicks } from './useSceneClicks';

const noop = () => undefined;

const VARIANT = sceneParam({ key: 'v' }) ?? 'populated';
const SELECT = sceneParam({ key: 'select' });
const SELECT_LABELS: ReadonlyArray<string> = SELECT === null ? [] : [SELECT];

const NOW = '2026-09-14T16:40:00.000Z' as IsoDateTime;

const ISSUES = [
  {
    number: 412,
    title: 'Settlement export drops the last cent on split batches',
    body: 'Northwind finance reports that the monthly export is one cent short whenever a batch is split across three postings.',
    url: 'https://example.invalid/harborline/ledger-core/issues/412',
    state: 'OPEN',
    labels: [{ name: 'bug' }, { name: 'finance' }],
    assignees: [{ login: 'finance-lead' }],
    updatedAt: '2026-09-14T15:58:00.000Z',
  },
  {
    number: 409,
    title: 'notify-relay retries settled batches after a 429',
    body: 'The relay keeps retrying once a batch is settled, which burns the Acme rate limit budget.',
    url: 'https://example.invalid/harborline/ledger-core/issues/409',
    state: 'OPEN',
    labels: [{ name: 'reliability' }],
    assignees: [{ login: 'finance-lead' }],
    updatedAt: '2026-09-13T10:12:00.000Z',
  },
  {
    number: 388,
    title: 'Add a dry run flag to the payout backfill',
    body: '',
    url: 'https://example.invalid/harborline/ledger-core/issues/388',
    state: 'OPEN',
    labels: [],
    assignees: [{ login: 'finance-lead' }],
    updatedAt: '2026-09-02T08:40:00.000Z',
  },
  {
    number: 351,
    title: 'payments-api returns 500 when the invoice has no currency',
    body: 'Seen twice this week in the Harborline staging tenant.',
    url: 'https://example.invalid/harborline/ledger-core/issues/351',
    state: 'OPEN',
    labels: [{ name: 'bug' }],
    assignees: [{ login: 'finance-lead' }],
    updatedAt: '2026-08-18T12:00:00.000Z',
  },
];

const SENTRY_BINDING: IntegrationBinding = {
  id: 'mock-inbox-binding-sentry' as IntegrationBindingId,
  workspaceId: SESSION.workspaceId,
  projectId: null,
  credentialId: 'mock-inbox-credential-sentry' as IntegrationCredentialId,
  provider: 'sentry',
  config: { org: 'harborline', project: 'payments-api' },
  createdAt: NOW,
  updatedAt: NOW,
};

type GhParams = {
  readonly args: ReadonlyArray<string>;
};

const ghStdout = ({ args }: GhParams): string => {
  if (args[0] === 'repo') {
    return 'harborline/ledger-core\n';
  }
  if (args[0] === 'issue' && args[1] === 'list') {
    return JSON.stringify(VARIANT === 'empty' ? [] : ISSUES);
  }
  if (args[0] === 'issue' && args[1] === 'view') {
    const number = Number(args[2]);
    const issue = ISSUES.find((candidate) => candidate.number === number) ?? ISSUES[0];
    return JSON.stringify({ ...issue, comments: [] });
  }
  return '[]';
};

const installIpc = (): void => {
  mockIPC((cmd, payload) => {
    if (cmd === 'gh_run') {
      if (VARIANT === 'loading') {
        return new Promise(noop);
      }
      const args = payloadStrings({ payload, key: 'args' });
      return { stdout: ghStdout({ args }), stderr: '', exitCode: 0 };
    }
    if (cmd.startsWith('sentry_')) {
      throw new Error('Sentry answered 401: the auth token for harborline was revoked');
    }
    return null;
  });
};

export const InboxScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    installIpc();
    seedArtifactScene({ focusedArtifactId: null });
    seedShellChrome({
      session: SESSION,
      siblings: [],
      branches: { [SESSION_ID]: 'nw/fix-posting-rounding' },
      telemetryAt: NOW,
      lens: 'plans',
    });
    useAppStore.setState({
      workspaceIntegrations: {
        [SESSION.workspaceId]: VARIANT === 'error' ? [SENTRY_BINDING] : [],
      },
    });
    setIsReady(true);
  }, []);

  useSceneClicks({
    isReady,
    labels: SELECT_LABELS,
    selector: '[role="option"], button',
    match: 'contains',
    intervalMs: 200,
  });

  if (!isReady) {
    return null;
  }

  return (
    <ShellFrame
      session={SESSION}
      main={
        <InboxStudio
          workspaceId={SESSION.workspaceId}
          rootPath="/mock/harborline/ledger-core"
          onClose={noop}
        />
      }
    />
  );
};
