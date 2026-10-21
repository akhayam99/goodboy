import { Check, CircleDashed } from 'lucide-react';
import { Markdown } from '@goodboy/ui';
import { parseRunSummaryText } from '@goodboy/core';
import type { Session } from '@goodboy/types';
import { useFreshLanding } from '../../../chat/reveal/useFreshLanding';
import { RunFinishedActions } from '../AgentTree/RunFinishedActions';
import type { RunView } from '../AgentTree/useRunView';
import { decisionEntries } from '../../../workflows/decisionEntries';
import { ORCHESTRATED_COPY } from '../../../workflows/orchestratedCopy';
import { OrchestratedResultGroup } from './OrchestratedResultGroup';

type Props = {
  readonly session: Session;
  readonly view: RunView;
};

export const OrchestratedResult = ({ session, view }: Props) => {
  const { run, workflow } = view;
  const reason = decisionEntries({ run, steps: workflow.steps }).closing?.reason ?? '';
  const text = run.orchestratorSummary?.trim() ?? '';
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
      {reason === '' ? null : <p className="text-read text-foreground">{reason}</p>}
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
      {view.isDiscarded ? null : (
        <RunFinishedActions sessionId={session.id} workflowRunId={run.id} />
      )}
    </section>
  );
};
