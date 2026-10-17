import { useContext, useEffect, useState, type ReactNode } from 'react';
import type { ResolvedFact } from '../../../detail-fields/factTypes';
import { RecordFrameContext } from '../RecordFrameContext';
import { RecordProperties } from '../RecordProperties';
import { X } from 'lucide-react';
import { Button, IconButton, StarToggle, useInheritedPaneActions } from '@goodboy/ui';
import {
  IntegrationGlyph,
  integrationLabel,
  type IntegrationGlyphProvider,
} from '../../../../features/integrations/components/IntegrationGlyph';
import { ICON_SIZE } from '../../conceptIcons';
import { RecordActions } from '../RecordActions';
import { NO_RECORD_VERBS, type RecordFrame, type RecordVerbs } from '../RecordActions/types';
import { ObjectOverflowMenu } from '../../../../features/actions/components/ObjectOverflowMenu';
import { useObjectMenuTrigger } from '../../../../features/actions/useObjectMenuTrigger';
import type { RecordActionTarget } from '../../../../features/actions/types';

const NO_FACTS: ReadonlyArray<ResolvedFact> = [];

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
  frame: ownFrame = null,
  onRefresh = null,
}: Props) => {
  const sharedFrame = useContext(RecordFrameContext);
  const frame = ownFrame ?? sharedFrame;
  const [armedKey, setArmedKey] = useState<string | null>(null);
  const hostLabel = integrationLabel({ provider });
  const armed = verbs.secondary.find((verb) => verb.key === armedKey) ?? null;
  const inheritedActions = useInheritedPaneActions();
  const star = frame?.star ?? null;
  const onOpenFull = frame?.onOpenFull ?? null;
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
      launchLabel: null,
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
        <span className="shrink-0 font-mono text-ui text-muted-foreground">{identifier}</span>
        {star === null ? null : (
          <StarToggle
            isStarred={star.isStarred}
            label={`Star ${identifier}`}
            tooltip={star.isStarred ? 'Unstar' : 'Star to keep it at the top'}
            onToggle={star.onToggle}
            className="size-6"
          />
        )}
        {state}
        <span className="min-w-0 flex-1" />
        {inheritedActions}
        {frame?.primary ?? null}
        {onOpenFull === null ? null : (
          <Button variant="ghost" size="sm" onClick={onOpenFull}>
            Open full
          </Button>
        )}
        <ObjectOverflowMenu
          target={target}
          label={`More actions for ${identifier}`}
          anchorKey={`record-header:${identifier}`}
          size="control"
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
      <h1 onContextMenu={menu.onContextMenu} className="text-lead text-foreground">
        {title}
      </h1>
      {byline == null ? null : (
        <div className="truncate text-ui text-faint-foreground">{byline}</div>
      )}
      <RecordFrameContext.Provider value={frame}>
        {facts ?? <RecordProperties facts={NO_FACTS} />}
      </RecordFrameContext.Provider>
      {frame?.link == null ? null : <div className="flex min-w-0">{frame.link}</div>}
      <RecordActions
        primary={null}
        secondary={verbs.secondary}
        armed={armed}
        onArm={setArmedKey}
        onDisarm={() => setArmedKey(null)}
      />
    </div>
  );
};
