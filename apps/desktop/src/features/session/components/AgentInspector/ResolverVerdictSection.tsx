import { Markdown } from '@goodboy/ui';
import type { ResolverVerdict } from '../../resolverVerdicts';
import { ResolverPanelSection } from './ResolverPanelSection';

type Props = {
  readonly verdicts: ReadonlyArray<ResolverVerdict>;
};

export const ResolverVerdictSection = ({ verdicts }: Props) => {
  if (verdicts.length === 0) {
    return null;
  }

  return (
    <ResolverPanelSection label="Verdict">
      {verdicts.map((verdict) => (
        <div key={verdict.threadId} className="flex flex-col gap-1.5">
          {verdicts.length > 1 && (
            <span className="font-mono text-2xs text-muted-foreground/60">{verdict.threadId}</span>
          )}
          {verdict.prose !== null && (
            <div className="text-2xs leading-relaxed text-foreground/80">
              <Markdown text={verdict.prose} />
            </div>
          )}
          {verdict.reply !== null && (
            <div className="flex flex-col gap-0.5 rounded-md bg-muted/40 px-2 py-1.5">
              <span className="text-[9px] uppercase tracking-wide text-muted-foreground/60">
                Reply to post
              </span>
              <p className="text-2xs leading-relaxed text-muted-foreground">{verdict.reply}</p>
            </div>
          )}
        </div>
      ))}
    </ResolverPanelSection>
  );
};
