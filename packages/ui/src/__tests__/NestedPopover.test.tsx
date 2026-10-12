// @vitest-environment happy-dom

import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { AnchoredPopover } from '../components/AnchoredPopover';
import { Listbox } from '../components/Listbox';
import { useDropdown } from '../useDropdown';

afterEach(cleanup);

const OPTIONS = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const Harness = () => {
  const dropdown = useDropdown({ width: 'w-80' });
  const [value, setValue] = useState('light');
  return (
    <div>
      <AnchoredPopover
        dropdown={dropdown}
        role="dialog"
        ariaLabel="Settings"
        trigger={
          <button type="button" onClick={dropdown.toggle} aria-expanded={dropdown.open}>
            Open settings
          </button>
        }
      >
        <Listbox ariaLabel="Theme" value={value} options={OPTIONS} onChange={setValue} isBlock />
      </AnchoredPopover>
      <button type="button">Outside</button>
    </div>
  );
};

const pickDark = (): void => {
  fireEvent.click(screen.getByRole('button', { name: 'Open settings' }));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('combobox', { name: 'Theme' }));
  const option = screen.getByRole('option', { name: 'Dark' });
  fireEvent.mouseDown(option);
  fireEvent.click(option);
};

describe('a popover nested in another popover', () => {
  it('keeps the outer popover open when an option of the inner listbox is picked', () => {
    render(<Harness />);

    pickDark();

    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeDefined();
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(screen.getByRole('combobox', { name: 'Theme' }).textContent).toContain('Dark');
  });

  it('still closes the outer popover on a press outside both', () => {
    render(<Harness />);
    pickDark();

    fireEvent.mouseDown(screen.getByRole('button', { name: 'Outside' }));

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes the outer popover on the first outside press after a nested pick', () => {
    render(<Harness />);
    pickDark();
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Outside' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open settings' }));

    fireEvent.mouseDown(screen.getByRole('button', { name: 'Outside' }));

    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
