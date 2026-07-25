type Props = {
  readonly promptPrefix: string;
  readonly expectedOutput: string;
  readonly outputSummary: string;
};

const LABEL_CLS = 'text-2xs font-semibold uppercase tracking-wide text-muted-foreground/60';
const BODY_CLS = 'whitespace-pre-wrap text-[11px] leading-relaxed text-muted-foreground';

export const WorkflowStepBrief = ({ promptPrefix, expectedOutput, outputSummary }: Props) => (
  <div className="flex flex-col gap-2 rounded-md bg-muted/30 px-2.5 py-2">
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
        <p className={BODY_CLS}>{outputSummary}</p>
      </div>
    ) : null}
  </div>
);
