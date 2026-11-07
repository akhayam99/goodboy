import { describe, expect, it } from 'vitest';
import { scanCopySource } from './scanCopySource';

describe('copy scanner', () => {
  it('finds single words through nested conditionals and parentheses', () => {
    const copies = scanCopySource({
      path: 'Harborline.tsx',
      text: `const row = <Button label={isReady ? ('Spawn') : isRunning ? 'Working' : 'Ready'} />;`,
    });

    expect(copies.map(({ prop, text }) => ({ prop, text }))).toEqual([
      { prop: 'label', text: 'Spawn' },
      { prop: 'label', text: 'Working' },
      { prop: 'label', text: 'Ready' },
    ]);
  });

  it.each(['word', 'phrase', 'sentence', 'reason', 'short', 'text'])(
    'finds a single word in %s',
    (prop) => {
      expect(
        scanCopySource({ path: 'Harborline.ts', text: `const row = { ${prop}: 'Stuck' };` }),
      ).toEqual([{ path: 'Harborline.ts', line: 1, prop, text: 'Stuck' }]);
    },
  );

  it('finds a template with one visible word and an interpolated target', () => {
    expect(
      scanCopySource({ path: 'Harborline.ts', text: 'const label = `Spawn ${role}`;' }).map(
        ({ text }) => text,
      ),
    ).toEqual(['Spawn']);
  });

  it('keeps interpolated internal keys out of copy', () => {
    expect(
      scanCopySource({
        path: 'Harborline.ts',
        text: 'const key = `spawned:run:${sessionId}:${runId}`;',
      }),
    ).toEqual([]);
  });

  it('keeps imports and non-copy attributes out through conditionals', () => {
    expect(
      scanCopySource({
        path: 'Harborline.tsx',
        text: `import { row } from 'Harborline'; const item = <div className={isReady ? 'Working' : 'Stuck'} data-testid="Working" />;`,
      }),
    ).toEqual([]);
  });
});
