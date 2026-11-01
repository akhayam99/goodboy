import type { ResolveStage, ResolveThread } from '@goodboy/types';

type Params = {
  readonly thread: Pick<ResolveThread, 'stage'>;
};

const SETTLED: ReadonlySet<ResolveStage> = new Set<ResolveStage>(['resolved', 'parked']);

export const isOpenThread = ({ thread }: Params): boolean => !SETTLED.has(thread.stage);
