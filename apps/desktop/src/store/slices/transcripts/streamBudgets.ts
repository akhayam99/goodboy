type RunLengthParams = {
  readonly runLength: number;
};

export const STREAM_BUDGETS = {
  initialTranscriptRows: 50,
  initialTranscriptBytes: 64 * 1024,
  concurrentRunCounts: [1, 8, 32],
  listenersPerWindow: 1,
  listenerCallsPerEnvelope: 1,
  copiedRowsPerEvent: ({ runLength }: RunLengthParams): number => runLength,
  dispatchMsPerEvent: 0.25,
  totalMsPerEvent: 1,
} as const;
