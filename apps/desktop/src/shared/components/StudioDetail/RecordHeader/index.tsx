import { useEffect, useState, type ReactNode } from 'react';
import { ArrowUpRight, Ellipsis, X } from 'lucide-react';
import { IconButton, useInheritedPaneActions } from '@goodboy/ui';
import {
  IntegrationGlyph,
  integrationLabel,
  type IntegrationGlyphProvider,
} from '../../../../features/integrations/components/IntegrationGlyph';
import { openUrl } from '../../../lib/editor';
import { ICON_SIZE } from '../../conceptIcons';
import { RecordActions } from '../RecordActions';
import { NO_RECORD_VERBS, type RecordFrame, type RecordVerbs } from '../RecordActions/types';
import { ObjectOverflowMenu } from '../../../../features/actions/components/ObjectOverflowMenu';
import { useObjectMenuTrigger } from '../../../../features/actions/useObjectMenuTrigger';
import type { RecordActionTarget } from '../../../../features/actions/types';

const RECORD_HEADER_OMISSIONS: ReadonlyArray<string> = ['record.openInProvider'];

type ExternalRef = {
  readonly url: string;
  readonly label: string;
};

type Props = {
  readonly provider: IntegrationGlyphProvider;
  readonly identifier: string;
  readonly title: string;
  readonly state?: ReactNode;
  readonly byline?: ReactNode;
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
  byline,
  facts,
  externalRef = null,
  verbs = NO_RECORD_VERBS,
  frame = null,
  onRefresh = null,
}: Props) => {
  const [armedKey, setArmedKey] = useState<string | null>(null);
  const hostLabel = integrationLabel({ provider });
  const armed = verbs.secondary.find((verb) => verb.key === armedKey) ?? null;
  const inheritedActions = useInheritedPaneActions();
  const target: RecordActionTarget = {
    kind: 'record',
    facts: {
      identifier,
      title,
      url: externalRef?.url ?? '',
      providerLabel: hostLabel,
      sessionId: null,
      isStarred: null,
      onOpen: null,
      onLaunch: null,
      onToggleStar: null,
      onRefresh: onRefresh ?? frame?.onRefresh ?? null,
      verbs: verbs.overflow,
      sessionVerbs: frame?.sessionVerbs ?? [],
      destructive: verbs.destructive,
    },
  };
  const menu = useObjectMenuTrigger({ target, anchorKey: `record-header:${identifier}` });

  useEffect(() => {
    setArmedKey(null);
  }, [identifier]);

  return (
    <div data-slot="record-header" className="flex min-w-0 flex-col gap-2">
      <div className="flex h-7 min-w-0 items-center gap-2">
        <IntegrationGlyph provider={provider} size="xs" useBrandColor />
        <span className="shrink-0 font-mono text-secondary tabular-nums text-muted-foreground">
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
        <ObjectOverflowMenu
          target={target}
          label={`More actions for ${identifier}`}
          anchorKey={`record-header:${identifier}`}
          trigger={<Ellipsis size={ICON_SIZE.control} aria-hidden />}
          triggerClassName="p-1.5"
          omit={RECORD_HEADER_OMISSIONS}
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
      <h1
        onContextMenu={menu.onContextMenu}
        className="line-clamp-3 text-base font-semibold leading-snug text-foreground"
      >
        {title}
      </h1>
      {byline == null ? null : (
        <div className="truncate text-meta text-faint-foreground">{byline}</div>
      )}
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
