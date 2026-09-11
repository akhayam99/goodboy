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
});
