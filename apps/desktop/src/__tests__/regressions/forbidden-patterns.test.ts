// @vitest-environment node
import { writeFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import {
  BASELINE_FILES,
  collectSources,
  countStringifiedCaughtErrors,
  describeOffense,
  FOOTER_CTA_BAR,
  grownOffenses,
  measure,
  readBaselines,
  REPO_ROOT,
  serializeLedger,
  TAURI_CORE_IMPORT,
} from '../../../../../scripts/rules/forbiddenPatterns.mjs';

const IS_UPDATING = process.env.GOODBOY_UPDATE_BASELINE === '1';

describe('forbidden code patterns only ever shrink', () => {
  const sources = collectSources();
  const current = measure({ sources });

  it('finds sources in every scanned tree, never an empty sweep', () => {
    const scanned = sources;
    expect(scanned.some((file) => file.kind === 'ts')).toBe(true);
    expect(scanned.some((file) => file.kind === 'rust')).toBe(true);
    expect(scanned.some((file) => file.kind === 'config')).toBe(true);
  });

  it('counts a stringified caught error and nothing else', () => {
    const scan = (lines: ReadonlyArray<string>): number =>
      countStringifiedCaughtErrors({
        path: 'apps/desktop/src/x.ts',
        kind: 'ts',
        area: 'desktop',
        isTest: false,
        scope: 'core',
        lines,
      });
    const flagged = [
      ['try {', '  run();', '} catch (error) {', '  setError(String(error));', '}'],
      ['try {', '} catch (err: unknown) {', '  log(`${err}`);', '}'],
      ['run().catch((cause) => show(cause + ""));'],
      ['run().catch(', '  (failure: unknown) => show(failure.toString()),', ');'],
      ['} catch (error) {', '  throw new Error(error);', '}'],
    ];
    const allowed = [
      ['const label = String(count);'],
      [
        'try {',
        '} catch (error) {',
        '  setError(formatError(error));',
        '}',
        'const s = String(error);',
      ],
      ['} catch {', '  setError(`${reason}`);', '}'],
    ];
    expect(flagged.map(scan)).toEqual([1, 1, 1, 1, 1]);
    expect(allowed.map(scan)).toEqual([0, 0, 0]);
  });

  it('counts every way of importing invoke straight from tauri', () => {
    const count = (text: string): number => (text.match(TAURI_CORE_IMPORT) ?? []).length;
    expect(count("import { invoke } from '@tauri-apps/api/core';")).toBe(1);
    expect(count("import {\n  Channel,\n  invoke,\n} from '@tauri-apps/api/core';")).toBe(1);
    expect(count("import * as core from '@tauri-apps/api/core';")).toBe(1);
    expect(count("const core = await import('@tauri-apps/api/core');")).toBe(1);
    expect(count("import type { InvokeArgs } from '@tauri-apps/api/core';")).toBe(0);
    expect(count("import { listen } from '@tauri-apps/api/event';")).toBe(0);
  });

  it('flags every footer CTA bar shape the form actions replaced', () => {
    const bars = [
      '<footer className="shrink-0 px-6 py-3">',
      '<PopoverFooter className="flex items-center justify-end gap-2 px-2.5 py-2">',
      "<div className={cn('flex items-center', PANE_RHYTHM.column, PANE_RHYTHM.dock)}>",
      'dock={<PublishConversationsBar sessionId={sessionId} />}',
      '      dock={',
    ];
    const allowed = [
      'dock={conversation.composer}',
      'dock={editContext != null ? conversation.composer : null}',
      '<FormActions leading={controls}>',
    ];
    expect(bars.filter((line) => !FOOTER_CTA_BAR.test(line))).toEqual([]);
    expect(allowed.filter((line) => FOOTER_CTA_BAR.test(line))).toEqual([]);
  });

  it('adds no forbidden pattern to any file beyond its baseline', () => {
    if (IS_UPDATING) {
      writeFileSync(
        join(REPO_ROOT, BASELINE_FILES.core),
        serializeLedger({ counts: current.core }),
      );
      writeFileSync(
        join(REPO_ROOT, BASELINE_FILES.guards),
        serializeLedger({ counts: current.guards }),
      );
      return;
    }
    const grown = grownOffenses({ counts: current, baselines: readBaselines() }).map((offense) =>
      describeOffense({ offense }),
    );
    if (grown.length > 0) {
      throw new Error(
        `Forbidden patterns grew. AGENTS.md lists the rules; fix the new occurrences. A ` +
          `cleanup that lowers a count regenerates the baseline with ` +
          `GOODBOY_UPDATE_BASELINE=1.\n\n${grown.join('\n')}`,
      );
    }
    expect(grown).toEqual([]);
  });
});
