export type TelemetrySummary = Readonly<{
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  recordCount: number;
}>;
