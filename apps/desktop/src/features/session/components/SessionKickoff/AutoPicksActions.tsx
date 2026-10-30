import { Button, FormActions } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { NAMES } from '../../../../shared/utils/names';
import { AutoLimitChip } from '../../../auto/AutoLimitChip';
import type { AutoTreeLimitModel } from '../../../auto/useAutoTreeLimit';
import { START_KIND_COPY } from '../../startKind/startKindCopy';
import { limitKindOfRoute } from '../../startRun/limitKindOfRoute';
import { RUN_ROUTE_COPY } from '../../startRun/runRouteCopy';
import { RunChoiceChips } from '../StartRun/RunChoiceChips';
import type { StartRunModel } from '../StartRun/useStartRun';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly run: StartRunModel;
  readonly limit: AutoTreeLimitModel;
};

export const AutoPicksActions = ({ workspaceId, run, limit }: Props) => {
  const patchSessionDraft = useAppStore((state) => state.patchSessionDraft);
  const hasText = run.text.trim() !== '';
  const limitKind = limitKindOfRoute({ route: run.route.route });

  return (
    <section aria-label={RUN_ROUTE_COPY.label} className="flex flex-col gap-6">
      <p className="text-meta text-muted-foreground">{RUN_ROUTE_COPY.hint}</p>
      <FormActions
        leading={
          <div className="flex flex-wrap items-center gap-2">
            <RunChoiceChips run={run} workspaceId={workspaceId} role={null} />
            {limitKind === null ? null : (
              <AutoLimitChip limit={limit} kind={limitKind} isDisabled={run.isStarting} />
            )}
            <Button
              variant="ghost"
              size="sm"
              disabled={run.isStarting}
              onClick={() =>
                patchSessionDraft({
                  workspaceId,
                  patch: { startKind: null, startShape: null, hasChosenStart: true },
                })
              }
            >
              {START_KIND_COPY.pickYourself}
            </Button>
          </div>
        }
        error={run.error}
      >
        {hasText && !run.isStarting ? (
          <Button variant="ghost" size="md" onClick={run.discard}>
            {RUN_ROUTE_COPY.discard}
          </Button>
        ) : null}
        <Button
          size="md"
          disabled={!hasText || run.isStarting}
          isBusy={run.isStarting}
          busyLabel={RUN_ROUTE_COPY.starting}
          onClick={() => void run.start()}
        >
          {run.error === null ? RUN_ROUTE_COPY.start : NAMES.retry}
        </Button>
      </FormActions>
    </section>
  );
};
