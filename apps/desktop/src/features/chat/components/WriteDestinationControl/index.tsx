import { useState } from 'react';
import {
  AnchoredPopover,
  Button,
  Chip,
  SelectableRow,
  formatError,
  useDropdown,
} from '@goodboy/ui';
import type { AgentId, MountId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import {
  writeDestinationDetail,
  writeDestinationLabel,
  type WriteDestinationCandidate,
} from '../../../../store/slices/project-mounts/writeDestination';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { useToast } from '../../../../app/components/Toast';
import { useWriteDestination } from './useWriteDestination';

type Props = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId | null;
};

const MAX_LABEL_LENGTH = 46;

const shorten = (label: string): string =>
  label.length > MAX_LABEL_LENGTH ? `${label.slice(0, MAX_LABEL_LENGTH - 1)}…` : label;

export const WriteDestinationControl = ({ sessionId, agentId }: Props) => {
  const { next, candidates, running, diverges } = useWriteDestination({ sessionId, agentId });
  const setSessionActiveMount = useAppStore((state) => state.setSessionActiveMount);
  const { showToast } = useToast();
  const dropdown = useDropdown({ width: 'w-96', expectedHeight: 320 });
  const [pendingMountId, setPendingMountId] = useState<MountId | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  const nextLabel = writeDestinationLabel(next);
  const runningLabel = running === null ? null : writeDestinationLabel(running);
  const nextDetail = writeDestinationDetail(next);
  const runningDetail = running === null ? null : writeDestinationDetail(running);

  const isUnselected = next.kind === 'unselected';

  const primaryLabel = isUnselected
    ? 'Choose destination'
    : running === null
      ? `Write to: ${nextLabel}`
      : diverges
        ? `In progress: ${runningLabel}`
        : `In progress and next turns: ${nextLabel}`;

  const primaryTitle = isUnselected
    ? nextDetail
    : running === null
      ? `Writing to ${nextDetail}`
      : diverges
        ? `This turn started on ${runningDetail}. Next turns write to ${nextDetail} unless changed.`
        : `This turn and the next ones write to ${nextDetail}.`;

  const Icon = next.kind === 'scratch' ? CONCEPT_ICONS.folderOpen : CONCEPT_ICONS.worktree;
  const hasCandidates = candidates.length > 0;

  const openPicker = () => {
    if (!hasCandidates) {
      return;
    }
    setPendingMountId(next.kind === 'mount' ? next.mountId : null);
    dropdown.toggle();
  };

  const applyPending = async () => {
    if (pendingMountId === null) {
      return;
    }
    setIsApplying(true);
    try {
      await setSessionActiveMount({ sessionId, mountId: pendingMountId });
      dropdown.close();
    } catch (error) {
      showToast('error', formatError(error));
    } finally {
      setIsApplying(false);
    }
  };

  const currentMountId = next.kind === 'mount' ? next.mountId : null;
  const canApply = pendingMountId !== null && pendingMountId !== currentMountId;

  const trigger = (
    <Chip
      as="button"
      tone={diverges || isUnselected ? 'warning' : 'neutral'}
      size="xs"
      bordered={false}
      icon={<Icon size={ICON_SIZE.row} aria-hidden />}
      label={<span className="max-w-[16rem] truncate">{shorten(primaryLabel)}</span>}
      title={primaryTitle}
      ariaLabel={`Write destination. ${primaryTitle}`}
      hasPopup="dialog"
      expanded={dropdown.open}
      onClick={openPicker}
      disabled={!hasCandidates}
      className="shrink-0"
    />
  );

  return (
    <span className="inline-flex min-w-0 shrink-0 items-center gap-1">
      <AnchoredPopover
        dropdown={dropdown}
        role="dialog"
        ariaLabel="Choose write destination"
        anchorClassName="shrink-0"
        trigger={trigger}
      >
        <div className="flex flex-col gap-3 p-3">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-foreground">Write destination</span>
            <span className="text-2xs text-muted-foreground">
              {isUnselected
                ? 'This session has more than one branch mount. Pick the one the next turns write to.'
                : 'Applies to the next turns of this session, for every agent.'}
            </span>
          </div>

          {running !== null && diverges ? (
            <div className="flex flex-col gap-0.5 rounded-md bg-muted/40 px-2 py-1.5 text-2xs">
              <span className="text-muted-foreground">In progress: {runningLabel}</span>
              <span className="text-muted-foreground">Next turns: {nextLabel}</span>
            </div>
          ) : null}

          <ul className="flex flex-col gap-0.5" role="listbox" aria-label="Mounted projects">
            {candidates.map((candidate: WriteDestinationCandidate) => (
              <li key={candidate.mountId}>
                <SelectableRow
                  role="option"
                  ariaSelected={pendingMountId === candidate.mountId}
                  selected={pendingMountId === candidate.mountId}
                  onClick={() => setPendingMountId(candidate.mountId)}
                  className="flex-col items-start gap-0 px-2 py-1.5"
                >
                  <span className="truncate text-xs">
                    {candidate.projectName} / {candidate.mountName}
                  </span>
                  <span className="truncate text-3xs text-muted-foreground">
                    {candidate.hasGit ? candidate.branch : 'no git'} · {candidate.worktreePath}
                  </span>
                </SelectableRow>
              </li>
            ))}
          </ul>

          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={!canApply || isApplying}
              onClick={() => void applyPending()}
            >
              {isApplying ? 'Applying…' : 'Use for next turns of the session'}
            </Button>
          </div>
        </div>
      </AnchoredPopover>
      {running !== null && diverges ? (
        <Chip
          tone="accent"
          size="3xs"
          bordered={false}
          label={<span className="max-w-[10rem] truncate">{`Next: ${shorten(nextLabel)}`}</span>}
          title={`Next turns write to ${nextDetail}.`}
        />
      ) : null}
    </span>
  );
};
