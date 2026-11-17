// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Button } from '../components/Button';
import { Checkbox } from '../components/Checkbox';
import { Input } from '../components/Input';
import { Listbox } from '../components/Listbox';
import { SearchField } from '../components/SearchField';
import { Skeleton } from '../components/Skeleton';
import { Switch } from '../components/Switch';
import { Textarea } from '../components/Textarea';

describe('controls at 3:1', () => {
  afterEach(cleanup);

  it('paints an unchecked switch track with the idle token', () => {
    render(<Switch label="Autorun" checked={false} onChange={() => undefined} />);
    const track = screen.getByRole('switch').querySelector('span');
    expect(track?.className).toContain('bg-idle');
  });

  it('draws the checkbox with the control border, not the hairline', () => {
    render(<Checkbox checked={false} onChange={() => undefined} ariaLabel="Viewed" />);
    const box = screen.getByRole('checkbox', { name: 'Viewed' });
    expect(box.className).toContain('border-border-control');
    expect(box.className).not.toContain('border-border-soft');
  });

  it('draws every text field and the listbox field with the control border', () => {
    render(
      <>
        <Input aria-label="Name" />
        <Textarea aria-label="Notes" />
        <SearchField ariaLabel="Find" value="" onChange={() => undefined} />
        <Listbox
          ariaLabel="Model"
          value="balanced"
          options={[{ value: 'balanced', label: 'Balanced' }]}
          onChange={() => undefined}
        />
      </>,
    );
    const fields = [
      screen.getByRole('textbox', { name: 'Name' }),
      screen.getByRole('textbox', { name: 'Notes' }),
      screen.getByRole('searchbox', { name: 'Find' }).parentElement,
      screen.getByRole('combobox', { name: 'Model' }),
    ];
    for (const field of fields) {
      expect(field?.className).toContain('border-border-control');
    }
  });

  it('strengthens the listbox field border on hover', () => {
    render(
      <Listbox
        ariaLabel="Verbosity"
        value="balanced"
        options={[{ value: 'balanced', label: 'Balanced' }]}
        onChange={() => undefined}
      />,
    );
    expect(screen.getByRole('combobox', { name: 'Verbosity' }).className).toContain(
      'hover:border-border-strong',
    );
  });

  it('fills the secondary button one step inside its parent and the skeleton one step above', () => {
    const { container } = render(
      <>
        <Button variant="secondary">Cancel</Button>
        <Skeleton />
      </>,
    );
    expect(screen.getByRole('button', { name: 'Cancel' }).className).toContain('bg-fill');
    expect(container.querySelector('[aria-hidden]')?.className).toContain('bg-skeleton');
  });
});
