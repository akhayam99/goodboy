// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { FormSection } from '.';

afterEach(cleanup);

describe('FormSection', () => {
  it('names the group by its one label and shows the help under it', () => {
    render(
      <FormSection label="Plan" help="Who plans the run.">
        <button type="button">Lead</button>
      </FormSection>,
    );
    const group = screen.getByRole('group', { name: 'Plan' });
    within(group).getByText('Who plans the run.');
    within(group).getByRole('button', { name: 'Lead' });
  });

  it('draws no help line when there is none', () => {
    render(
      <FormSection label="Model">
        <span>Claude</span>
      </FormSection>,
    );
    expect(screen.getByRole('group', { name: 'Model' }).querySelectorAll('p')).toHaveLength(0);
  });
});
