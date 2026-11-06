import type { ProviderRunId } from '@goodboy/types';

export type ErrorDock = Readonly<{
  runId: ProviderRunId | null;
}>;
