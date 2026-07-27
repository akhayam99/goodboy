import { Markdown } from '@goodboy/ui';
import { stripControlMarkers } from '@goodboy/core';

type Props = {
  readonly promptPrefix: string;
  readonly expectedOutput: string;
  readonly outputSummary: string;
};

const LABEL_CLS = 'text-2xs font-semibold uppercase tracking-wide text-muted-foreground/60';
const BODY_CLS = 'whitespace-pre-wrap text-[11px] leading-relaxed text-muted-foreground';
const OUTPUT_MARKDOWN_CLS = 'text-[11px] text-muted-foreground';

export const WorkflowStepBrief = ({ promptPrefix, expectedOutput, outputSummary }: Props) => (
  <div className="flex flex-col gap-2 pl-4">
    {promptPrefix !== '' ? (
      <div className="flex flex-col gap-0.5">
        <span className={LABEL_CLS}>Instructions</span>
        <p className={BODY_CLS}>{promptPrefix}</p>
      </div>
    ) : null}
    {expectedOutput !== '' ? (
      <div className="flex flex-col gap-0.5">
        <span className={LABEL_CLS}>Expected output</span>
        <p className={BODY_CLS}>{expectedOutput}</p>
      </div>
    ) : null}
    {outputSummary !== '' ? (
      <div className="flex flex-col gap-0.5">
        <span className={LABEL_CLS}>What it produced</span>
        <Markdown text={stripControlMarkers(outputSummary)} className={OUTPUT_MARKDOWN_CLS} />
      </div>
    ) : null}
  </div>
);
