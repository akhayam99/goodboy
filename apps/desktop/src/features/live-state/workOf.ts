import type { LiveWorkRow } from './readLiveWork';
import { workingPhraseOf } from './workingPhraseOf';

export type WorkPlace =
  Readonly<{ kind: 'project'; name: string }> | Readonly<{ kind: 'session'; title: string }>;

export type Work = Readonly<{
  runId: string;
  sessionId: string | null;
  agentId: string | null;
  mountId: string | null;
  workflowRunId: string | null;
  place: WorkPlace;
  phrase: string;
  startedAt: number | null;
  quietMs: number | null;
}>;

type Params = {
  readonly rows: ReadonlyArray<LiveWorkRow>;
  readonly mountNames: ReadonlyMap<string, string>;
  readonly sessionTitles: ReadonlyMap<string, string>;
};

type PlaceParams = Omit<Params, 'rows'> & {
  readonly row: LiveWorkRow;
};

const workPlaceOf = ({ row, mountNames, sessionTitles }: PlaceParams): WorkPlace => {
  const project = row.mountId === null ? undefined : mountNames.get(row.mountId);
  if (project !== undefined) {
    return { kind: 'project', name: project };
  }
  const title = row.sessionId === null ? undefined : sessionTitles.get(row.sessionId);
  return { kind: 'session', title: title ?? '' };
};

export const workOf = ({ rows, mountNames, sessionTitles }: Params): ReadonlyArray<Work> =>
  rows.map((row) => {
    const place = workPlaceOf({ row, mountNames, sessionTitles });
    return {
      runId: row.runId,
      sessionId: row.sessionId,
      agentId: row.agentId,
      mountId: row.mountId,
      workflowRunId: row.workflowRunId,
      place,
      phrase: workingPhraseOf({
        tool: row.tool,
        project: place.kind === 'project' ? place.name : null,
        hasToolCall: row.hasToolCall,
        canSeeTools: row.canSeeTools,
      }),
      startedAt: row.startedAt,
      quietMs: row.quietMs,
    };
  });
