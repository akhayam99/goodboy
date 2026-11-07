import { Check, CircleDashed } from 'lucide-react';
import { Button, Markdown } from '@goodboy/ui';
import { parseRunSummaryText } from '@goodboy/core/orchestrator';
import type { Session } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { branchPlace } from '../../../../store/slices/navigation/place';
import { useFreshLanding } from '../../../chat/reveal/useFreshLanding';
import { RunFinishedActions } from '../AgentTree/RunFinishedActions';
import { RunNotFinishedLinks } from '../RunNotFinishedLinks';
import type { RunView } from '../AgentTree/useRunView';
import { decisionEntries } from '../../../workflows/decisionEntries';
import { runOutcomeTextOf } from '../../../workflows/runOutcomeTextOf';
import { useSessionRuns } from '../../hooks/useSessionRuns';
import { ORCHESTRATED_COPY } from '../../../workflows/orchestratedCopy';
import { OrchestratedResultGroup } from './OrchestratedResultGroup';

type Props = {
  readonly session: Session;
  readonly view: RunView;
};

export const OrchestratedResult = ({ session, view }: Props) => {
  const { run, workflow } = view;
  const reason = decisionEntries({ run, steps: workflow.steps }).closing?.reason ?? '';
  const text = runOutcomeTextOf({ run, agents: view.agents });
  const navigate = useAppStore((state) => state.navigate);
  const runs = useSessionRuns({ session });
  const branch =
    runs.find(({ open }) => open.kind === 'run' && open.runId === run.id)?.branches[0] ?? null;
  const summary = parseRunSummaryText(text);
  const landing = useFreshLanding({ liveKey: run.id, text });

  return (
    <section
      key={landing.fadeKey}
      {...landing.fade}
      aria-label="Result"
      data-orchestrated-result=""
      className="flex min-w-0 flex-col gap-4"
    >
      {reason === '' ? null : <Markdown text={reason} className="text-prose text-foreground" />}
      {summary === null ? (
        text === '' ? null : (
          <Markdown text={text} className="text-ui text-foreground" />
        )
      ) : (
        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <OrchestratedResultGroup
            label={ORCHESTRATED_COPY.done}
            entries={summary.done}
            glyph={<Check className="size-3 text-success" />}
          />
          <OrchestratedResultGroup
            label={ORCHESTRATED_COPY.left}
            entries={summary.left}
            glyph={<CircleDashed className="size-3 text-faint-foreground" />}
          />
        </div>
      )}
      <RunNotFinishedLinks session={session} view={view} />
      {view.isDiscarded ? null : (
        <RunFinishedActions
          sessionId={session.id}
          workflowRunId={run.id}
          trailing={
            branch === null ? null : (
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  navigate({
                    to: branchPlace({ sessionId: session.id, mountPath: branch.worktreePath }),
                  })
                }
              >
                Open branch
              </Button>
            )
          }
        />
      )}
    </section>
  );
};
