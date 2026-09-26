import { useEffect, useState, type ReactNode } from 'react';
import { ArrowUpRight, X } from 'lucide-react';
import { IconButton, useCopyLink } from '@goodboy/ui';
import {
  IntegrationGlyph,
  integrationLabel,
  type IntegrationGlyphProvider,
} from '../../../../features/integrations/components/IntegrationGlyph';
import { openUrl } from '../../../lib/editor';
import { ICON_SIZE } from '../../conceptIcons';
import { RecordActions } from '../RecordActions';
import { NO_RECORD_VERBS, type RecordFrame, type RecordVerbs } from '../RecordActions/types';
import { RecordOverflowMenu } from './RecordOverflowMenu';
import { useInheritedPaneActions } from '../../PaneShell/paneActionsContext';

type ExternalRef = {
  readonly url: string;
  readonly label: string;
};

type Props = {
  readonly provider: IntegrationGlyphProvider;
  readonly identifier: string;
  readonly title: string;
  readonly state?: ReactNode;
  readonly facts?: ReactNode;
  readonly externalRef?: ExternalRef | null;
  readonly verbs?: RecordVerbs;
  readonly frame?: RecordFrame | null;
  readonly onRefresh?: (() => void) | null;
};

export const RecordHeader = ({
  provider,
  identifier,
  title,
  state,
  facts,
  externalRef = null,
  verbs = NO_RECORD_VERBS,
  frame = null,
  onRefresh = null,
}: Props) => {
  const [armedKey, setArmedKey] = useState<string | null>(null);
  const { copy } = useCopyLink();
  const hostLabel = integrationLabel({ provider });
  const armed = verbs.secondary.find((verb) => verb.key === armedKey) ?? null;
  const inheritedActions = useInheritedPaneActions();

  useEffect(() => {
    setArmedKey(null);
  }, [identifier]);

  return (
    <div data-slot="record-header" className="flex min-w-0 flex-col gap-2">
      <div className="flex h-7 min-w-0 items-center gap-2">
        <IntegrationGlyph provider={provider} size="xs" useBrandColor />
        <span className="shrink-0 font-mono text-2xs tabular-nums text-muted-foreground">
          {identifier}
        </span>
        {state}
        <span className="min-w-0 flex-1" />
        {inheritedActions}
        {externalRef != null ? (
          <IconButton
            icon={ArrowUpRight}
            variant="ghost"
            iconSize={ICON_SIZE.control}
            label={`Open in ${hostLabel}`}
            onClick={() => void openUrl(externalRef.url)}
          />
        ) : null}
        <RecordOverflowMenu
          label={`More actions for ${identifier}`}
          overflow={verbs.overflow}
          sessionVerbs={frame?.sessionVerbs ?? []}
          destructive={verbs.destructive}
          onRefresh={onRefresh ?? frame?.onRefresh ?? null}
          onCopyLink={externalRef == null ? null : () => void copy({ text: externalRef.url })}
        />
        {frame?.onClose != null ? (
          <IconButton
            icon={X}
            variant="ghost"
            iconSize={ICON_SIZE.control}
            label="Close the item"
            onClick={frame.onClose}
          />
        ) : null}
      </div>
      <h1 className="line-clamp-3 text-base font-semibold leading-snug text-foreground">{title}</h1>
      {facts}
      <RecordActions
        primary={frame?.primary ?? null}
        secondary={verbs.secondary}
        armed={armed}
        onArm={setArmedKey}
        onDisarm={() => setArmedKey(null)}
      />
    </div>
  );
};
