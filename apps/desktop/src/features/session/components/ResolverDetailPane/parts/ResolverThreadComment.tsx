import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Markdown, SectionHeader, cn } from '@goodboy/ui';
import { GhostActionButton } from '@goodboy/ui';

type Props = {
  readonly author: string | null;
  readonly location: string | null;
  readonly body: string;
};

const CLAMP_CHARS = 180;
const CLAMP_LINES = 3;

const isClampable = ({ body }: { readonly body: string }): boolean =>
  body.length > CLAMP_CHARS ||
  body.split('\n').filter((line) => line.trim() !== '').length > CLAMP_LINES;

export const ResolverThreadComment = ({ author, location, body }: Props) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const canExpand = isClampable({ body });
  const who = author?.trim() ?? '';
  const where = location?.trim() ?? '';

  return (
    <section className="flex flex-col gap-1">
      <SectionHeader
        label="Reviewer"
        action={
          <span className="flex min-w-0 items-center gap-1.5 text-2xs text-muted-foreground/60">
            {who !== '' && <span className="truncate font-medium text-foreground/70">{who}</span>}
            {where !== '' && <span className="truncate font-mono tabular-nums">{where}</span>}
          </span>
        }
      />
      <Markdown
        text={body}
        className={cn(
          'gap-1 text-xs leading-relaxed text-muted-foreground',
          canExpand && !isExpanded && 'line-clamp-3',
        )}
      />
      {canExpand && (
        <div className="flex">
          <GhostActionButton
            icon={isExpanded ? ChevronUp : ChevronDown}
            label={isExpanded ? 'Show less' : 'Show more'}
            onClick={() => setIsExpanded((current) => !current)}
          />
        </div>
      )}
    </section>
  );
};
