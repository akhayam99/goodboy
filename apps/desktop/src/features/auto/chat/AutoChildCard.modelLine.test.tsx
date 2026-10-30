// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { AutoDelegation } from '@goodboy/db';
import { STORE_IMPORT_TIMEOUT_MS, importStore, resetStoryStore } from '../../../store/storyHarness';
import { aDelegation, FIXTURE_SESSION } from '../testing/autoViewFixtures';
import { AutoChildCard } from './AutoChildCard';
import { delegationCardOf } from './delegationCardOf';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

type ShowParams = {
  readonly delegation: AutoDelegation;
};

const show = ({ delegation }: ShowParams): HTMLElement => {
  const card = delegationCardOf({ delegation, childAgent: null });
  const { container } = render(
    <AutoChildCard
      sessionId={FIXTURE_SESSION}
      delegation={delegation}
      card={card}
      agent={null}
      name="Post one credit per retry"
      revision={null}
      onOpen={() => undefined}
    />,
  );
  const element = container.querySelector<HTMLElement>('[data-auto-child-card]');
  if (element === null) {
    throw new Error('no child card');
  }
  return element;
};

describe('the Auto child card model line', () => {
  it('says the model by name with its effort, never the routing id', () => {
    const card = show({
      delegation: aDelegation({
        key: 'impl',
        role: 'implementer',
        state: 'running',
        model: 'sonnet-5.5',
        effort: 'high',
      }),
    });

    const line = card.querySelector('[data-model-line]');
    expect(line?.textContent).toBe('Sonnet 5.5 High');
    expect(card.textContent).not.toContain('sonnet-5.5');
    expect(card.textContent).toContain('Implementer');
  });

  it('names an id the catalog lacks by its words and keeps the raw id for the tooltip only', async () => {
    const card = show({
      delegation: aDelegation({
        key: 'impl',
        role: 'implementer',
        state: 'running',
        model: 'ledger-core-1',
      }),
    });

    const line = card.querySelector('[data-model-line]');
    if (line === null) {
      throw new Error('no model line');
    }
    expect(line.textContent).toBe('Ledger Core 1');
    expect(card.textContent).not.toContain('ledger-core-1');

    fireEvent.mouseEnter(line);

    expect((await screen.findByRole('tooltip', undefined, { timeout: 2_000 })).textContent).toBe(
      'ledger-core-1',
    );
  });
});
