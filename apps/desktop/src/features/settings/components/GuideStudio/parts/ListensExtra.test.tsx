// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { PREFIXES } from '../../../../quick-actions/grammar';
import { CHAT_PREFIXES } from '../../../../chat/components/ChatInput/lib';
import { shortcutGlyphs } from '../../../../../shared/keyboard/registry';
import { ACTION_VERBS } from '../../../../../shared/lib/interactionRules';
import { ListensExtra } from './ListensExtra';

afterEach(cleanup);

const band = (name: string): HTMLElement =>
  screen.getByRole('heading', { name }).closest('section') as HTMLElement;

const symbolsIn = (root: HTMLElement): ReadonlyArray<string> =>
  Array.from(root.querySelectorAll('kbd')).map((kbd) => kbd.textContent ?? '');

describe('ListensExtra', () => {
  it('reads one verb per intent from the rule constants', () => {
    render(<ListensExtra />);
    const verbs = within(band('One verb per intent'));

    for (const entry of ACTION_VERBS) {
      expect(verbs.getByText(entry.verb)).toBeDefined();
      expect(verbs.getByText(entry.meaning)).toBeDefined();
    }
  });

  it('lists every prefix once in one table, read from the registry', () => {
    render(<ListensExtra />);
    const table = screen.getByRole('table');

    expect(symbolsIn(table)).toEqual(PREFIXES.map((prefix) => prefix.symbol));
  });

  it('marks the composer column used for exactly the prefixes the composer reads', () => {
    render(<ListensExtra />);
    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1);
    const used = rows
      .filter((row) => within(row).queryAllByRole('cell')[1]?.textContent !== 'not used')
      .map((row) => row.querySelector('kbd')?.textContent ?? '');

    expect(used.sort()).toEqual(CHAT_PREFIXES.map((prefix) => prefix.symbol).sort());
  });

  it('gives a shared symbol one meaning on both surfaces', () => {
    render(<ListensExtra />);
    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1);
    const scripts = rows.find((row) => row.querySelector('kbd')?.textContent === '$');
    const cells = within(scripts as HTMLElement).getAllByRole('cell');

    expect(cells.map((cell) => cell.textContent)).toEqual(['Scripts', 'Scripts']);
  });

  it('shows the list keys from the registry and the two kinds of field', () => {
    render(<ListensExtra />);
    const lists = within(band('In Tasks and Notifications'));

    expect(lists.getByText('Next row')).toBeDefined();
    expect(lists.getByText('Star or unstar')).toBeDefined();
    expect(lists.getAllByText(shortcutGlyphs('list.search')).length).toBeGreaterThan(0);
    const fields = within(band('Two kinds of field'));
    expect(fields.getByText('Message')).toBeDefined();
    expect(fields.getByText('Document')).toBeDefined();
    expect(fields.getAllByText(shortcutGlyphs('composer.submit')).length).toBe(2);
  });
});
