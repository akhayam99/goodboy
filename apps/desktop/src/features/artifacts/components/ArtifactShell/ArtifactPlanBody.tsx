import { useMemo } from 'react';
import type { PlanWithCount } from '@goodboy/types';
import { dropLeadingTitleHeading } from '../ArtifactDocument/dropLeadingTitleHeading';
import { splitPlanBody } from '../../../plans/splitPlanBody';
import { PlanParts } from '../../../plans/components/PlanParts';
import type { PlanPartRow } from '../../../plans/components/PlanParts/planPartRows';
import { PartCommentFrame } from '../PlanComments/PartCommentFrame';
import { PlanCommentsProvider } from '../PlanComments/PlanCommentsProvider';
import { PlanProse } from '../PlanComments/PlanProse';

type Props = {
  readonly plan: PlanWithCount;
  readonly rows: ReadonlyArray<PlanPartRow>;
  readonly hasRun: boolean;
  readonly splitSentence: string;
  readonly onOpenPart: (row: PlanPartRow) => void;
};

export const ArtifactPlanBody = ({ plan, rows, hasRun, splitSentence, onOpenPart }: Props) => {
  const body = useMemo(
    () =>
      splitPlanBody({
        bodyMd: dropLeadingTitleHeading({ sourceText: plan.bodyMd, title: plan.title }),
      }),
    [plan.bodyMd, plan.title],
  );
  const hasLead = body.lead.length > 0;

  return (
    <PlanCommentsProvider sessionId={plan.sessionId} plan={plan}>
      <div data-testid="plan-body" className="flex min-w-0 flex-col gap-6">
        {hasLead ? <PlanProse text={body.lead} section="lead" /> : null}
        <PlanParts
          sessionId={plan.sessionId}
          planId={plan.id}
          rows={rows}
          hasRun={hasRun}
          splitSentence={splitSentence}
          onOpenPart={onOpenPart}
          frameRow={({ row, children }) => (
            <PartCommentFrame index={row.index} title={row.title}>
              {children}
            </PartCommentFrame>
          )}
        />
        {body.rest.trim().length === 0 ? null : (
          <PlanProse text={body.rest} section="rest" hasLead={!hasLead && rows.length === 0} />
        )}
      </div>
    </PlanCommentsProvider>
  );
};
