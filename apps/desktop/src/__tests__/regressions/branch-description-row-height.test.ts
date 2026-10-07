// @vitest-environment node
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = join(__dirname, '..', '..', '..', '..', '..');

const sourceOf = ({ path }: { readonly path: string }): string =>
  readFileSync(join(REPO_ROOT, path), 'utf8');

const heightOf = ({ size }: { readonly size: string }): string => {
  const match = new RegExp(`${size}: '(h-\\d+)`).exec(
    sourceOf({ path: 'packages/ui/src/components/Button.tsx' }),
  );
  if (match === null) {
    throw new Error(`Button has no ${size} height`);
  }
  return String(match[1]);
};

describe('the Branch Description row', () => {
  const source = sourceOf({
    path: 'apps/desktop/src/features/branch/components/BranchDescription.tsx',
  });

  it('sets the Edit button at the sm size', () => {
    expect(source).toMatch(/<Button size="sm" variant="ghost" onClick=\{startEditing\}>/);
  });

  it('gives the Description toggle the height of the sm button, so the two share one line', () => {
    const toggle = /<button\s[\s\S]*?className="([^"]*)"/.exec(source);

    expect(toggle?.[1]?.split(' ')).toContain(heightOf({ size: 'sm' }));
  });

  it('centres both controls on the row', () => {
    expect(source).toMatch(/className="flex min-w-0 items-center justify-between gap-2"/);
  });
});
