export type ReduceTranscriptTrace = {
  processed: number;
};

export const reduceTranscriptTrace: ReduceTranscriptTrace = { processed: 0 };

export const resetReduceTranscriptTrace = (): void => {
  reduceTranscriptTrace.processed = 0;
};
