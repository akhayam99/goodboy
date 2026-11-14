// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { BrowserTabChip } from './BrowserTabChip';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);

afterEach(cleanup);

describe('a browser tab chip', () => {
  it('keeps every one of many tabs reachable, each with its own select and close', () => {
    render(
      <nav aria-label="Browser tabs">
        {Array.from({ length: 12 }, (_, index) => (
          <BrowserTabChip
            key={index}
            label={`Harborline checkout ${index}`}
            url="https://northwind.example/checkout"
            isSelected={index === 0}
            isPin={false}
            onSelect={() => undefined}
            onClose={() => undefined}
          />
        ))}
      </nav>,
    );

    const strip = screen.getByRole('navigation', { name: 'Browser tabs' });
    expect(strip.querySelectorAll('[data-browser-tab]')).toHaveLength(12);
    expect(
      within(strip).getAllByRole('button', { name: /^Close Harborline checkout/ }),
    ).toHaveLength(12);
    expect(
      within(strip)
        .getByRole('button', { name: 'Harborline checkout 0' })
        .getAttribute('aria-current'),
    ).toBe('page');
  });
});
