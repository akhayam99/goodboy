import type { IconGlyph } from '@goodboy/ui/icons';
import { Chip, ICON_SIZE } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { AgentKindChip } from '../../../../../shared/components/AgentKindChip';
import { CONCEPT_ICONS } from '../../../../../shared/components/conceptIcons';
import { askAgentKindOf } from '../../askAgentKindOf';
import type { AskHandle, AskTarget } from '../../askHandles';

type Props = {
  readonly sessionId: SessionId;
  readonly handle: AskHandle;
  readonly onOpen: (handle: AskHandle) => void;
};

const GLYPH: Readonly<Record<AskTarget['kind'], IconGlyph>> = {
  agent: CONCEPT_ICONS.agents,
  run: CONCEPT_ICONS.workflows,
  question: CONCEPT_ICONS.questions,
  comment: CONCEPT_ICONS.comments,
  pr: CONCEPT_ICONS.pr,
  artifact: CONCEPT_ICONS.plans,
  file: CONCEPT_ICONS.diff,
};

export const AskChip = ({ sessionId, handle, onOpen }: Props) => {
  const { target } = handle;
  const agentKind = useAppStore((state) =>
    target.kind === 'agent' ? askAgentKindOf({ state, sessionId, agentId: target.agentId }) : null,
  );
  const Icon = GLYPH[target.kind];
  const isFile = target.kind === 'file';
  const glyph =
    agentKind === null ? (
      <Icon size={ICON_SIZE.row} aria-hidden className="text-muted-foreground" />
    ) : (
      <AgentKindChip kind={agentKind} density="glyph" isDecorative />
    );
  return (
    <Chip
      kind="reference"
      as="button"
      tone="neutral"
      testId="ask-chip"
      ariaLabel={`Open ${handle.label}`}
      icon={isFile ? null : glyph}
      label={isFile ? <span className="font-mono text-info">{handle.label}</span> : handle.label}
      onClick={() => onOpen(handle)}
    />
  );
};
