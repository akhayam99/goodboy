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
    'keeps the %s tone on the icon only in the %s placement',
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
      expect(screen.getByTestId('notice-icon').getAttribute('class')).toContain(`text-${tone}`);
      expect(screen.getByTestId('notice-icon').getAttribute('width')).toBe('16');
      expect(screen.queryByTestId('tone-bar')).toBeNull();
    },
  );

  it.each(['inline', 'banner'] as const)(
    'sits the %s notice on a neutral subtle surface with no border and no tone line',
    (placement) => {
      const { container } = render(
        <Notice tone="warning" placement={placement} title="Spend is at 92%" />,
      );
      const root = container.firstElementChild;
      expect(root?.className).toContain('bg-subtle');
      expect(root?.className).toContain('rounded-md');
      expect(root?.className).not.toMatch(/\bborder\b/);
      expect(screen.queryByTestId('tone-bar')).toBeNull();
      expect(container.querySelector('[data-notice-rail]')).toBeNull();
    },
  );

  it('lifts a floating notice on the one floating surface, with no tone line', () => {
    const { container } = render(
      <Notice tone="success" placement="floating" title="Merged #418" />,
    );
    const root = container.firstElementChild;
    expect(root?.className).toContain('bg-floating');
    expect(root?.className).toContain('shadow-lg');
    expect(screen.queryByTestId('tone-bar')).toBeNull();
  });

  it('keeps the transcript tone as an edge, because a transcript notice is a quote rail', () => {
    const { container } = render(
      <Notice tone="danger" placement="transcript" title="The turn stopped" />,
    );
    const edge = container.querySelector('[data-notice-rail]');

    expect(edge?.className).toContain('left-0');
    expect(edge?.className).toContain('inset-y-0');
    expect(edge?.className).toContain('bg-danger');
    expect(screen.queryByTestId('tone-bar')).toBeNull();
  });

  it('passes the alert role through on every placement', () => {
    render(
      <>
        <Notice tone="danger" placement="inline" role="alert" title="Couldn't load the inbox" />
        <Notice tone="warning" placement="banner" role="alert" title="Spend is at 92%" />
      </>,
    );

    expect(screen.getAllByRole('alert')).toHaveLength(2);
  });

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
    expect(detail.className).toContain('text-code');
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

  it('centres a title-only notice on its actions once wide, tops a multi-line one', () => {
    const { rerender } = render(
      <Notice
        tone="warning"
        placement="transcript"
        role="status"
        title="Claude is not signed in"
        actions={<button type="button">Connect now</button>}
      />,
    );
    const layout = () => screen.getByRole('status').querySelector('[data-notice-layout]');
    expect(layout()?.className).toContain('@md/notice:items-center');

    rerender(
      <Notice
        tone="warning"
        placement="transcript"
        role="status"
        title="Claude is not signed in"
        body="Sign in to keep this session running."
        actions={<button type="button">Connect now</button>}
      />,
    );
    expect(layout()?.className).toContain('items-start');
    expect(layout()?.className).not.toContain('@md/notice:items-center');
  });

  it('moves the actions under the body when the notice is narrower than its row width', () => {
    render(
      <Notice
        tone="warning"
        placement="transcript"
        role="status"
        title="Opus 5.5 needs a newer Claude CLI"
        body="You have Claude CLI 2.1.260."
        actions={<button type="button">Update Claude CLI</button>}
      />,
    );
    const root = screen.getByRole('status');
    const actions = screen.getByRole('button', { name: 'Update Claude CLI' }).parentElement;
    expect(root.className).toContain('@container/notice');
    expect(actions?.className).toContain('col-start-2');
    expect(actions?.className).toContain('@md/notice:col-start-3');
    expect(actions?.className).toContain('@md/notice:row-start-1');
  });
});
