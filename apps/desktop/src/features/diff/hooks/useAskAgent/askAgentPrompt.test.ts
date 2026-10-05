// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { askAgentPrompt } from './askAgentPrompt';

const LINE = 'const residual = total - sum(rounded);';

describe('askAgentPrompt', () => {
  it('quotes the line with its file and line', () => {
    expect(
      askAgentPrompt({
        filePath: 'src/ledger/settle.ts',
        anchor: { side: 'new', lineNumber: 40 },
        text: LINE,
      }),
    ).toBe(`About \`src/ledger/settle.ts:40\`:\n> ${LINE}\n`);
  });

  it('names the range of several lines and quotes each one', () => {
    expect(
      askAgentPrompt({
        filePath: 'src/ledger/settle.ts',
        anchor: { side: 'new', lineNumber: 40, endLineNumber: 41 },
        text: `${LINE}\nreturn residual;`,
      }),
    ).toBe(`About \`src/ledger/settle.ts:40-41\`:\n> ${LINE}\n> return residual;\n`);
  });

  it('names one line when the range ends where it starts', () => {
    expect(
      askAgentPrompt({
        filePath: 'src/ledger/settle.ts',
        anchor: { side: 'new', lineNumber: 40, endLineNumber: 40 },
        text: LINE,
      }),
    ).toBe(`About \`src/ledger/settle.ts:40\`:\n> ${LINE}\n`);
  });

  it('treats a defined end line as a range even when it is zero', () => {
    expect(
      askAgentPrompt({
        filePath: 'src/ledger/settle.ts',
        anchor: { side: 'old', lineNumber: 40, endLineNumber: 0 },
        text: LINE,
      }),
    ).toBe(`About \`src/ledger/settle.ts:40-0\`:\n> ${LINE}\n`);
  });

  it('keeps the note written in the composer under the quote', () => {
    expect(
      askAgentPrompt({
        filePath: 'src/ledger/settle.ts',
        anchor: { side: 'new', lineNumber: 40 },
        text: LINE,
        note: 'Rebuild this from the intro question instead.',
      }),
    ).toBe(
      `About \`src/ledger/settle.ts:40\`:\n> ${LINE}\n\nRebuild this from the intro question instead.\n`,
    );
  });
});
