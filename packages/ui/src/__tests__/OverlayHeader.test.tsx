// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { OverlayHeader } from '../components/OverlayHeader';

afterEach(cleanup);

describe('OverlayHeader', () => {
  it.each(['compact', 'fullscreen'] as const)(
    'names the %s header without adding a heading',
    (variant) => {
      render(
        <OverlayHeader
          title="Settings"
          closeLabel="close settings"
          onClose={() => undefined}
          variant={variant}
        />,
      );

      expect(screen.getByRole('banner', { name: 'Settings' })).toBeTruthy();
      expect(screen.queryByRole('heading')).toBeNull();
    },
  );
});
