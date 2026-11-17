import { describe, expect, it } from 'vitest';
import { commentScopeOf } from './commentScopeOf';

const PAGE = 'src/routes/ledger/LedgerPage.tsx';

const HEADER =
  'This header should live in the layout, not in the page. Follow the payouts route as the model: AppLayout owns the header, the page only passes the title and actions. Write new components for this, do not touch the legacy LedgerHeader.';

describe('commentScopeOf marks a comment broad on two signs, never on one', () => {
  it('marks the layout rethink broad: a model, new components and other places named', () => {
    expect(commentScopeOf({ body: HEADER, path: PAGE })).toEqual({
      isBroad: true,
      signs: ['rethink', 'places'],
      places: ['the payouts route', 'AppLayout', 'LedgerHeader'],
    });
  });

  it('reads the Italian verbs too', () => {
    const scope = commentScopeOf({
      body: 'Riscrivi questa pagina come fa PayoutsPage, con nuovi componenti.',
      path: PAGE,
    });
    expect(scope.isBroad).toBe(true);
    expect(scope.signs).toEqual(['rethink', 'places']);
  });

  it('keeps move this import small, even when it names the target file', () => {
    expect(commentScopeOf({ body: 'Move this import into utils/format.ts.', path: PAGE })).toEqual({
      isBroad: false,
      signs: ['places'],
      places: ['utils/format.ts'],
    });
    expect(commentScopeOf({ body: 'move this import', path: PAGE }).signs).toEqual([]);
    expect(
      commentScopeOf({ body: 'Sposta questa riga nel blocco sopra.', path: PAGE }).signs,
    ).toEqual([]);
  });

  it('keeps a typo, a rename and a single rethink verb small', () => {
    expect(
      commentScopeOf({ body: 'Typo: "recieved" in the empty state copy.', path: PAGE }).isBroad,
    ).toBe(false);
    expect(
      commentScopeOf({ body: 'Rename LedgerRow to LedgerListRow.', path: PAGE }).signs,
    ).toEqual(['places']);
    expect(
      commentScopeOf({ body: 'Rewrite this check, it reads twice.', path: PAGE }).signs,
    ).toEqual(['rethink']);
  });

  it('does not count the file the comment sits on as another place', () => {
    const scope = commentScopeOf({
      body: 'LedgerPage.tsx should not import the totals; LedgerPage stays thin. Rethink it.',
      path: PAGE,
    });
    expect(scope.places).toEqual([]);
    expect(scope.isBroad).toBe(false);
  });

  it('counts a long comment as one sign, and broad with a model named', () => {
    const long = `${'The totals drift when a payout is refunded twice. '.repeat(9)}`;
    expect(commentScopeOf({ body: long, path: PAGE }).signs).toEqual(['long']);
    expect(
      commentScopeOf({ body: `${long} Do it the way the payouts screen does it.`, path: PAGE })
        .signs,
    ).toEqual(['rethink', 'long']);
  });

  it('ignores code inside a closed fence', () => {
    const body = 'Use this instead:\n\n```tsx\n<AppLayout header={<LedgerHeader />} />\n```';
    expect(commentScopeOf({ body, path: PAGE }).places).toEqual([]);
  });

  it('reads a general comment without a file', () => {
    expect(
      commentScopeOf({
        body: 'Redesign the import flow: split ImportWizard into new components.',
        path: null,
      }),
    ).toEqual({ isBroad: true, signs: ['rethink', 'places'], places: ['ImportWizard'] });
  });
});
