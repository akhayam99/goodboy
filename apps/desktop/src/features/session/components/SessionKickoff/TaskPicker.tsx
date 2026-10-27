import { useMemo } from 'react';
import { ICON_SIZE, Listbox, type ListboxOption } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { draftIssueKey } from '../../../../store/slices/sessionDraft/draftIssueKey';
import { selectSessionDraft } from '../../../../store/slices/sessionDraft/selectSessionDraft';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { useInboxRecords } from '../../../inbox/useInboxRecords';
import type { IssueCandidate } from '../../../integrations/fetchIssueCandidates';
import { candidateOfRecord } from '../../../integrations/starred/candidateOfRecord';
import { primaryProjectRoot } from '../../../workspace/primaryProjectRoot';
import { issueGoalOf } from '../../issueGoalOf';
import { START_KIND_COPY } from '../../startKind/startKindCopy';
import { START_PICK_TRIGGER } from './startPickTrigger';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly isDisabled: boolean;
};

const LOADING = 'Loading tasks';

export const TaskPicker = ({ workspaceId, isDisabled }: Props) => {
  const rootPath = useAppStore((state) =>
    primaryProjectRoot({ projects: state.projects, workspaceId }),
  );
  const inbox = useInboxRecords({ workspaceId, rootPath: rootPath ?? '' });
  const patchSessionDraft = useAppStore((state) => state.patchSessionDraft);
  const candidates = useMemo(() => {
    const byKey = new Map<string, IssueCandidate>();
    for (const record of inbox.records) {
      const candidate = candidateOfRecord(record);
      if (candidate !== null) {
        byKey.set(draftIssueKey({ candidate }), candidate);
      }
    }
    return byKey;
  }, [inbox.records]);
  const options = useMemo(
    (): ReadonlyArray<ListboxOption<string>> =>
      [...candidates.entries()].map(([key, candidate]) => ({
        value: key,
        label: candidate.title,
        meta: <span className="text-meta text-faint-foreground">{candidate.identifier}</span>,
        keywords: candidate.identifier,
      })),
    [candidates],
  );
  const TaskIcon = CONCEPT_ICONS.issues;

  const attach = (key: string): void => {
    const candidate = candidates.get(key);
    if (candidate === undefined) {
      return;
    }
    const draft = selectSessionDraft({ state: useAppStore.getState(), workspaceId });
    patchSessionDraft({
      workspaceId,
      patch: {
        pickedIssues: [candidate],
        ...(draft.workflowGoal.trim() === '' && {
          workflowGoal: issueGoalOf({ candidate }),
        }),
      },
    });
  };

  return (
    <Listbox
      size="sm"
      ariaLabel={START_KIND_COPY.pickTask}
      className={START_PICK_TRIGGER}
      value={null}
      options={options}
      onChange={attach}
      disabled={isDisabled}
      searchable
      searchLabel={START_KIND_COPY.searchTasks}
      searchPlaceholder={START_KIND_COPY.searchTasks}
      emptyLabel={START_KIND_COPY.noTasks}
      {...(inbox.isLoading && options.length === 0 && { status: LOADING })}
      valueLabel={
        <>
          <TaskIcon size={ICON_SIZE.row} aria-hidden className="shrink-0 text-muted-foreground" />
          <span className="truncate text-foreground">{START_KIND_COPY.pickTask}</span>
        </>
      }
    />
  );
};
