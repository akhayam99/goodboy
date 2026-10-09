// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { DecisionNoteRow } from './DecisionNoteRow';

afterEach(cleanup);

describe('DecisionNoteRow', () => {
  it('states the decision without the failure treatment', () => {
    render(<DecisionNoteRow message="Added later: storefront-web." />);

    const row = screen.getByTestId('transcript-decision-note');
    expect(screen.getByText('Added later: storefront-web.')).toBeTruthy();
    expect(screen.getByText('decision')).toBeTruthy();
    expect(row.className).not.toContain('danger');
    expect(screen.queryByTestId('transcript-error-icon')).toBeNull();
  });
});
