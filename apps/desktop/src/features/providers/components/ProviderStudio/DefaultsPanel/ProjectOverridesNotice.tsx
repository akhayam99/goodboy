import { useMemo, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import type { WorkspaceId } from '@goodboy/types';
import { Button, ConfirmPopover, Notice } from '@goodboy/ui';
import { useAppStore } from '../../../../../store';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import { pluralize } from '../../../../../shared/utils/pluralize';
import { ProjectOverrideRow } from './ProjectOverrideRow';
import { projectOverrideFacts } from './projectOverrideFacts';
import { projectOverrideSentence } from './projectOverrideSentence';

type Props = {
  readonly workspaceId: WorkspaceId;
};

export const ProjectOverridesNotice = ({ workspaceId }: Props) => {
  const projects = useAppStore((state) => state.projects);
  const clearProjectModelOverrides = useAppStore((state) => state.clearProjectModelOverrides);
  const [isExpanded, setIsExpanded] = useState(false);
  const entries = useMemo(
    () => projectOverrideFacts({ projects, workspaceId }),
    [projects, workspaceId],
  );
  if (entries.length === 0) {
    return null;
  }
  const isSingle = entries.length === 1;

  const clearAll = async () => {
    for (const entry of entries) {
      await clearProjectModelOverrides({ projectId: entry.projectId });
    }
  };

  return (
    <Notice
      tone="info"
      placement="inline"
      role="status"
      title={
        isSingle
          ? '1 project has its own model settings'
          : `${pluralize(entries.length, 'project')} have their own model settings`
      }
      body={projectOverrideSentence({ entries })}
      actions={
        <>
          <ConfirmPopover
            role="alert"
            icon={<RotateCcw size={ICON_SIZE.control} aria-hidden />}
            title={`Clear model settings of ${pluralize(entries.length, 'project')}?`}
            description={
              isSingle
                ? 'Its orchestrator, summaries and roles follow this page again.'
                : 'Their orchestrators, summaries and roles follow this page again.'
            }
            confirmLabel="Clear"
            align="end"
            onConfirm={clearAll}
            trigger={({ arm }) => (
              <Button variant="secondary" size="sm" onClick={arm}>
                Use this page instead
              </Button>
            )}
          />
          <Button
            variant="ghost"
            size="sm"
            aria-expanded={isExpanded}
            onClick={() => setIsExpanded((current) => !current)}
          >
            {isExpanded ? 'Hide' : 'Show'}
          </Button>
        </>
      }
    >
      {isExpanded ? (
        <ul aria-label="Projects with their own model settings" className="flex flex-col gap-1">
          {entries.map((entry) => (
            <ProjectOverrideRow
              key={entry.projectId}
              entry={entry}
              onClear={() => clearProjectModelOverrides({ projectId: entry.projectId })}
            />
          ))}
        </ul>
      ) : null}
    </Notice>
  );
};
