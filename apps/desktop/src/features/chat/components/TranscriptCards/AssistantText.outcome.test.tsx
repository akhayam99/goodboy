// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

vi.mock('@goodboy/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@goodboy/ui')>()),
  CopyButton: () => <button type="button">copy</button>,
  Markdown: ({ text }: { text: string }) => <div>{text}</div>,
}));

vi.mock('../HandoffChip', () => ({ HandoffChip: () => null }));
vi.mock('../PlanChip', () => ({ PlanChip: () => null }));
vi.mock('../ResolverThreadsCard', () => ({ ResolverThreadsCard: () => null }));
vi.mock('../ScribeTextCard', () => ({ ScribeTextCard: () => null }));
import { AssistantText } from './AssistantText';

afterEach(cleanup);

const WITH_OUTCOME =
  'Both packages build.\n\n<<outcome>>Done: 2 packages changed in ledger-core.<</outcome>>';

describe('AssistantText with an outcome marker', () => {
  it('draws the outcome line first and keeps the marker out of the text', () => {
    const { container } = render(<AssistantText text={WITH_OUTCOME} sessionId={null} />);

    const outcome = screen.getByTestId('outcome-line');
    expect(outcome.textContent).toBe('Done: 2 packages changed in ledger-core.');
    expect(container.querySelector('[data-testid="outcome-line"]')).toBe(outcome);
    screen.getByText('Both packages build.');
    expect(screen.queryByText(/<<outcome>>/)).toBeNull();
  });

  it('draws no outcome line for a plain message', () => {
    render(<AssistantText text="Both packages build." sessionId={null} />);

    expect(screen.queryByTestId('outcome-line')).toBeNull();
  });

  it('waits for the message to finish before drawing the outcome line', () => {
    render(<AssistantText text={WITH_OUTCOME} sessionId={null} isComplete={false} />);

    expect(screen.queryByTestId('outcome-line')).toBeNull();
  });
});
