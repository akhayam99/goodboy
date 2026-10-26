import { useEffect, useMemo, useState } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { Button, Notice } from '@goodboy/ui';
import { useAppStore } from '../../../../../store';
import { pluralize } from '../../../../../shared/utils/pluralize';
import { SavedModelsRow } from './SavedModelsRow';
import { savedModelFacts } from './savedModelFacts';

type Props = {
  readonly workspaceId: WorkspaceId;
};

export const SavedModelsNotice = ({ workspaceId }: Props) => {
  const projects = useAppStore((state) => state.projects);
  const saved = useAppStore((state) => state.savedProjectModels);
  const loadSavedProjectModels = useAppStore((state) => state.loadSavedProjectModels);
  const applySavedProjectModels = useAppStore((state) => state.applySavedProjectModels);
  const discardSavedProjectModels = useAppStore((state) => state.discardSavedProjectModels);
  const reportError = useAppStore((state) => state.reportError);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    void loadSavedProjectModels().catch((error: unknown) =>
      reportError({ title: "Couldn't read the saved folder model settings", error, workspaceId }),
    );
  }, [loadSavedProjectModels, reportError, workspaceId]);

  const entries = useMemo(
    () => savedModelFacts({ projects, saved, workspaceId }),
    [projects, saved, workspaceId],
  );
  if (entries.length === 0) {
    return null;
  }

  return (
    <Notice
      tone="info"
      placement="inline"
      role="status"
      title={`Saved model settings from ${pluralize(entries.length, 'folder')} no longer apply.`}
      actions={
        <Button
          variant="ghost"
          size="sm"
          aria-expanded={isExpanded}
          onClick={() => setIsExpanded((isOpen) => !isOpen)}
        >
          {isExpanded ? 'Hide' : 'Show'}
        </Button>
      }
    >
      {isExpanded ? (
        <ul aria-label="Folders with saved model settings" className="flex flex-col gap-1">
          {entries.map((entry) => (
            <SavedModelsRow
              key={entry.projectId}
              entry={entry}
              onApply={() => applySavedProjectModels({ projectId: entry.projectId, workspaceId })}
              onDiscard={() => discardSavedProjectModels({ projectId: entry.projectId })}
            />
          ))}
        </ul>
      ) : null}
    </Notice>
  );
};
