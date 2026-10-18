// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { brandId } from '@goodboy/types';
import type { IsoDateTime, ProviderRunId } from '@goodboy/types';
import { TranscriptCard } from '.';

afterEach(cleanup);

const DELIVERY = 'STATE OF THIS CONVERSATION\nSpent 3.82 USD. Left 1.18 USD.';

const renderRow = () =>
  render(
    <TranscriptCard
      item={{
        kind: 'auto_delivery',
        key: 'auto-delivery-0',
        runId: brandId<ProviderRunId>({ value: 'run-auto-1' }),
        text: DELIVERY,
        at: brandId<IsoDateTime>({ value: '2026-10-16T09:00:00.000Z' }),
      }}
    />,
  );

describe('AutoDeliveryRow', () => {
  it('keeps the text built for Auto out of the transcript until it is asked for', () => {
    renderRow();

    screen.getByRole('button', { name: 'What Auto was told' });
    expect(screen.queryByText(/STATE OF THIS CONVERSATION/)).toBeNull();
  });

  it('shows the text on request and hides it again', () => {
    renderRow();
    const toggle = screen.getByRole('button', { name: 'What Auto was told' });

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    screen.getByText(/STATE OF THIS CONVERSATION/);

    fireEvent.click(toggle);
    expect(screen.queryByText(/STATE OF THIS CONVERSATION/)).toBeNull();
  });
});
