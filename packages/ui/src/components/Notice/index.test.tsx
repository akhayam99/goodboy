// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Notice, type NoticePlacement, type NoticeTone } from './index';

const TONES = ['danger', 'warning', 'info', 'success'] as const satisfies ReadonlyArray<NoticeTone>;
const PLACEMENTS = [
  'transcript',
  'inline',
  'banner',
  'floating',
] as const satisfies ReadonlyArray<NoticePlacement>;

const TONE_TEXT = /\btext-(?:danger|warning|info|success)\b/;
const TONE_FILL = /\bbg-(?:danger|warning|info|success)\/\d+/;

describe('Notice', () => {
  afterEach(cleanup);

  it.each(TONES.flatMap((tone) => PLACEMENTS.map((placement) => [tone, placement] as const)))(
    'keeps the %s tone on the rail and icon only in the %s placement',
    (tone, placement) => {
      const { container } = render(
        <Notice
          tone={tone}
          placement={placement}
          title="Couldn't load pull requests"
          body="GitHub didn't answer."
          iconTestId="notice-icon"
        />,
      );
      const root = container.firstElementChild;
      expect(root?.className).not.toMatch(TONE_FILL);
      expect(root?.className).not.toMatch(TONE_TEXT);
      expect(screen.getByText("Couldn't load pull requests").className).toContain(
        'text-foreground',
      );
      expect(screen.getByText("GitHub didn't answer.").className).toContain(
        'text-muted-foreground',
      );
      expect(container.querySelector('[data-notice-rail]')?.className).toContain(`bg-${tone}`);
      expect(screen.getByTestId('notice-icon').getAttribute('class')).toContain(`text-${tone}`);
    },
  );

  it('keeps technical detail behind a Details disclosure', () => {
    render(
      <Notice
        tone="danger"
        placement="transcript"
        title="The turn stopped"
        detail="summarizer cli exited with code 143"
      />,
    );
    const disclosure = screen.getByRole('button', { name: 'Details' });
    expect(disclosure.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('summarizer cli exited with code 143')).toBeNull();

    fireEvent.click(disclosure);

    expect(disclosure.getAttribute('aria-expanded')).toBe('true');
    const detail = screen.getByText('summarizer cli exited with code 143');
    expect(detail.tagName).toBe('PRE');
    expect(detail.className).toContain('font-mono');
  });

  it('renders no disclosure without detail', () => {
    render(<Notice tone="warning" placement="inline" title="Spend is at 92%" detail="  " />);
    expect(screen.queryByRole('button', { name: 'Details' })).toBeNull();
  });

  it('renders the actions it is given', () => {
    render(
      <Notice
        tone="danger"
        placement="banner"
        role="alert"
        title="Couldn't load pull requests"
        actions={<button type="button">Retry</button>}
      />,
    );
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
  });
});
