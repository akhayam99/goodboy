import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative, sep } from 'path';
import { describe, expect, it } from 'vitest';

const DESKTOP = join(__dirname, '..', '..', '..');
const HISTORY = join(DESKTOP, 'src', 'features', 'history');
const HTML5_DRAG = /\bdraggable\b|onDrag(?:Start|Over|Enter|Leave|End)\b|onDrop\b|dataTransfer\b/;

const sourceFiles = (dir: string, acc: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      sourceFiles(full, acc);
      continue;
    }
    if ((entry.endsWith('.ts') || entry.endsWith('.tsx')) && !entry.includes('.test.')) {
      acc.push(full);
    }
  }
  return acc;
};

describe('rewrite history drag keeps the composer file drop working', () => {
  it('reorders with pointer events only, never the native drag session', () => {
    const offenders = sourceFiles(HISTORY)
      .filter((file) => HTML5_DRAG.test(readFileSync(file, 'utf8')))
      .map((file) => relative(DESKTOP, file).split(sep).join('/'));
    expect(offenders).toEqual([]);
  });

  it('leaves the native file drop on for every window', () => {
    const config = JSON.parse(
      readFileSync(join(DESKTOP, 'src-tauri', 'tauri.conf.json'), 'utf8'),
    ) as {
      readonly app: { readonly windows: ReadonlyArray<Record<string, unknown>> };
    };
    expect(config.app.windows.every((window) => window.dragDropEnabled !== false)).toBe(true);
    const newWindow = readFileSync(
      join(DESKTOP, 'src', 'features', 'workspace', 'window.ts'),
      'utf8',
    );
    expect(newWindow).not.toMatch(/dragDropEnabled\s*:\s*false/);
  });

  it('still takes composer file drops from the webview drag and drop event', () => {
    const hook = readFileSync(
      join(DESKTOP, 'src', 'shared', 'hooks', 'useFileDropTarget', 'index.ts'),
      'utf8',
    );
    expect(hook).toMatch(/onDragDropEvent\(/);
  });
});
