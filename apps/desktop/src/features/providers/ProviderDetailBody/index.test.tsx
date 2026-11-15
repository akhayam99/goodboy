// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ProviderId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../store/storyHarness';
import { providerBudgetStatusFor } from '../../budget/testing/providerBudgetFixture';
import type { ProviderDisplayInfo } from '../providers';
import { ProviderDetailBody } from './index';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({
    provider_budget_overview: {
      status: providerBudgetStatusFor({ spentUsd: 84.2, capUsd: 200 }),
      periods: { todayUsd: 3.2, last7DaysUsd: 18.4, thisMonthUsd: 84.2 },
    },
    budget_rule_list: [],
  });
  useAppStore.setState({
    refreshProviders: vi.fn(async () => undefined),
    refreshClaudeUsage: vi.fn(async () => undefined),
    refreshCodexLimits: vi.fn(async () => undefined),
    authResults: {
      anthropic: { state: 'connected', identity: 'mara@harborline.dev', plan: 'max' },
    },
  });
});

afterEach(cleanup);

type InfoParams = {
  readonly id: ProviderId;
  readonly label: string;
  readonly connection?: ProviderDisplayInfo['connection'];
};

const infoOf = ({ id, label, connection = 'connected' }: InfoParams): ProviderDisplayInfo => ({
  id,
  label,
  binary: id,
  version: '2.1.296',
  connection,
  identity: 'mara@harborline.dev',
  error: null,
  docsUrl: 'https://docs.harborline.test',
  capabilities: { models: [] },
});

const CLAUDE = infoOf({ id: 'anthropic', label: 'Claude' });

const renderBody = ({ info }: { readonly info: ProviderDisplayInfo }) =>
  render(
    <ProviderDetailBody
      info={info}
      shouldAutoConnect={false}
      shouldAutoUpdate={false}
      isModelsFocused={false}
      workspaceId={null}
    />,
  );

const sectionNames = (): ReadonlyArray<string> =>
  screen
    .getAllByRole('region')
    .map((region) => region.getAttribute('aria-label') ?? '')
    .filter((name) =>
      ['Usage', 'Models in the picker', 'Account', 'What works with Claude'].includes(name),
    );

describe('the provider detail body', () => {
  it('puts Usage first, then Models in the picker, Account and What works last', () => {
    renderBody({ info: CLAUDE });

    expect(sectionNames()).toEqual([
      'Usage',
      'Models in the picker',
      'Account',
      'What works with Claude',
    ]);
  });

  it('scrolls to Usage when a link asked for the usage section', () => {
    const scrolled = vi.fn();
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrolled,
    });
    render(
      <ProviderDetailBody
        info={CLAUDE}
        shouldAutoConnect={false}
        shouldAutoUpdate={false}
        isModelsFocused={false}
        isUsageFocused
        workspaceId={null}
      />,
    );

    expect(scrolled).toHaveBeenCalledOnce();
    expect(scrolled.mock.contexts[0]).toBe(document.getElementById('provider-usage'));
  });

  it('keeps the permissions closed until asked, with the count of modes that work fully', () => {
    renderBody({ info: CLAUDE });

    const fold = within(screen.getByRole('region', { name: 'What works with Claude' }));
    const toggle = fold.getByRole('button', { name: 'What works with Claude' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fold.getByText('4 of 6 work fully');

    fireEvent.click(toggle);

    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    fold.getByText('Allow and Deny rules reach Claude as allowed and blocked tools.');
  });

  it('counts fewer full modes for a provider that does not follow rules', () => {
    renderBody({ info: infoOf({ id: 'codex', label: 'Codex' }) });

    const fold = within(screen.getByRole('region', { name: 'What works with Codex' }));
    fold.getByText('1 of 6 work fully');
  });

  it('reads the plan, the account and the cli version as facts under the title', () => {
    renderBody({ info: CLAUDE });

    const facts = within(screen.getByRole('list', { name: 'Claude facts' }));
    expect(facts.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Max plan',
      'mara@harborline.dev',
      'Claude CLI 2.1.296',
    ]);
    screen.getByRole('heading', { level: 1, name: 'Claude' });
    screen.getByText('Signed in');
  });

  it('turns a provider that is not installed into its setup path', () => {
    renderBody({ info: infoOf({ id: 'gemini', label: 'Gemini', connection: 'missing' }) });

    screen.getByText('Not set up');
    expect(screen.queryByRole('region', { name: 'Usage' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'What works with Gemini' })).toBeNull();
  });
});
