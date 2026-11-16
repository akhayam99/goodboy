// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { SummarySection } from '.';

const LEARNED = [
  'The duplicate credit comes from `apps/payments-api/src/webhooks/deliveries/handleDelivery.ts`',
  'Redeliveries reuse the same `event.id`',
  'ledger-core retries twice on its own',
  'The idempotency key lives in the credit transaction',
  'notify-relay reads stuck deliveries behind a flag',
];

const NEXT = ['Ask Northwind to turn the flag on', 'Wire the retry state', 'Flip the backfill'];

const SUMMARY = [
  '#### Learned',
  ...LEARNED.map((fact) => `- ${fact}`),
  '',
  '#### State',
  '- Dedupe check is live',
  '',
  '#### Next',
  ...NEXT.map((step) => `- ${step}`),
].join('\n');

const noop = async () => true;

type MountParams = {
  readonly value: string;
  readonly isLoading?: boolean;
};

const mount = ({ value, isLoading = false }: MountParams) =>
  render(
    <SummarySection
      value={value}
      isLoading={isLoading}
      isRawEditing={false}
      onWrite={noop}
      onCloseRawEditor={() => undefined}
    />,
  );

afterEach(cleanup);

describe('SummarySection', () => {
  it('draws Next as an ordered list of steps with the first one leading', () => {
    mount({ value: SUMMARY });

    const steps = screen.getByRole('list', { name: 'Next' });
    expect(steps.tagName).toBe('OL');
    const rows = within(steps).getAllByRole('listitem');
    expect(rows.map((row) => row.textContent)).toEqual(NEXT.map((step, i) => `${i + 1}${step}`));
    expect(rows[0]?.getAttribute('data-summary-step')).toBe('first');
    expect(rows[1]?.hasAttribute('data-summary-step')).toBe(false);
  });

  it('folds Learned to three facts behind one toggle and shows every fact once opened', () => {
    mount({ value: SUMMARY });

    const facts = () =>
      within(screen.getByRole('list', { name: 'Learned' })).getAllByRole('listitem');
    expect(facts()).toHaveLength(3);
    const toggle = screen.getByRole('button', { name: 'Show all 5' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.getAttribute('aria-controls')).toBe(
      screen.getByRole('list', { name: 'Learned' }).id,
    );

    fireEvent.click(toggle);

    expect(facts()).toHaveLength(5);
    expect(screen.getByRole('button', { name: 'Show fewer' }).getAttribute('aria-expanded')).toBe(
      'true',
    );
    expect(screen.queryByRole('button', { name: 'Show less' })).toBeNull();
  });

  it('loses no text: a shortened path keeps its full value for readers and the tooltip', () => {
    mount({ value: SUMMARY });

    const path = 'apps/payments-api/src/webhooks/deliveries/handleDelivery.ts';
    const code = screen.getByText(path).closest('code');
    expect(code?.getAttribute('data-short-path')).toBe('');
    expect(code?.textContent).toContain('apps/…/deliveries/handleDelivery.ts');
    fireEvent.click(screen.getByRole('button', { name: 'Show all 5' }));
    LEARNED.slice(1).forEach((fact) =>
      expect(screen.getByRole('list', { name: 'Learned' }).textContent).toContain(
        fact.replaceAll('`', ''),
      ),
    );
  });

  it('leaves State out of the card, the status box above the cards draws it', () => {
    mount({ value: SUMMARY });

    expect(screen.queryByText('Dedupe check is live')).toBeNull();
    expect(screen.queryByRole('region', { name: 'State' })).toBeNull();
  });

  it('keeps the empty and loading states', () => {
    mount({ value: '' });
    screen.getByText('The summary starts after the first agent reply.');
    cleanup();

    const { container } = mount({ value: SUMMARY, isLoading: true });
    expect(screen.queryByRole('list')).toBeNull();
    expect(container.firstChild).not.toBeNull();
  });
});
