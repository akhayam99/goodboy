// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { IsoDateTime, StarredIssue, WorkspaceId } from '@goodboy/types';
import { placeholderRecordOf } from './placeholderRecordOf';

const WORKSPACE = 'ws-harborline' as WorkspaceId;
const NOW = '2026-09-27T10:00:00.000Z' as IsoDateTime;

const star = (patch: Partial<StarredIssue>): StarredIssue => ({
  workspaceId: WORKSPACE,
  provider: 'linear',
  externalId: 'lin-1',
  identifier: 'CAS-231',
  container: null,
  title: 'Settle the month close',
  url: 'https://linear.app/cascadia/issue/CAS-231',
  state: 'open',
  stateLabel: 'Todo',
  starredAt: NOW,
  refreshedAt: null,
  ...patch,
});

describe('placeholderRecordOf', () => {
  it('builds a selectable Linear record from the snapshot', () => {
    const record = placeholderRecordOf(star({}));
    expect(record?.provider).toBe('linear');
    expect(record?.identifier).toBe('CAS-231');
    expect(record?.title).toBe('Settle the month close');
    expect(record?.url).toBe('https://linear.app/cascadia/issue/CAS-231');
    expect(record?.state).toBe('open');
  });

  it('builds a selectable Jira record from the snapshot', () => {
    const record = placeholderRecordOf(
      star({ provider: 'jira', externalId: 'j-9', identifier: 'NW-142', state: 'active' }),
    );
    expect(record?.provider).toBe('jira');
    expect(record?.identifier).toBe('NW-142');
    expect(record?.state).toBe('active');
  });

  it('recovers the issue number for a GitHub star', () => {
    const record = placeholderRecordOf(
      star({
        provider: 'github',
        externalId: 'acme/storefront-web#482',
        identifier: 'storefront-web #482',
        container: 'acme/storefront-web',
      }),
    );
    expect(record?.provider).toBe('github');
    expect(record?.payload).toMatchObject({ issue: { number: 482 } });
    expect(record?.context).toBe('storefront-web');
  });

  it('recovers the project path and iid for a GitLab star', () => {
    const record = placeholderRecordOf(
      star({
        provider: 'gitlab',
        externalId: '501',
        identifier: 'payments/api#12',
        container: 'payments/api',
      }),
    );
    expect(record?.provider).toBe('gitlab');
    expect(record?.payload).toMatchObject({ issue: { iid: 12, id: 501 } });
  });

  it('builds a selectable Sentry record from the snapshot', () => {
    const record = placeholderRecordOf(
      star({ provider: 'sentry', externalId: '91', identifier: 'NOTIFY-3F' }),
    );
    expect(record?.provider).toBe('sentry');
    expect(record?.kind).toBe('error');
  });

  it('maps a missing star to the alert state', () => {
    const record = placeholderRecordOf(star({ state: 'missing' }));
    expect(record?.state).toBe('alert');
  });
});
