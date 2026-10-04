import { useEffect } from 'react';
import { Info, Lock, Wrench } from 'lucide-react';
import { Band, BandRow, SectionHeader } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { revealInFileManager } from '../../../../shared/lib/reveal';
import { formatBytes } from '../../../../shared/utils/formatBytes';
import type { OtherToolUsage } from '../../otherTools';
import { OtherToolRow } from './OtherToolRow';

const SHOWN_FROM_BYTES = 100 * 1024 * 1024;

export const OtherToolsSection = () => {
  const otherTools = useAppStore((state) => state.storageOtherTools);
  const loadOtherTools = useAppStore((state) => state.loadOtherTools);
  const cancelOtherTools = useAppStore((state) => state.cancelOtherTools);
  const reportError = useAppStore((state) => state.reportError);

  useEffect(() => {
    void loadOtherTools().catch((error: unknown) =>
      reportError({ title: "Couldn't measure the other tools", error }),
    );
    return () => {
      void cancelOtherTools().catch(() => undefined);
    };
  }, [loadOtherTools, cancelOtherTools, reportError]);

  const shown = otherTools.tools.filter((tool) => tool.bytes >= SHOWN_FROM_BYTES);
  const total = shown.reduce((sum, tool) => sum + tool.bytes, 0);
  const isMeasuring = otherTools.status === 'measuring';

  const onReveal = (tool: OtherToolUsage) =>
    void revealInFileManager({ path: tool.path }).catch((error: unknown) =>
      reportError({ title: "Couldn't show the folder", error }),
    );

  return (
    <section id="storage-other-tools" aria-label="Other tools" className="flex flex-col gap-2">
      <SectionHeader
        label="Other tools"
        icon={<Wrench size={ICON_SIZE.row} aria-hidden />}
        meta={
          <span className="flex items-center gap-1 text-meta text-faint-foreground">
            <Lock size={ICON_SIZE.control} aria-hidden />
            Read only
          </span>
        }
        action={
          <span className="text-meta text-faint-foreground">
            {isMeasuring && shown.length === 0
              ? 'Measuring…'
              : `${formatBytes({ bytes: total })} · not counted in what can go`}
          </span>
        }
      />
      <Band>
        {shown.length === 0 ? (
          <p className="px-2 py-2 text-label text-muted-foreground">
            {isMeasuring ? 'Measuring…' : 'No other tool keeps more than 100 MB on this Mac.'}
          </p>
        ) : (
          shown.map((tool) => <OtherToolRow key={tool.id} tool={tool} onReveal={onReveal} />)
        )}
        <BandRow>
          <Info size={ICON_SIZE.row} aria-hidden className="shrink-0 text-faint-foreground" />
          <span className="text-meta text-faint-foreground">
            Goodboy reads sizes and folder names, never the files inside. These tools keep their own
            history, so nothing here is offered for cleanup. Tools under 100 MB are left out.
          </span>
        </BandRow>
      </Band>
    </section>
  );
};
