import { cn, tintClasses } from '@goodboy/ui';
import { ExternalLink } from 'lucide-react';
import type { ProviderGuide } from './guides';

type Props = {
  readonly guide: ProviderGuide;
};

export const GuidePanel = ({ guide }: Props) => {
  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-heading text-foreground">{guide.headline}</h3>
        {guide.subscription ? (
          <p className="text-secondary text-muted-foreground">
            <span className="font-medium text-muted-foreground">Needs: </span>
            {guide.subscription}
          </p>
        ) : null}
      </div>

      <ol className="flex flex-col gap-3">
        {guide.steps.map((step, idx) => (
          <li key={step.title} className="flex gap-2.5">
            <span
              aria-hidden
              className={cn(
                'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
                tintClasses('primary').bg,
                'text-secondary font-semibold text-primary',
              )}
            >
              {idx + 1}
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-label font-medium text-foreground">{step.title}</span>
              <span className="text-2xs leading-relaxed text-muted-foreground">{step.body}</span>
            </div>
          </li>
        ))}
      </ol>

      <a
        href={guide.docsUrl}
        target="_blank"
        rel="noreferrer"
        className="mt-auto inline-flex items-center gap-1.5 text-secondary text-muted-foreground transition-colors hover:text-foreground"
      >
        <span>{guide.docsLabel}</span>
        <ExternalLink size={10} aria-hidden />
      </a>
    </div>
  );
};
