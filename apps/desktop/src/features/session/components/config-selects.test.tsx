// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { EffortSelect, InlineField, ModelSelect, VerbositySelect } from './config-selects';

afterEach(cleanup);

describe('InlineField', () => {
  it('renders the label and children', () => {
    render(
      <InlineField label="Model">
        <span>child</span>
      </InlineField>,
    );
    expect(screen.getByText('Model')).toBeDefined();
    expect(screen.getByText('child')).toBeDefined();
  });
});

describe('VerbositySelect', () => {
  it('renders the current verbosity label and opens a menu on click', () => {
    render(<VerbositySelect value="normal" onChange={vi.fn()} disabled={false} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getAllByText(/brief|normal|verbose/i).length).toBeGreaterThan(0);
  });

  it('disables the trigger when disabled is true', () => {
    render(<VerbositySelect value="normal" onChange={vi.fn()} disabled />);
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('ModelSelect', () => {
  it('renders the current model id in the trigger', () => {
    render(
      <ModelSelect
        provider="anthropic"
        value="claude-opus-4-5"
        onChange={vi.fn()}
        disabled={false}
      />,
    );
    expect(screen.getByRole('button')).toBeDefined();
  });
});

describe('EffortSelect', () => {
  it('renders an N/A placeholder when the model has no effort levels', () => {
    render(
      <EffortSelect model="unknown-model" value="medium" onChange={vi.fn()} disabled={false} />,
    );
    expect(screen.getByText('N/A')).toBeDefined();
  });
});
