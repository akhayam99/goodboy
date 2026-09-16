export type ReduceTranscriptTrace = {
  processed: number;
  textScans: number;
  textScanRestarts: number;
  textScanChars: number;
};

export const reduceTranscriptTrace: ReduceTranscriptTrace = {
  processed: 0,
  textScans: 0,
  textScanRestarts: 0,
  textScanChars: 0,
};

export const resetReduceTranscriptTrace = (): void => {
  reduceTranscriptTrace.processed = 0;
  reduceTranscriptTrace.textScans = 0;
  reduceTranscriptTrace.textScanRestarts = 0;
  reduceTranscriptTrace.textScanChars = 0;
};
