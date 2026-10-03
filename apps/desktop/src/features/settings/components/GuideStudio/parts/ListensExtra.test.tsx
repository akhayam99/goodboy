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

  it('lists the composer prefixes the composer reads, and no other', () => {
    render(<ListensExtra />);
    const composer = screen.getByText('In the composer').parentElement as HTMLElement;

    expect([...symbolsIn(composer)].sort()).toEqual(
      CHAT_PREFIXES.map((prefix) => prefix.symbol).sort(),
    );
  });

  it('lists the palette prefixes, with the workflow prefix on both sides', () => {
    render(<ListensExtra />);
    const palette = screen.getByText(`In ${shortcutGlyphs('palette.open')}`)
      .parentElement as HTMLElement;
    const composer = screen.getByText('In the composer').parentElement as HTMLElement;

    expect([...symbolsIn(palette)].sort()).toEqual(
      PREFIXES.filter((prefix) => prefix.group !== 'skill')
        .map((prefix) => prefix.symbol)
        .sort(),
    );
    expect(symbolsIn(palette)).toContain('~');
    expect(symbolsIn(composer)).toContain('~');
  });

  it('shows the list keys from the registry and the two kinds of field', () => {
    render(<ListensExtra />);
    const lists = within(band('In the Inbox and Notifications'));

    expect(lists.getByText('Next row')).toBeDefined();
    expect(lists.getByText('Star or unstar')).toBeDefined();
    expect(lists.getAllByText(shortcutGlyphs('list.search')).length).toBeGreaterThan(0);
    const fields = within(band('Two kinds of field'));
    expect(fields.getByText('Message')).toBeDefined();
    expect(fields.getByText('Document')).toBeDefined();
    expect(fields.getAllByText(shortcutGlyphs('composer.submit')).length).toBe(2);
  });
});
