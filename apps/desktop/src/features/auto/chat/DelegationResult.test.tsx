// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { DelegationResult } from './DelegationResult';
import type { DelegationResultView } from './delegationResultOf';

const resultWith = ({ summary }: { readonly summary: string | null }): DelegationResultView => ({
  summary,
  changedFileCount: 0,
  checks: [],
  artifacts: [],
  questions: [],
  costUsd: null,
  isCostEstimated: false,
  reason: null,
  reasonText: null,
});

afterEach(cleanup);

describe('DelegationResult summary', () => {
  it('renders markdown instead of literal asterisks', () => {
    const { container } = render(
      <DelegationResult
        result={resultWith({ summary: '- **Trailer grep:** none found\n- **Remote:** in sync' })}
      />,
    );

    expect(container.textContent).not.toContain('**');
    expect(container.querySelectorAll('li').length).toBe(2);
    expect(screen.getByText('Trailer grep:').tagName).toBe('STRONG');
  });

  it('keeps the prose and drops the artifact markup', () => {
    const summary =
      '**Done** for ledger-core\n<<artifact v=1 kind=report>>\n{"title":"Audit"}\n<</artifact>>';
    const { container } = render(<DelegationResult result={resultWith({ summary })} />);

    expect(screen.getByText('Done').tagName).toBe('STRONG');
    expect(container.textContent).not.toContain('<<artifact');
    expect(container.textContent).not.toContain('"title"');
  });

  it('renders nothing for an empty summary', () => {
    const { container } = render(<DelegationResult result={resultWith({ summary: '   ' })} />);

    expect(container.textContent).toBe('');
  });
});
