import { describe, expect, it } from 'vitest';
import {
  ARTIFACT_MAX_BYTES,
  extractArtifactBlocks,
  scanArtifactBlocks,
  type ArtifactScanState,
} from './grammar';

const PATHOLOGICAL_REPEATS = 64;

describe('extractArtifactBlocks', () => {
  it('rejects a pathological marker line promptly', () => {
    const line = `<<artifact${'\t-="'.repeat(PATHOLOGICAL_REPEATS)}`;
    const startedAt = Date.now();
    const blocks = extractArtifactBlocks(line);
    expect(blocks).toEqual([]);
    expect(Date.now() - startedAt).toBeLessThan(1000);
  });

  it('opens a block when a long attribute run still closes the marker', () => {
    const line = `<<artifact v=1 kind=report${'\t-="x"'.repeat(PATHOLOGICAL_REPEATS)}>>`;
    const blocks = extractArtifactBlocks(line);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.attrs).toMatchObject({ v: '1', kind: 'report' });
  });
});

describe('scanArtifactBlocks spans', () => {
  const body = '{"title":"Readout","format":"markdown","content":"# h"}';
  const text = `intro\n\n<<artifact v=1 kind=report>>\n${body}\n<</artifact>>\noutro`;

  it.each([32, 1024, 16384])(
    'examines a linear number of characters in whitespace-only lines of width %i',
    (width) => {
      const source = `${' \t'.repeat(width / 2)}\n`.repeat(
        Math.floor(ARTIFACT_MAX_BYTES / (width + 1)),
      );
      let examined = 0;
      const countedText = new Proxy(
        {
          length: source.length,
          indexOf: (search: string, from = 0) => {
            const end = source.indexOf(search, from);
            examined += (end === -1 ? source.length : end + search.length) - from;
            return end;
          },
          startsWith: (search: string, from = 0) => {
            examined += Math.min(search.length, source.length - from);
            return source.startsWith(search, from);
          },
          [Symbol.toPrimitive]: () => {
            throw new Error('Character counting must not be bypassed by string coercion');
          },
        },
        {
          get: (target, key, receiver) => {
            if (typeof key === 'string' && Number.isInteger(Number(key))) {
              examined += 1;
              return source[Number(key)];
            }
            return Reflect.get(target, key, receiver);
          },
        },
      );

      const result = scanArtifactBlocks({ text: countedText as unknown as string });

      expect(result.spans).toEqual([]);
      expect(result.state.scanned).toBe(source.length);
      expect(examined).toBeGreaterThanOrEqual(source.length);
      expect(examined).toBeLessThanOrEqual(4 * source.length);
    },
  );

  it.each([
    { tail: '', complete: true },
    { tail: ' \t', complete: true },
    { tail: ' prose', complete: false },
    { tail: '>', complete: false },
    { tail: '\r', complete: false },
    { tail: '\v', complete: false },
    { tail: '\f', complete: false },
    { tail: '\u00a0', complete: false },
  ])('requires only indentation after a close marker: $tail', ({ tail, complete }) => {
    const source = `<<artifact>>\nbody\n \t<</artifact>>${tail}`;

    expect(scanArtifactBlocks({ text: source }).spans[0]?.complete).toBe(complete);
    expect(scanArtifactBlocks({ text: `${source}\n` }).spans[0]?.complete).toBe(complete);
  });

  it.each([
    { opening: '``', closing: '~~', hasArtifact: true },
    { opening: '~~', closing: '``', hasArtifact: true },
    { opening: '```', closing: '```', hasArtifact: true },
    { opening: '~~~', closing: '~~~', hasArtifact: true },
    { opening: '````', closing: '```', hasArtifact: false },
    { opening: '~~~~', closing: '~~~', hasArtifact: false },
    { opening: '```', closing: '````', hasArtifact: true },
    { opening: '~~~', closing: '~~~~', hasArtifact: true },
    { opening: '```', closing: '~~~', hasArtifact: false },
    { opening: '~~~', closing: '```', hasArtifact: false },
    { opening: '```~', closing: '```suffix', hasArtifact: true },
    { opening: '~~~`', closing: '~~~suffix', hasArtifact: true },
  ])(
    'preserves fence character and length for $opening followed by $closing',
    ({ opening, closing, hasArtifact }) => {
      const source = ` \t${opening}\n \t${closing}\n<<artifact>>\nbody\n<</artifact>>`;

      expect(scanArtifactBlocks({ text: source }).spans).toHaveLength(hasArtifact ? 1 : 0);
    },
  );

  it('reports offsets that carve the block out of the text', () => {
    const [span] = scanArtifactBlocks({ text }).spans;
    expect(span).toBeDefined();
    expect(text.slice(span!.start, span!.end)).toBe(
      `<<artifact v=1 kind=report>>\n${body}\n<</artifact>>\n`,
    );
    expect(text.slice(span!.bodyStart, span!.bodyEnd)).toBe(body);
    expect(text.slice(0, span!.start)).toBe('intro\n\n');
    expect(text.slice(span!.end)).toBe('outro');
  });

  it('agrees with the body extractArtifactBlocks reports', () => {
    const spans = scanArtifactBlocks({ text }).spans;
    const blocks = extractArtifactBlocks(text);
    expect(spans).toHaveLength(blocks.length);
    expect(spans.map((span) => text.slice(span.bodyStart, span.bodyEnd))).toEqual(
      blocks.map((block) => block.body),
    );
  });

  it('runs an unterminated block to the end of the text', () => {
    const partial = `lead\n<<artifact v=1 kind=wireframe>>\n{"title":"Flow"`;
    const [span] = scanArtifactBlocks({ text: partial }).spans;
    expect(span).toMatchObject({ complete: false, end: partial.length, bodyEnd: partial.length });
    expect(partial.slice(0, span!.start)).toBe('lead\n');
  });

  it('opens no span for a marker inside a code fence', () => {
    expect(scanArtifactBlocks({ text: '```\n<<artifact v=1 kind=report>>\n```' }).spans).toEqual(
      [],
    );
  });

  it('matches a fresh scan for every growing prefix when resumed', () => {
    let state: ArtifactScanState | null = null;
    for (let length = 1; length <= text.length; length += 1) {
      const prefix = text.slice(0, length);
      const resumed = scanArtifactBlocks({ text: prefix, from: state });
      expect(resumed.spans).toEqual(scanArtifactBlocks({ text: prefix }).spans);
      state = resumed.state;
    }
  });

  it('carries the scanned boundary forward instead of restarting at zero', () => {
    const head = scanArtifactBlocks({ text: `intro\n\n<<artifact v=1 kind=report>>\n` });
    expect(head.state.scanned).toBe(`intro\n\n<<artifact v=1 kind=report>>\n`.length);
    expect(head.state.open).not.toBeNull();

    const tail = scanArtifactBlocks({ text, from: head.state });
    expect(tail.state.scanned).toBeGreaterThan(head.state.scanned);
    expect(tail.spans).toEqual(scanArtifactBlocks({ text }).spans);
  });

  it('starts over when the carried boundary is past the end of the text', () => {
    const stale = scanArtifactBlocks({ text }).state;
    expect(scanArtifactBlocks({ text: 'short', from: stale }).spans).toEqual([]);
  });
});
