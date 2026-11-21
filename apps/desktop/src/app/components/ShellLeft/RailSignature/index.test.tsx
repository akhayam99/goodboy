// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { applyDocumentTheme } from '../../../../shared/lib/theme';
import { RailSignature } from '.';

afterEach(() => {
  cleanup();
  applyDocumentTheme({ theme: 'dark' });
});

type ThemeParams = {
  readonly theme: 'dark' | 'light';
};

describe('RailSignature', () => {
  it('draws the same tile in light and dark', () => {
    const markupIn = ({ theme }: ThemeParams): string => {
      applyDocumentTheme({ theme });
      const { container, unmount } = render(<RailSignature />);
      const markup = container.innerHTML;
      unmount();
      return markup;
    };

    expect(markupIn({ theme: 'light' })).toBe(markupIn({ theme: 'dark' }));
  });

  it('is one 24px brand tile and nothing that reads as a control', () => {
    const { container } = render(<RailSignature />);
    const signature = container.firstElementChild;

    expect(signature?.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelectorAll('[data-brand-tile]')).toHaveLength(1);
    expect(container.querySelector('button, a, input, [tabindex], [role], [title]')).toBeNull();
    expect(container.textContent).toBe('');
  });
});
