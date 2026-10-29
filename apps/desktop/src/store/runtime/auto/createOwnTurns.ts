type RunParams = Readonly<{
  runId: string;
}>;

export type OwnTurns = Readonly<{
  begin: (params: RunParams) => void;
  end: (params: RunParams) => void;
  has: (params: RunParams) => boolean;
}>;

export const createOwnTurns = (): OwnTurns => {
  const runIds = new Set<string>();
  return {
    begin: ({ runId }) => {
      runIds.add(runId);
    },
    end: ({ runId }) => {
      runIds.delete(runId);
    },
    has: ({ runId }) => runIds.has(runId),
  };
};
