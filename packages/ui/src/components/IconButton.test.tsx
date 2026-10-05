// @vitest-environment happy-dom

import { Trash2 } from 'lucide-react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { IconButton } from './IconButton';

describe('IconButton', () => {
  afterEach(cleanup);

  it('keeps the ghost variant borderless at rest even with a non-neutral tone', () => {
    const { getByRole } = render(
      <IconButton variant="ghost" tone="danger" icon={Trash2} label="Delete session" />,
    );

    const button = getByRole('button', { name: 'Delete session' });
    expect(button.className).toContain('border-transparent');
    expect(button.className).not.toMatch(/\bborder-danger\/\d+/);
  });

  it('keeps the outline variant tone border for a non-neutral tone', () => {
    const { getByRole } = render(
      <IconButton variant="outline" tone="danger" icon={Trash2} label="Delete session" />,
    );

    const button = getByRole('button', { name: 'Delete session' });
    expect(button.className).toMatch(/\bborder-danger\/\d+/);
  });

  it('reads busy and refuses a second click while its action runs', () => {
    const { getByRole } = render(<IconButton icon={Trash2} label="Refresh session" busy />);

    const button = getByRole('button', { name: 'Refresh session' });
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.hasAttribute('disabled')).toBe(true);
  });

  it('keeps the icon at its size and out of flex shrink inside a fixed small button', () => {
    const { getByRole } = render(
      <IconButton icon={Trash2} label="Delete session" iconSize={14} className="size-6 shrink-0" />,
    );

    const svg = getByRole('button', { name: 'Delete session' }).querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('14');
    expect(svg?.getAttribute('height')).toBe('14');
    expect(svg?.getAttribute('class')).toMatch(/\bshrink-0\b/);
  });
});
