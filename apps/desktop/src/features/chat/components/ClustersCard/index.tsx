import { useMemo, useState } from 'react';
import { ChevronRight, Layers } from 'lucide-react';
import { extractClustersFromMarker } from '@goodboy/core';
import { Markdown, cn } from '@goodboy/ui';
import { MARKER_ACCENT } from '../marker-accents';

type Props = {
  readonly assistantText: string;
};

const accent = MARKER_ACCENT.clusters;

export const ClustersCard = ({ assistantText }: Props) => {
  const clusters = useMemo(() => extractClustersFromMarker(assistantText), [assistantText]);

  if (!clusters || clusters.length === 0) {
    return null;
  }

  return (
    <div
      className={`mt-2 rounded-lg border ${accent.border} ${accent.bg} px-3 py-2`}
      data-testid="clusters-card"
    >
      <div className={`flex items-center gap-1.5 text-[11px] font-medium ${accent.text}`}>
        <Layers size={12} aria-hidden />
        <span>
          {clusters.length} cluster{clusters.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="mt-1.5 flex flex-col gap-1">
        {clusters.map((c, i) => (
          <ClusterRow key={i} index={i + 1} title={c.title} instructions={c.instructions} />
        ))}
      </div>
    </div>
  );
};

function ClusterRow({
  index,
  title,
  instructions,
}: {
  index: number;
  title: string;
  instructions: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left text-xs hover:bg-merged/10"
      >
        <ChevronRight
          size={10}
          aria-hidden
          className={cn(
            'shrink-0 text-merged/60 motion-safe:transition-transform',
            open && 'rotate-90',
          )}
        />
        <span className="text-foreground/70">{index}.</span>
        <span className="min-w-0 truncate text-foreground/90">{title}</span>
      </button>
      {open ? (
        <div className="ml-5 mt-0.5 border-l-2 border-merged/20 pl-2 text-xs">
          <Markdown text={instructions} />
        </div>
      ) : null}
    </div>
  );
}
