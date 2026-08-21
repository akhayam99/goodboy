// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { SessionExternalTaskProvider, WorkspaceId } from '@goodboy/types';
import type { IssueCandidate } from '../../../integrations/fetchIssueCandidates';
import type { IssueSource } from '../../../integrations/issueSources';

const { candidates, load } = vi.hoisted(() => ({
  candidates: { byProvider: {} as Record<string, ReadonlyArray<unknown>>, asked: [] as string[] },
  load: vi.fn(),
}));

vi.mock('../../../integrations/hooks/useIssueCandidates', () => ({
  useIssueCandidates: ({ provider }: { provider: SessionExternalTaskProvider }) => {
    candidates.asked.push(provider);
    return {
      rows: candidates.byProvider[provider] ?? [],
      isLoading: false,
      isLoaded: true,
      error: null,
      load,
    };
  },
}));

vi.mock('../../../../shared/lib/editor', () => ({ openUrl: vi.fn() }));

import { IssueSourceField } from './IssueSourceField';

const WORKSPACE_ID = 'workspace-1' as WorkspaceId;

const SOURCES: ReadonlyArray<IssueSource> = [
  { provider: 'linear', label: 'Linear' },
  { provider: 'github', label: 'GitHub' },
];

const LINEAR_ISSUE: IssueCandidate = {
  provider: 'linear',
  externalId: 'lin-1',
  identifier: 'ENG-1',
  title: 'Extract token validation',
  url: 'https://linear.app/acme/issue/ENG-1',
  goal: 'Extract token validation into a shared module.',
  branchSlug: 'extract-token-validation',
};

const GITHUB_ISSUE: IssueCandidate = {
  provider: 'github',
  externalId: '42',
  identifier: '#42',
  title: 'Retry the payment webhook',
  url: 'https://github.com/acme/web/issues/42',
  goal: 'Retry the payment webhook.',
  branchSlug: 'retry-payment-webhook',
};

type RenderParams = {
  readonly values?: ReadonlyArray<IssueCandidate>;
  readonly onPick?: (candidate: IssueCandidate) => void;
  readonly onRemove?: (candidate: IssueCandidate) => void;
};

const renderField = ({ values = [], onPick = vi.fn(), onRemove = vi.fn() }: RenderParams = {}) =>
  render(
    <IssueSourceField
      workspaceId={WORKSPACE_ID}
      sources={SOURCES}
      values={values}
      disabled={false}
      onPick={onPick}
      onRemove={onRemove}
    />,
  );

beforeEach(() => {
  candidates.byProvider = { linear: [LINEAR_ISSUE], github: [GITHUB_ISSUE] };
  candidates.asked = [];
  load.mockClear();
});

afterEach(cleanup);

describe('IssueSourceField', () => {
  it('keeps the picker open for another task once one is linked', () => {
    renderField({ values: [LINEAR_ISSUE] });

    const group = screen.getByTestId('new-session-linked-tasks');
    expect(within(group).getByText('Extract token validation')).toBeDefined();
    expect(screen.getByRole('combobox').getAttribute('placeholder')).toContain('to add another');
  });

  it('lists every linked task with its own remove control', () => {
    const onRemove = vi.fn();
    renderField({ values: [LINEAR_ISSUE, GITHUB_ISSUE], onRemove });

    const group = screen.getByTestId('new-session-linked-tasks');
    expect(within(group).getByText('Extract token validation')).toBeDefined();
    expect(within(group).getByText('Retry the payment webhook')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Remove #42' }));

    expect(onRemove).toHaveBeenCalledWith(GITHUB_ISSUE);
  });

  it('adds a pick instead of replacing what is already linked', () => {
    const onPick = vi.fn();
    renderField({ values: [GITHUB_ISSUE], onPick });

    fireEvent.focus(screen.getByRole('combobox'));
    fireEvent.mouseDown(screen.getByRole('option', { name: /Extract token validation/ }));

    expect(onPick).toHaveBeenCalledWith(LINEAR_ISSUE);
  });

  it('clears the search text after a pick so the next one starts fresh', () => {
    renderField();

    fireEvent.focus(screen.getByRole('combobox'));
    fireEvent.mouseDown(screen.getByRole('option', { name: /Extract token validation/ }));

    expect((screen.getByRole('combobox') as HTMLInputElement).value).toBe('');
  });

  it('switches what the picker browses without dropping the tasks already picked', () => {
    const onRemove = vi.fn();
    renderField({ values: [LINEAR_ISSUE], onRemove });

    fireEvent.click(screen.getByRole('tab', { name: /GitHub/ }));

    expect(onRemove).not.toHaveBeenCalled();
    expect(candidates.asked.at(-1)).toBe('github');
    expect(
      within(screen.getByTestId('new-session-linked-tasks')).getByText('Extract token validation'),
    ).toBeDefined();
  });
});
