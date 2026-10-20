// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { runA11yCheck } from '../../../../../__tests__/a11y/utils';
import { MOCK_SCENES } from '../..';
import { U26_P23_SCENES } from './p23';

const WAIT = { timeout: 15_000 };

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

type MountParams = {
  readonly id: string;
};

const mount = ({ id }: MountParams) => {
  const Scene = U26_P23_SCENES[id];
  if (Scene === undefined) {
    throw new Error(`no scene ${id}`);
  }
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

type OptionParams = {
  readonly name: RegExp;
};

const optionNamed = async ({ name }: OptionParams): Promise<HTMLElement> => {
  const list = await screen.findByRole('listbox', { name: 'Presets' }, WAIT);
  await waitFor(() => expect(within(list).getAllByRole('option').length).toBe(3), WAIT);
  const option = within(list)
    .getAllByRole('option')
    .find((candidate) => name.test(candidate.textContent ?? ''));
  if (option === undefined) {
    throw new Error(`no option ${name}`);
  }
  return option;
};

const glyphsOf = ({ option }: { readonly option: HTMLElement }): ReadonlyArray<HTMLElement> => [
  ...option.querySelectorAll<HTMLElement>('[data-preset-glyph]'),
];

type GlyphAtParams = {
  readonly option: HTMLElement;
  readonly index: number;
};

const glyphAt = ({ option, index }: GlyphAtParams): HTMLElement => {
  const glyph = glyphsOf({ option })[index];
  if (glyph === undefined) {
    throw new Error(`no glyph ${index}`);
  }
  return glyph;
};

const settled = () =>
  waitFor(() => expect(document.querySelector('[data-testid="fact-card"]')).not.toBeNull(), WAIT);

const roleOf = ({ glyph }: { readonly glyph: HTMLElement }): string | null =>
  glyph.getAttribute('data-step-role');

const card = (): HTMLElement => {
  const found = document.querySelector<HTMLElement>('[data-testid="fact-card"]');
  if (found === null) {
    throw new Error('no card');
  }
  return found;
};

describe('the u26 p23 preset picker scenes', () => {
  it('registers a dark and a light shot', () => {
    expect(Object.keys(U26_P23_SCENES)).toEqual([
      'p23-preset-picker-dark',
      'p23-preset-picker-light',
    ]);
    for (const [id, Scene] of Object.entries(U26_P23_SCENES)) {
      expect(MOCK_SCENES[id]).toBe(Scene);
    }
  });

  it('draws one role glyph per step in step order and no provider mark', async () => {
    mount({ id: 'p23-preset-picker-dark' });

    const plan = await optionNamed({ name: /Scout, plan, build/ });
    expect(glyphsOf({ option: plan }).map((glyph) => roleOf({ glyph }))).toEqual([
      'scout',
      'planner',
      'implementer',
    ]);
    const fix = await optionNamed({ name: /Fix and verify/ });
    expect(glyphsOf({ option: fix }).map((glyph) => roleOf({ glyph }))).toEqual([
      'debugger',
      'tester',
      'reviewer',
    ]);
    expect(document.querySelector('[data-step-mark]')).toBeNull();
    expect(
      within(plan).getByRole('group', { name: 'Steps: Scout, Planner, Implementer' }),
    ).toBeDefined();
  });

  it('shows five glyphs and a +n that names the rest when a preset has more steps', async () => {
    mount({ id: 'p23-preset-picker-dark' });

    const train = await optionNamed({ name: /Full release train/ });
    const glyphs = glyphsOf({ option: train });
    expect(glyphs.filter((glyph) => roleOf({ glyph }) !== null)).toHaveLength(5);
    const more = train.querySelector<HTMLElement>('[data-step-more]');
    expect(more?.textContent).toBe('+2');
    expect(more?.getAttribute('aria-label')).toBe('2 more steps: Docs, Reviewer');
    expect(glyphs.at(-1)).toBe(more);
  });

  it('opens a card with the facts of the focused step', async () => {
    mount({ id: 'p23-preset-picker-light' });

    await waitFor(
      () => expect(document.querySelector('[data-testid="fact-card"]')).not.toBeNull(),
      WAIT,
    );
    const facts = within(card());
    expect(facts.getByText('Planner')).toBeDefined();
    expect(facts.getByText('Step 2 of 3')).toBeDefined();
    expect(facts.getByText('Model')).toBeDefined();
    expect(facts.getByText('Effort')).toBeDefined();
    expect(facts.getByText('High')).toBeDefined();
    expect(card().textContent).toContain('write a plan that makes each credit post idempotent');
    expect(facts.getByText('Instruction')).toBeDefined();
    expect(facts.getByText('Hands on')).toBeDefined();
    expect(facts.getByText('a plan artifact, ready to consume')).toBeDefined();
  });

  it('names the step, the role and the model on each glyph for assistive tech', async () => {
    mount({ id: 'p23-preset-picker-dark' });

    const fix = await optionNamed({ name: /Fix and verify/ });
    const labels = glyphsOf({ option: fix }).map((glyph) => glyph.getAttribute('aria-label'));
    expect(labels[0]).toMatch(/^Step 1 of 3 Debugger · .+/);
    expect(labels[1]).toMatch(/^Step 2 of 3 Tester · .+/);
    expect(labels[2]).toMatch(/^Step 3 of 3 Reviewer · .+/);
  });

  it('reaches the glyphs by keyboard, opens the card on focus and walks back to the list', async () => {
    mount({ id: 'p23-preset-picker-dark' });

    const list = await screen.findByRole('listbox', { name: 'Presets' }, WAIT);
    const plan = await optionNamed({ name: /Scout, plan, build/ });
    await settled();
    const scout = glyphAt({ option: plan, index: 0 });
    const planner = glyphAt({ option: plan, index: 1 });
    list.focus();
    fireEvent.keyDown(list, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(scout);
    await waitFor(() => expect(within(card()).getByText('Step 1 of 3')).toBeDefined(), WAIT);

    fireEvent.keyDown(scout, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(planner);
    await waitFor(() => expect(within(card()).getByText('Step 2 of 3')).toBeDefined(), WAIT);

    fireEvent.keyDown(planner, { key: 'Home' });
    expect(document.activeElement).toBe(scout);
    fireEvent.keyDown(scout, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(list);
  });

  it('gives the list back on ArrowDown from a glyph and moves the active row', async () => {
    mount({ id: 'p23-preset-picker-dark' });

    const list = await screen.findByRole('listbox', { name: 'Presets' }, WAIT);
    const plan = await optionNamed({ name: /Scout, plan, build/ });
    await settled();
    const scout = glyphAt({ option: plan, index: 0 });
    list.focus();
    fireEvent.keyDown(list, { key: 'ArrowRight' });
    fireEvent.keyDown(scout, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(list);
    await waitFor(() => {
      const active = within(list)
        .getAllByRole('option')
        .findIndex((option) => option.getAttribute('data-active') === 'true');
      expect(active).toBe(1);
    });
  });

  it.each(['p23-preset-picker-dark', 'p23-preset-picker-light'])(
    '%s has no accessibility violation',
    async (id) => {
      const { container } = mount({ id });
      await optionNamed({ name: /Scout, plan, build/ });

      await runA11yCheck(container);
    },
    30_000,
  );
});
