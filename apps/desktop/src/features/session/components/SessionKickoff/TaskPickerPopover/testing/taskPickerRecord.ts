import type { InboxRecord } from '../../../../../inbox/types';

type Params = {
  readonly provider: 'linear' | 'github' | 'sentry';
  readonly id: string;
  readonly title: string;
  readonly updatedAt: string;
  readonly state?: InboxRecord['state'];
  readonly stateLabel?: string;
  readonly context?: string;
};

export const taskPickerRecord = ({
  provider,
  id,
  title,
  updatedAt,
  state = 'open',
  stateLabel = 'Todo',
  context = 'ledger-core',
}: Params): InboxRecord => {
  const url = `https://example.invalid/${provider}/${id}`;
  const base = {
    key: `${provider}:${id}`,
    identifier: id,
    title,
    state,
    stateLabel,
    updatedAt,
    url,
    context,
  };
  if (provider === 'linear') {
    return {
      ...base,
      provider,
      kind: 'issue',
      payload: {
        provider,
        kind: 'issue',
        sessionId: null,
        issue: {
          id: `linear-${id}`,
          identifier: id,
          title,
          description: null,
          url,
          state: { name: stateLabel, type: 'unstarted' },
          team: { key: id.split('-')[0] ?? 'HBL' },
          updatedAt,
        },
      },
    };
  }
  if (provider === 'github') {
    return {
      ...base,
      provider,
      kind: 'issue',
      payload: {
        provider,
        kind: 'issue',
        sessionId: null,
        issue: {
          number: Number(id.replace('#', '')),
          title,
          body: '',
          url,
          state: 'OPEN',
          labels: [],
          updatedAt,
        },
      },
    };
  }
  return {
    ...base,
    provider,
    kind: 'error',
    payload: {
      provider,
      kind: 'error',
      sessionId: null,
      issue: {
        id: `sentry-${id}`,
        project: null,
        shortId: id,
        title,
        culprit: context,
        level: 'error',
        status: 'unresolved',
        count: '3',
        userCount: 1,
        firstSeen: updatedAt,
        lastSeen: updatedAt,
        permalink: url,
        metadata: null,
      },
    },
  };
};
