// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ChangesSection } from './ChangesSection';

const MISSING_SHA = 'deadbee1234567890';

const LINK_AFFORDANCE = [
  'cursor-pointer',
  'underline-offset-2',
  'hover:underline',
  'hover:text-foreground',
];

type Params = {
  readonly onOpenCommit?: (sha: string) => void;
};

const renderSection = ({ onOpenCommit }: Params = {}) => {
  render(
    <ChangesSection
      files={[]}
      reported={[]}
      reportedMissingShas={[MISSING_SHA]}
      withinRunWindow={[]}
      worktreePath={null}
      onOpenCommit={onOpenCommit}
    />,
  );
};

afterEach(cleanup);

describe('ChangesSection', () => {
  it('reads a missing sha as an in-app link when it can open the diff', () => {
    const onOpenCommit = vi.fn();
    renderSection({ onOpenCommit });
    const button = screen.getByTitle(`Open the diff of ${MISSING_SHA}`);
    LINK_AFFORDANCE.forEach((token) => expect(button.className).toContain(token));
    fireEvent.click(button);
    expect(onOpenCommit).toHaveBeenCalledWith(MISSING_SHA);
  });

  it('keeps a missing sha as plain text without a handler', () => {
    renderSection();
    expect(screen.queryByRole('button')).toBeNull();
    const sha = screen.getByText(MISSING_SHA.slice(0, 7));
    LINK_AFFORDANCE.forEach((token) => expect(sha.className).not.toContain(token));
  });
});
