// @vitest-environment happy-dom

import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';
import { fireEvent, render, screen } from '@testing-library/react';
import { useEscapeLayer } from '@goodboy/ui';
import { describe, expect, it, vi } from 'vitest';

const SRC = join(__dirname, '..', '..');
const WEB_FULL_SCREEN = /\b(requestFullscreen|webkitRequestFullscreen|webkitEnterFullscreen)\b/;

const isSource = (path: string): boolean =>
  /\.(ts|tsx)$/.test(path) &&
  !/\.test\.(ts|tsx)$/.test(path) &&
  !path.includes(`${sep}__tests__${sep}`);

const walk = (dir: string): ReadonlyArray<string> =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return walk(path);
    }
    return isSource(path) ? [path] : [];
  });

const Layer = ({ onEscape }: { readonly onEscape: () => void }) => {
  useEscapeLayer(onEscape);
  return <div>layer</div>;
};

describe('escape inside a full-screen window', () => {
  it('never enters the web fullscreen api, which Esc always exits', () => {
    const offenders = walk(SRC)
      .filter((path) => WEB_FULL_SCREEN.test(readFileSync(path, 'utf8')))
      .map((path) => relative(SRC, path).split(sep).join('/'));
    expect(offenders).toEqual([]);
  });

  it('still reaches the topmost escape layer', () => {
    const outer = vi.fn();
    const inner = vi.fn();
    render(
      <>
        <Layer onEscape={outer} />
        <Layer onEscape={inner} />
      </>,
    );
    const handled = fireEvent.keyDown(window, { code: 'Escape', key: 'Escape' });
    expect(inner).toHaveBeenCalledTimes(1);
    expect(outer).not.toHaveBeenCalled();
    expect(handled).toBe(false);
  });

  it('still reaches a focused inline edit', () => {
    const onKeyDown = vi.fn();
    render(<input aria-label="Title" onKeyDown={(event) => onKeyDown(event.key)} />);
    fireEvent.keyDown(screen.getByLabelText('Title'), { code: 'Escape', key: 'Escape' });
    expect(onKeyDown).toHaveBeenCalledWith('Escape');
  });
});
