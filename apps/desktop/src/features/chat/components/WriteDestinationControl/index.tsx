import { useState } from 'react';
import { AnchoredPopover, Button, Chip, SelectableRow, useDropdown } from '@goodboy/ui';
import type { AgentId, MountId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import {
  mountDisplayName,
  writeDestinationDetail,
  writeDestinationLabel,
  type WriteDestinationCandidate,
} from '../../../../store/slices/project-mounts/writeDestination';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { useWriteDestination } from './useWriteDestination';

type Props = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId | null;
  readonly fallback?: 'automatic';
};

const REACH_LIST = new Intl.ListFormat('en', { type: 'conjunction' });

export const WriteDestinationControl = ({ sessionId, agentId, fallback }: Props) => {
  const { next, candidates, running, diverges, isAutomatic } = useWriteDestination({
    sessionId,
    agentId,
    fallback,
  });
  const setSessionActiveMount = useAppStore((state) => state.setSessionActiveMount);
  const reportError = useAppStore((state) => state.reportError);
  const dropdown = useDropdown({ width: 'w-96', expectedHeight: 320 });
  const [pendingMountId, setPendingMountId] = useState<MountId | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  const nextLabel = writeDestinationLabel(next);
  const runningLabel = running === null ? null : writeDestinationLabel(running);
  const nextDetail = writeDestinationDetail(next);
  const runningDetail = running === null ? null : writeDestinationDetail(running);

  const reachNames = candidates
    .filter((candidate) => next.kind !== 'mount' || candidate.mountId !== next.mountId)
    .map((candidate) =>
      mountDisplayName({ projectName: candidate.projectName, mountName: candidate.mountName }),
    );
  const reachSentence =
    reachNames.length === 0 ? '' : ` Can also write in ${REACH_LIST.format(reachNames)}.`;

  const primaryVerb = running === null ? 'Starts in' : 'Running in';
  const primaryTarget =
    running === null ? (next.kind === 'scratch' ? 'session folder' : nextLabel) : runningLabel;

  const primaryTitle =
    running === null
      ? `Starts in ${nextDetail}.${isAutomatic ? ' Picked automatically.' : ''}${reachSentence}`
      : diverges
        ? `This turn runs in ${runningDetail}. New turns start in ${nextDetail}.`
        : `This turn runs in ${nextDetail}. New turns start there too.${reachSentence}`;

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
      void reportError({ title: "Couldn't change where new turns start", error, sessionId });
    } finally {
      setIsApplying(false);
    }
  };

  const currentMountId = isAutomatic || next.kind !== 'mount' ? null : next.mountId;
  const canApply = pendingMountId !== null && pendingMountId !== currentMountId;

  const trigger = (
    <Chip
      as="button"
      tone={diverges ? 'warning' : 'neutral'}
      size="xs"
      bordered={false}
      icon={<Icon size={ICON_SIZE.row} aria-hidden />}
      label={
        <span className="flex min-w-0 items-baseline gap-1">
          <span className="shrink-0 text-muted-foreground">{primaryVerb}</span>{' '}
          <span className="min-w-0 truncate text-foreground">{primaryTarget ?? nextLabel}</span>
        </span>
      }
      title={primaryTitle}
      ariaLabel={`Where turns start. ${primaryTitle}`}
      hasPopup="dialog"
      expanded={dropdown.open}
      onClick={openPicker}
      disabled={!hasCandidates}
      className="min-w-0 max-w-full"
    />
  );

  return (
    <span className="inline-flex min-w-0 max-w-96 items-center gap-1">
      <AnchoredPopover
        dropdown={dropdown}
        role="dialog"
        ariaLabel="Choose where new turns start"
        anchorClassName="flex min-w-0"
        trigger={trigger}
      >
        <div className="flex flex-col gap-3 p-3">
          <span className="text-heading text-foreground">New turns start in</span>

          {running !== null && diverges ? (
            <div className="flex flex-col gap-0.5 rounded-md bg-subtle px-2 py-1.5 text-secondary">
              <span className="text-muted-foreground">This turn runs in {runningLabel}</span>
              <span className="text-muted-foreground">New turns start in {nextLabel}</span>
            </div>
          ) : null}

          <ul className="flex flex-col gap-0.5" role="listbox" aria-label="Places a turn can start">
            {candidates.map((candidate: WriteDestinationCandidate) => (
              <li key={candidate.mountId}>
                <SelectableRow
                  role="option"
                  ariaSelected={pendingMountId === candidate.mountId}
                  selected={pendingMountId === candidate.mountId}
                  onClick={() => setPendingMountId(candidate.mountId)}
                  className="flex-col items-start gap-0 px-2 py-1.5"
                >
                  <span className="truncate text-label">
                    {mountDisplayName({
                      projectName: candidate.projectName,
                      mountName: candidate.mountName,
                    })}
                  </span>
                  <span className="truncate text-meta text-muted-foreground">
                    {candidate.hasGit ? candidate.branch : 'no git'} · {candidate.worktreePath}
                  </span>
                </SelectableRow>
              </li>
            ))}
          </ul>

          <span className="text-secondary text-muted-foreground">
            Every agent can write in all of them. This picks where a new turn opens its terminal,
            runs git and shows its pull request.
          </span>

          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={!canApply || isApplying}
              onClick={() => void applyPending()}
            >
              {isApplying ? 'Applying…' : 'Start new turns here'}
            </Button>
          </div>
        </div>
      </AnchoredPopover>
      {running !== null && diverges ? (
        <Chip
          tone="primary"
          size="3xs"
          bordered={false}
          label={<span className="max-w-40 truncate">{`Next: ${nextLabel}`}</span>}
          title={`New turns start in ${nextDetail}.`}
        />
      ) : null}
    </span>
  );
};
