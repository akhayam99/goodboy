// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../store/storyHarness';
import { TurnFooterDetail } from './TurnFooterDetail';
import type { TurnFooterData } from './useTurnFooter';

const FULL: TurnFooterData = {
  provider: 'anthropic',
  model: 'claude-opus-5-5',
  effort: 'high',
  inputTokens: 4200,
  outputTokens: 3180,
  cachedInputTokens: 86400,
  cacheCreationInputTokens: 9100,
  contextTokens: 12400,
  estimatedCostUsd: 0.07,
};

const NO_CACHE: TurnFooterData = {
  ...FULL,
  cachedInputTokens: 0,
  cacheCreationInputTokens: 0,
};

const NO_USAGE: TurnFooterData = {
  ...FULL,
  inputTokens: 0,
  outputTokens: 0,
  cachedInputTokens: 0,
  cacheCreationInputTokens: 0,
  contextTokens: null,
  estimatedCostUsd: null,
};

type MountParams = {
  readonly data: TurnFooterData;
};

const mount = ({ data }: MountParams) =>
  render(<TurnFooterDetail data={data} duration={null} startedAt={null} endedAt={null} />);

type ValueParams = {
  readonly label: string;
};

const valueOf = ({ label }: ValueParams): HTMLElement => {
  const term = screen.getByText(label);
  const value = term.nextElementSibling;
  if (!(value instanceof HTMLElement)) {
    throw new Error(`no value beside ${label}`);
  }
  return value;
};

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

describe('TurnFooterDetail', () => {
  it('lays full usage out as label and value pairs with every number present', () => {
    mount({ data: FULL });
    expect(valueOf({ label: 'Input' }).textContent).toBe('99,700');
    expect(valueOf({ label: 'from cache' }).textContent).toBe('86,400 · 87%');
    expect(valueOf({ label: 'cache write' }).textContent).toBe('9,100');
    expect(valueOf({ label: 'Output' }).textContent).toBe('3,180');
    expect(valueOf({ label: 'Context window' }).textContent).toMatch(/^12\.4k of .+ · \d+%$/);
    expect(valueOf({ label: 'Cost' }).textContent).toBe('~$0.07');
    screen.getByText('Cost estimated at API prices');
    expect(screen.getByText('Input').closest('dl')).not.toBeNull();
  });

  it('shows zero cache as a real number and leaves the cache write row out', () => {
    mount({ data: NO_CACHE });
    expect(valueOf({ label: 'from cache' }).textContent).toBe('0 · 0%');
    expect(screen.queryByText('cache write')).toBeNull();
  });

  it('shows a dash with the reason for an agent with no usage yet', () => {
    mount({ data: NO_USAGE });
    const input = valueOf({ label: 'Input' });
    expect(within(input).getByText('-').getAttribute('aria-hidden')).toBe('true');
    within(input).getByText('no usage reported yet');
    within(valueOf({ label: 'Output' })).getByText('no usage reported yet');
    within(valueOf({ label: 'Cost' })).getByText('no cost estimate yet');
    expect(screen.queryByText('from cache')).toBeNull();
  });

  it('names a missing context size instead of leaving the value blank', () => {
    mount({ data: { ...FULL, contextTokens: null } });
    within(valueOf({ label: 'Context window' })).getByText('context size not reported yet');
  });

  it('wraps a long model title inside the card instead of widening it', () => {
    const title = 'claude-opus-5-5-extended-context-preview-for-long-running-agents';
    const { container } = mount({ data: { ...FULL, model: title } });
    const heading = container.querySelector('.break-words');
    expect(heading?.textContent).toContain('Extended Context Preview For Long Running Agents');
    expect(heading?.nextElementSibling?.tagName).toBe('DL');
  });

  it('names the share of the model context window a turn filled', () => {
    mount({ data: { ...FULL, contextTokens: 50000, model: 'claude-opus-5-5' } });
    expect(screen.getByText('Context window')).toBeDefined();
    expect(valueOf({ label: 'Context window' }).textContent).toMatch(/%$/);
  });

  it('leaves the context window row out when the model reports none', () => {
    mount({ data: { ...FULL, model: null } });
    expect(screen.queryByText('Context window')).toBeNull();
  });
});
