import { useMemo } from 'react';
import type { PlanWithCount } from '@goodboy/types';
import type { SendArtifactCommentsResult } from '../../../../store/slices/artifact-comments/types';
import { dropLeadingTitleHeading } from '../ArtifactDocument/dropLeadingTitleHeading';
import { dropPartsSection } from '../../../plans/dropPartsSection';
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
  readonly onSent?: (result: SendArtifactCommentsResult) => void;
  readonly isApproveInBar?: boolean;
  readonly measure?: 'reading' | 'full';
};

type EchoParams = {
  readonly text: string;
  readonly title: string;
};

type PlainParams = {
  readonly value: string;
};

const plainLine = ({ value }: PlainParams): string => value.trim().replace(/\.$/, '').toLowerCase();

const echoesTitle = ({ text, title }: EchoParams): boolean =>
  plainLine({ value: text }) === plainLine({ value: title });

export const ArtifactPlanBody = ({
  plan,
  rows,
  hasRun,
  splitSentence,
  onOpenPart,
  onSent,
  isApproveInBar = true,
  measure = 'reading',
}: Props) => {
  const hasRows = rows.length > 0;
  const body = useMemo(() => {
    const split = splitPlanBody({
      bodyMd: dropLeadingTitleHeading({ sourceText: plan.bodyMd, title: plan.title }),
    });
    return hasRows ? { ...split, rest: dropPartsSection({ text: split.rest }) } : split;
  }, [plan.bodyMd, plan.title, hasRows]);
  const hasLead = body.lead.length > 0 && !echoesTitle({ text: body.lead, title: plan.title });

  return (
    <PlanCommentsProvider
      sessionId={plan.sessionId}
      plan={plan}
      onSent={onSent}
      isApproveInBar={isApproveInBar}
    >
      <div data-testid="plan-body" className="flex min-w-0 flex-1 flex-col gap-6">
        {hasLead ? <PlanProse text={body.lead} section="lead" measure={measure} /> : null}
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
          <PlanProse
            text={body.rest}
            section="rest"
            hasLead={!hasLead && !hasRows}
            measure={measure}
          />
        )}
      </div>
    </PlanCommentsProvider>
  );
};
