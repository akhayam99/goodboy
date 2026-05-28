import { ExternalLink } from 'lucide-react';
import type { ProviderGuide } from './guides';

interface Props {
  readonly guide: ProviderGuide;
}

// Sidebar inside the modal: subscription line, numbered steps, docs link.
// Scrollable independently of the terminal so a long guide does not push the
// PTY off-screen on small viewports.
export function GuidePanel({ guide }: Props) {
  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold text-foreground">{guide.headline}</h3>
        {guide.subscription ? (
          <p className="text-2xs text-muted-foreground">
            <span className="font-medium text-foreground/70">Needs: </span>
            {guide.subscription}
          </p>
        ) : null}
      </div>

      <ol className="flex flex-col gap-3">
        {guide.steps.map((step, idx) => (
          <li key={step.title} className="flex gap-2.5">
            <span
              aria-hidden
              className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-2xs font-semibold text-primary"
            >
              {idx + 1}
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-xs font-medium text-foreground">{step.title}</span>
              <span className="text-2xs leading-relaxed text-muted-foreground">{step.body}</span>
            </div>
          </li>
        ))}
      </ol>

      <a
        href={guide.docsUrl}
        target="_blank"
        rel="noreferrer"
        className="mt-auto inline-flex items-center gap-1.5 text-2xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <span>{guide.docsLabel}</span>
        <ExternalLink size={10} aria-hidden />
      </a>
    </div>
  );
}
