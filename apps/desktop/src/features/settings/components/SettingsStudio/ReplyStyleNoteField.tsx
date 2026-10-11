import { useEffect, useId, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { REVIEW_REPLY_SAMPLE_SIZE } from '@goodboy/core';
import type { WorkspaceId } from '@goodboy/types';
import { Button, Textarea, formatError } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { useResolution } from '../../../providers/hooks/useResolution';
import { resolutionAsTask } from '../../../providers/resolutionAsTask';
import { learnWorkspaceReplyStyle } from '../../../resolve/learnWorkspaceReplyStyle';

const LearnIcon = CONCEPT_ICONS.enhance;

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly value: string | null;
  readonly isDisabled: boolean;
  readonly onSave: (note: string | null) => void;
};

export const ReplyStyleNoteField = ({ workspaceId, value, isDisabled, onSave }: Props) => {
  const id = useId();
  const [draft, setDraft] = useState(value ?? '');
  const [isLearning, setIsLearning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const projectRoots = useAppStore(
    useShallow((s) =>
      s.projects
        .filter((project) => project.workspaceId === workspaceId && project.kind === 'repo')
        .map((project) => project.rootPath),
    ),
  );
  const resolution = useResolution({ task: 'prose_polish', workspaceId });

  useEffect(() => {
    setDraft(value ?? '');
  }, [value]);

  const learn = async () => {
    setError(null);
    setIsLearning(true);
    try {
      const note = await learnWorkspaceReplyStyle({
        workspaceId,
        projectRoots,
        taskModel: resolutionAsTask({ resolution }),
      });
      setDraft(note);
      onSave(note);
    } catch (learnError) {
      setError(formatError(learnError));
    } finally {
      setIsLearning(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-label font-medium text-foreground">
        Style note
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={isDisabled || isLearning}
          onClick={() => void learn()}
        >
          <LearnIcon size={ICON_SIZE.row} aria-hidden />
          {isLearning ? 'Reading your replies' : 'Learn from my replies'}
        </Button>
        <span className="text-meta text-faint-foreground">
          {`Reads your last ${REVIEW_REPLY_SAMPLE_SIZE} review replies in this workspace.`}
        </span>
      </div>
      <Textarea
        id={id}
        value={draft}
        autoGrow
        minRows={2}
        disabled={isDisabled || isLearning}
        placeholder="Short. Starts lowercase. Never thanks."
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          if (draft !== (value ?? '')) {
            onSave(draft.trim() === '' ? null : draft);
          }
        }}
      />
      {error !== null && <p className="text-meta text-danger">{error}</p>}
      <p className="text-meta text-muted-foreground">
        You can edit this note. Agents follow it instead of a preset, and replies stay terse until
        it has text.
      </p>
    </div>
  );
};
