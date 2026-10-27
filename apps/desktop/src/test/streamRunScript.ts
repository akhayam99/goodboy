type ScriptParams = {
  readonly textDeltas: number;
};

type DeltaParams = {
  readonly index: number;
};

const textDeltaLine = ({ index }: DeltaParams): string =>
  JSON.stringify({
    type: 'stream_event',
    event: {
      type: 'content_block_delta',
      delta: {
        type: 'text_delta',
        text: `Reconciled batch ${index} of the Harborline ledger export. `,
      },
    },
  });

export const streamRunScript = ({ textDeltas }: ScriptParams): ReadonlyArray<string> => [
  JSON.stringify({ type: 'stream_event', event: { type: 'message_start' } }),
  ...Array.from({ length: textDeltas }, (_, index) => textDeltaLine({ index })),
  JSON.stringify({
    type: 'assistant',
    message: {
      content: [
        {
          type: 'tool_use',
          id: 'tool-1',
          name: 'Bash',
          input: { command: 'pnpm test --filter ledger-core' },
        },
      ],
    },
  }),
  JSON.stringify({
    type: 'user',
    message: {
      content: [{ type: 'tool_result', tool_use_id: 'tool-1', content: 'ok', is_error: false }],
    },
  }),
  JSON.stringify({
    type: 'result',
    subtype: 'success',
    usage: { input_tokens: 10, output_tokens: 5 },
  }),
];
