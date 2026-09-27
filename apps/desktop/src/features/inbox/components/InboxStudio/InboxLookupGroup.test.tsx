// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { WorkspaceIssueLookup } from '../../../integrations/hooks/useWorkspaceIssueLookup';
import type { LookupHit } from '../../../integrations/issueCode/lookupIssueByCode';

const { openToolSettings } = vi.hoisted(() => ({ openToolSettings: vi.fn() }));
vi.mock('../../../integrations/openToolSettings', () => ({ openToolSettings }));

import { InboxLookupGroup } from './InboxLookupGroup';

afterEach(cleanup);

const hit = {
  target: { provider: 'linear', identifier: 'CAS-231' },
  candidate: {},
  record: {
    key: 'linear:issue:1',
    provider: 'linear',
    kind: 'issue',
    identifier: 'CAS-231',
    title: 'Settle the month close',
    state: 'open',
    stateLabel: 'Todo',
    updatedAt: '2026-09-20T10:00:00Z',
    url: 'https://linear.app/cascadia/issue/CAS-231',
    context: 'Cascadia',
    payload: {},
  },
} as unknown as LookupHit;

const lookup = (patch: Partial<WorkspaceIssueLookup>): WorkspaceIssueLookup => ({
  code: 'CAS-231',
  state: { status: 'idle' },
  retry: vi.fn(),
  ...patch,
});

describe('InboxLookupGroup', () => {
  it('says it is looking up the code', () => {
    render(
      <InboxLookupGroup
        lookup={lookup({ state: { status: 'loading', key: 'CAS-231#0' } })}
        workspaceName="Harborline"
        selectedKey={null}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByText('Not in your inbox')).toBeDefined();
    expect(screen.getByText('Looking up CAS-231')).toBeDefined();
  });

  it('lists a hit and opens it on click', () => {
    const onSelect = vi.fn();
    render(
      <InboxLookupGroup
        lookup={lookup({
          state: {
            status: 'done',
            key: 'CAS-231#0',
            value: {
              route: { kind: 'lookup', label: 'CAS-231', targets: [hit.target] },
              result: { hits: [hit], misses: [] },
            },
          },
        })}
        workspaceName="Harborline"
        selectedKey={null}
        onSelect={onSelect}
      />,
    );

    fireEvent.click(screen.getByRole('option', { name: /CAS-231 Settle the month close/ }));

    expect(onSelect).toHaveBeenCalledWith(hit);
  });

  it('offers Sign in again for a rejected key and Try again for a network failure', () => {
    const retry = vi.fn();
    render(
      <InboxLookupGroup
        lookup={lookup({
          retry,
          state: {
            status: 'done',
            key: 'CAS-231#0',
            value: {
              route: {
                kind: 'lookup',
                label: 'CAS-231',
                targets: [
                  { provider: 'linear', identifier: 'CAS-231' },
                  { provider: 'jira', key: 'CAS-231' },
                ],
              },
              result: {
                hits: [],
                misses: [
                  {
                    target: { provider: 'linear', identifier: 'CAS-231' },
                    failure: 'unauthorized',
                  },
                  { target: { provider: 'jira', key: 'CAS-231' }, failure: 'unreachable' },
                ],
              },
            },
          },
        })}
        workspaceName="Harborline"
        selectedKey={null}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByText('Linear stopped accepting your key.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Sign in again' }));
    expect(openToolSettings).toHaveBeenCalledWith({ tool: 'linear' });
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalled();
  });

  it('says which tracker to connect, and when no repo can answer #N', () => {
    const { rerender } = render(
      <InboxLookupGroup
        lookup={lookup({
          state: {
            status: 'done',
            key: 'CAS-231#0',
            value: {
              route: { kind: 'not-connected', label: 'CAS-231', providers: ['linear', 'jira'] },
              result: { hits: [], misses: [] },
            },
          },
        })}
        workspaceName="Harborline"
        selectedKey={null}
        onSelect={vi.fn()}
      />,
    );
    expect(
      screen.getByText('CAS-231 looks like a Linear or Jira issue. Connect one to look it up.'),
    ).toBeDefined();

    rerender(
      <InboxLookupGroup
        lookup={lookup({
          code: '#482',
          state: {
            status: 'done',
            key: '#482#0',
            value: { route: { kind: 'no-repo', label: '#482' }, result: { hits: [], misses: [] } },
          },
        })}
        workspaceName="Harborline"
        selectedKey={null}
        onSelect={vi.fn()}
      />,
    );
    expect(
      screen.getByText('No GitHub or GitLab repository in Harborline to look up #482.'),
    ).toBeDefined();
  });

  it('folds two not-found answers into one line', () => {
    render(
      <InboxLookupGroup
        lookup={lookup({
          code: 'CAS-990',
          state: {
            status: 'done',
            key: 'CAS-990#0',
            value: {
              route: {
                kind: 'lookup',
                label: 'CAS-990',
                targets: [
                  { provider: 'linear', identifier: 'CAS-990' },
                  { provider: 'jira', key: 'CAS-990' },
                ],
              },
              result: {
                hits: [],
                misses: [
                  { target: { provider: 'linear', identifier: 'CAS-990' }, failure: 'not-found' },
                  { target: { provider: 'jira', key: 'CAS-990' }, failure: 'not-found' },
                ],
              },
            },
          },
        })}
        workspaceName="Harborline"
        selectedKey={null}
        onSelect={vi.fn()}
      />,
    );

    expect(
      screen.getByText("CAS-990 isn't in Linear and Jira, or your keys can't see it."),
    ).toBeDefined();
  });
});
