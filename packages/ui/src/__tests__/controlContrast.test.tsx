// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Button } from '../components/Button';
import { Checkbox } from '../components/Checkbox';
import { Select } from '../components/Select';
import { Skeleton } from '../components/Skeleton';
import { Switch } from '../components/Switch';

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
    expect(box.className).toContain('border-border');
    expect(box.className).not.toContain('border-border-soft');
  });

  it('strengthens the select border on hover', () => {
    render(
      <Select aria-label="Verbosity">
        <option>Balanced</option>
      </Select>,
    );
    expect(screen.getByRole('combobox', { name: 'Verbosity' }).className).toContain(
      'hover:border-border-strong',
    );
  });

  it('fills the secondary button and the skeleton one step inside their parent', () => {
    const { container } = render(
      <>
        <Button variant="secondary">Cancel</Button>
        <Skeleton />
      </>,
    );
    expect(screen.getByRole('button', { name: 'Cancel' }).className).toContain('bg-fill');
    expect(container.querySelector('[aria-hidden]')?.className).toContain('bg-fill');
  });
});
