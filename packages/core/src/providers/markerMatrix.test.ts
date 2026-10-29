import { describe, expect, it } from 'vitest';
import { brandId, type ProviderId, type ProviderRunId, type TurnEvent } from '@goodboy/types';
import { TEST_NOW } from '@goodboy/types/testing';
import {
  extractHandoff,
  extractPlanFromMarker,
  extractStepDone,
  hasBlockingQuestion,
} from '../context/marker-parsing';
import { parseStreamJsonLine } from './claude/parser';
import { parseCursorStreamLine } from './cursor/parser';
import { parseJsonLine as parseCodexLine } from './codex/parser';
import { parseJsonLine as parseGeminiLine } from './gemini/parser';
import { parseJsonLine as parseCopilotLine, resetCopilotParseState } from './copilot/parser';
import { parseJsonLine as parseOpenCodeLine, resetOpenCodeParseState } from './opencode/parser';
import { resetTextBoundary } from './shared/text-boundary';

type MatrixProvider = Extract<
  ProviderId,
  'anthropic' | 'cursor' | 'codex' | 'gemini' | 'copilot' | 'opencode'
>;

const AT = TEST_NOW;
const AGENT_ID = 'agent-scout-northwind';

type Chunks = {
  readonly chunks: ReadonlyArray<string>;
};

const claudeLines = ({ chunks }: Chunks): ReadonlyArray<string> => {
  const full = chunks.join('');
  return [
    JSON.stringify({ type: 'system', subtype: 'init', session_id: 's-1' }),
    JSON.stringify({ type: 'stream_event', event: { type: 'message_start' } }),
    JSON.stringify({
      type: 'stream_event',
      event: { type: 'content_block_start', content_block: { type: 'text', text: '' } },
    }),
    ...chunks.map((text) =>
      JSON.stringify({
        type: 'stream_event',
        event: { type: 'content_block_delta', delta: { type: 'text_delta', text } },
      }),
    ),
    JSON.stringify({ type: 'stream_event', event: { type: 'content_block_stop' } }),
    JSON.stringify({
      type: 'assistant',
      message: { id: 'msg-1', content: [{ type: 'text', text: full }] },
    }),
    JSON.stringify({ type: 'result', subtype: 'success', usage: { output_tokens: 9 } }),
  ];
};

const cursorLines = ({ chunks }: Chunks): ReadonlyArray<string> => {
  const full = chunks.join('');
  return [
    JSON.stringify({ type: 'system', subtype: 'init', session_id: 'c-1' }),
    ...chunks.map((text, index) =>
      JSON.stringify({
        type: 'assistant',
        message: { role: 'assistant', content: [{ type: 'text', text }] },
        session_id: 'c-1',
        timestamp_ms: 1000 + index,
      }),
    ),
    JSON.stringify({
      type: 'assistant',
      message: { role: 'assistant', content: [{ type: 'text', text: full }] },
      session_id: 'c-1',
    }),
    JSON.stringify({ type: 'result', subtype: 'success', usage: { outputTokens: 9 } }),
  ];
};

const codexLines = ({ chunks }: Chunks): ReadonlyArray<string> => [
  JSON.stringify({ type: 'thread.started', thread_id: 't-1' }),
  JSON.stringify({ type: 'turn.started' }),
  JSON.stringify({
    type: 'item.completed',
    item: { id: 'item_1', type: 'agent_message', text: chunks.join('') },
  }),
  JSON.stringify({ type: 'turn.completed', usage: { input_tokens: 5, output_tokens: 9 } }),
];

const geminiLines = ({ chunks }: Chunks): ReadonlyArray<string> => [
  JSON.stringify({ event: 'init', conversation_id: 'g-1', init: { model: 'gemini' } }),
  ...chunks.map((text_delta) =>
    JSON.stringify({
      event: 'step_update',
      step_update: {
        conversation_id: 'g-1',
        step_index: 2,
        state: 'ACTIVE',
        step_type: 'agent_response',
        text_delta,
      },
    }),
  ),
  JSON.stringify({
    event: 'result',
    result: { conversation_id: 'g-1', status: 'SUCCESS', response: chunks.join('') },
  }),
];

const copilotLines = ({ chunks }: Chunks): ReadonlyArray<string> => [
  ...chunks.map((deltaContent) =>
    JSON.stringify({
      type: 'assistant.message_delta',
      data: { messageId: 'm1', deltaContent },
    }),
  ),
  JSON.stringify({
    type: 'assistant.message',
    data: { messageId: 'm1', content: chunks.join(''), toolRequests: [] },
  }),
];

const openCodeLines = ({ chunks }: Chunks): ReadonlyArray<string> => {
  let cumulative = '';
  return chunks.map((chunk) => {
    cumulative += chunk;
    return JSON.stringify({
      type: 'text',
      sessionID: 'o-1',
      part: { id: 'part_text', type: 'text', text: cumulative },
    });
  });
};

type Run = {
  readonly lines: (params: Chunks) => ReadonlyArray<string>;
  readonly parse: (params: {
    readonly line: string;
    readonly runId: ProviderRunId;
  }) => ReadonlyArray<TurnEvent>;
  readonly reset: (params: { readonly runId: ProviderRunId }) => void;
  readonly isStreamedInPieces: boolean;
};

const ctxOf = ({ runId }: { readonly runId: ProviderRunId }) => ({ runId, now: () => AT });

const RUNS: Readonly<Record<MatrixProvider, Run>> = {
  anthropic: {
    lines: claudeLines,
    parse: ({ line, runId }) => parseStreamJsonLine(line, ctxOf({ runId })),
    reset: ({ runId }) => resetTextBoundary({ runId }),
    isStreamedInPieces: true,
  },
  cursor: {
    lines: cursorLines,
    parse: ({ line, runId }) => parseCursorStreamLine(line, ctxOf({ runId })),
    reset: ({ runId }) => resetTextBoundary({ runId }),
    isStreamedInPieces: true,
  },
  codex: {
    lines: codexLines,
    parse: ({ line, runId }) => parseCodexLine(line, ctxOf({ runId })),
    reset: ({ runId }) => resetTextBoundary({ runId }),
    isStreamedInPieces: false,
  },
  gemini: {
    lines: geminiLines,
    parse: ({ line, runId }) => parseGeminiLine(line, ctxOf({ runId })),
    reset: ({ runId }) => resetTextBoundary({ runId }),
    isStreamedInPieces: true,
  },
  copilot: {
    lines: copilotLines,
    parse: ({ line, runId }) => parseCopilotLine({ line, ctx: ctxOf({ runId }) }),
    reset: ({ runId }) => resetCopilotParseState({ runId }),
    isStreamedInPieces: true,
  },
  opencode: {
    lines: openCodeLines,
    parse: ({ line, runId }) => parseOpenCodeLine({ line, ctx: ctxOf({ runId }) }),
    reset: ({ runId }) => resetOpenCodeParseState({ runId }),
    isStreamedInPieces: true,
  },
};

type TextParams = {
  readonly provider: MatrixProvider;
  readonly chunks: ReadonlyArray<string>;
};

let runCounter = 0;

const streamedText = ({ provider, chunks }: TextParams): string => {
  runCounter += 1;
  const runId = brandId<ProviderRunId>({ value: `run-matrix-${provider}-${runCounter}` });
  const run = RUNS[provider];
  run.reset({ runId });
  return run
    .lines({ chunks })
    .flatMap((line) => run.parse({ line, runId }))
    .map((event) => (event.kind === 'assistant_text' ? event.delta : ''))
    .join('');
};

type SplitParams = {
  readonly text: string;
  readonly marker: string;
};

const splitInsideMarker = ({ text, marker }: SplitParams): ReadonlyArray<string> => {
  const at = text.indexOf(marker) + Math.floor(marker.length / 2);
  return [text.slice(0, at), text.slice(at)];
};

type MarkerCase = {
  readonly name: string;
  readonly marker: string;
  readonly isRead: (text: string) => boolean;
};

const MARKERS: ReadonlyArray<MarkerCase> = [
  {
    name: 'step-done',
    marker: `<<step-done id="${AGENT_ID}">>`,
    isRead: (text) => extractStepDone(text)?.id === AGENT_ID,
  },
  {
    name: 'handoff',
    marker: '<<handoff kind=planner reason="the scout found three areas">>',
    isRead: (text) => extractHandoff(text)?.kind === 'planner',
  },
  {
    name: 'ctx-question',
    marker:
      '<<ctx-question blocking="true" suggestions="route a | route b" recommended="route a">>Which route first?<</ctx-question>>',
    isRead: (text) => hasBlockingQuestion({ assistantText: text }),
  },
  {
    name: 'plan',
    marker: '<<plan>>Fix the ledger-core export\n- split the batch\n- add a test<</plan>>',
    isRead: (text) => extractPlanFromMarker(text)?.title === 'Fix the ledger-core export',
  },
];

type ShapeCase = {
  readonly name: string;
  readonly compose: (marker: string) => string;
};

const SHAPES: ReadonlyArray<ShapeCase> = [
  { name: 'alone at the end', compose: (marker) => `Report ready for Northwind.\n\n${marker}` },
  { name: 'followed by more text', compose: (marker) => `Done.\n\n${marker}\n\nOne more remark.` },
  { name: 'wrapped in backticks', compose: (marker) => `Done.\n\n\`${marker}\`` },
  { name: 'inside a code fence', compose: (marker) => `Done.\n\n\`\`\`\n${marker}\n\`\`\`` },
  { name: 'on the same line as prose', compose: (marker) => `Done, closing now. ${marker}` },
  { name: 'on a CRLF line', compose: (marker) => `Done.\r\n\r\n${marker}\r\n` },
  {
    name: 'markdown escaped',
    compose: (marker) => `Done.\n\n${marker.replaceAll('<', '\\<').replaceAll('>', '\\>')}`,
  },
];

const PROVIDERS: ReadonlyArray<MatrixProvider> = [
  'anthropic',
  'cursor',
  'codex',
  'gemini',
  'copilot',
  'opencode',
];

describe('every marker reaches the extractors through every provider stream shape', () => {
  for (const provider of PROVIDERS) {
    describe(provider, () => {
      for (const marker of MARKERS) {
        for (const shape of SHAPES) {
          it(`${marker.name} ${shape.name}`, () => {
            const text = shape.compose(marker.marker);
            const received = streamedText({ provider, chunks: [text] });
            expect(marker.isRead(received)).toBe(true);
          });
        }

        it(`${marker.name} split in the middle of the marker`, () => {
          if (!RUNS[provider].isStreamedInPieces) {
            return;
          }
          const text = `Report ready.\n\n${marker.marker}`;
          const received = streamedText({
            provider,
            chunks: splitInsideMarker({ text, marker: marker.marker }),
          });
          expect(received.replaceAll('\r', '')).toContain(marker.marker);
          expect(marker.isRead(received)).toBe(true);
        });
      }
    });
  }

  it('does not count a marker for another step', () => {
    for (const provider of PROVIDERS) {
      const received = streamedText({
        provider,
        chunks: ['Done.\n\n<<step-done id="agent-other">>'],
      });
      expect(extractStepDone(received)?.id).toBe('agent-other');
      expect(extractStepDone(received)?.id).not.toBe(AGENT_ID);
    }
  });
});
