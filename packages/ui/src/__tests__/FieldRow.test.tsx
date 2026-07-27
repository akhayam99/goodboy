// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { FieldRow } from '../components/FieldRow';

afterEach(cleanup);

describe('FieldRow', () => {
  it('floors the label column width and keeps the control column from shrinking', () => {
    render(
      <FieldRow label="Default provider" help="New sessions start on it.">
        <div className="flex max-w-64 flex-wrap justify-end gap-1">
          <button type="button">anthropic</button>
        </div>
      </FieldRow>,
    );
    const label = screen.getByText('Default provider');
    const labelBlock = label.parentElement;
    const controlBlock = labelBlock?.nextElementSibling;

    expect(labelBlock?.className).toContain('min-w-40');
    expect(controlBlock?.className).toContain('shrink-0');
    expect(controlBlock?.className).not.toContain('min-w-0');
  });
});
