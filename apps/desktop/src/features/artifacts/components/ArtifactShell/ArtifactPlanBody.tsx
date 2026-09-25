import { useMemo } from 'react';
import type { PlanWithCount } from '@goodboy/types';
import { dropLeadingTitleHeading } from '../../../reports/components/ArtifactPrintView/dropLeadingTitleHeading';
import { splitPlanBody } from '../../../plans/splitPlanBody';
import { PlanParts } from '../../../plans/components/PlanParts';
import type { PlanPartRow } from '../../../plans/components/PlanParts/planPartRows';
import { ArtifactProse } from '../ArtifactProse';

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
    <div data-testid="plan-body" className="flex min-w-0 flex-col gap-6">
      {hasLead ? <ArtifactProse text={body.lead} /> : null}
      <PlanParts
        rows={rows}
        hasRun={hasRun}
        splitSentence={splitSentence}
        onOpenPart={onOpenPart}
      />
      {body.rest.trim().length === 0 ? null : (
        <ArtifactProse text={body.rest} hasLead={!hasLead && rows.length === 0} />
      )}
    </div>
  );
};
