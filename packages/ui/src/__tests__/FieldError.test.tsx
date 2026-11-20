// @vitest-environment happy-dom

import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { FieldError } from '../components/FieldError';
import { fieldErrorAriaOf } from '../fieldErrorAriaOf';

afterEach(cleanup);

const ERROR_ID = 'branch-template-error';

const BranchTemplateField = () => {
  const [value, setValue] = useState('hl/{task');
  const error =
    value.includes('{') && !value.includes('}') ? 'A brace has no closing brace.' : null;
  return (
    <div>
      <input
        aria-label="Branch template"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        {...fieldErrorAriaOf({ id: ERROR_ID, error })}
      />
      <FieldError id={ERROR_ID} error={error} />
    </div>
  );
};

describe('FieldError', () => {
  it('marks the field invalid and points it at the error', () => {
    render(<BranchTemplateField />);

    const field = screen.getByRole('textbox', { name: 'Branch template' });
    const error = screen.getByRole('alert');
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(field.getAttribute('aria-describedby')).toBe(error.id);
    expect(error.textContent).toBe('A brace has no closing brace.');
  });

  it('draws a danger glyph and keeps the sentence in plain text', () => {
    render(<BranchTemplateField />);

    const error = screen.getByRole('alert');
    expect(error.className).toContain('text-foreground');
    expect(error.className).not.toContain('text-danger');
    expect(error.querySelector('svg')?.getAttribute('class')).toContain('text-danger');
  });

  it('clears the error and the field marks once the value is fixed', () => {
    render(<BranchTemplateField />);

    const field = screen.getByRole('textbox', { name: 'Branch template' });
    fireEvent.change(field, { target: { value: 'hl/{task}' } });

    expect(screen.queryByRole('alert')).toBeNull();
    expect(field.hasAttribute('aria-invalid')).toBe(false);
    expect(field.hasAttribute('aria-describedby')).toBe(false);
  });

  it('draws nothing for an empty error', () => {
    const { container } = render(<FieldError id={ERROR_ID} error="" />);

    expect(container.innerHTML).toBe('');
  });
});
