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

const OPEN_END = ['>', '>>'];

describe('AssistantText with a question marker', () => {
  it.each(OPEN_END)('never shows raw marker text when the opening tag ends with %s', (end) => {
    const text = `The lease stays failed: the remote is at be3d04fc9.\n\n<<ctx-question blocking="true" suggestions="Force the lease push | Stop, do not push" recommended="Force the lease push" select="one"${end}The remote \`acme-explore-variant\` is at \`be3d04fc9\`. Overwrite it?\n<</ctx-question>>`;
    render(<AssistantText text={text} sessionId={null} />);

    screen.getByText('The lease stays failed: the remote is at be3d04fc9.');
    expect(screen.queryByText(/ctx-question/)).toBeNull();
    expect(screen.queryByText(/Overwrite it/)).toBeNull();
  });
});

describe('AssistantText with an auto block', () => {
  it('hides the whole block and keeps the words around it', () => {
    const text =
      'Two agents will look at the ledger export.\n\n<<auto>>{"action":"delegate","requestId":"r1","children":[{"role":"scout","task":"Map it","reason":"Orientation"}]}<</auto>>';
    render(<AssistantText text={text} sessionId={null} />);

    screen.getByText('Two agents will look at the ledger export.');
    expect(screen.queryByText(/auto>>/)).toBeNull();
    expect(screen.queryByText(/delegate/)).toBeNull();
  });

  it('hides a block that is still streaming', () => {
    render(<AssistantText text={'Working on it.\n\n<<auto>>{"action":"deleg'} sessionId={null} />);

    screen.getByText('Working on it.');
    expect(screen.queryByText(/deleg/)).toBeNull();
  });
});
