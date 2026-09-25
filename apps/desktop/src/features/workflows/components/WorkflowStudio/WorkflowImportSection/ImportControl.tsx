import { Download } from 'lucide-react';
import { AnchoredPopover, Button, useDropdown } from '@goodboy/ui';
import type { Workflow, WorkspaceId } from '@goodboy/types';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import { useWorkflowImport } from '../../WorkflowsPanel/useWorkflowImport';
import { WorkflowImportSection } from './index';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly onImported: (workflow: Workflow) => void;
};

export const ImportControl = ({ workspaceId, onImported }: Props) => {
  const dropdown = useDropdown({ align: 'end', width: 'w-80', expectedHeight: 260 });
  const importer = useWorkflowImport({
    workspaceId,
    onImported: (workflow) => {
      dropdown.close();
      onImported(workflow);
    },
  });

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel="Import workflows"
      className="bg-elevated p-3"
      trigger={
        <Button
          variant="secondary"
          size="sm"
          aria-haspopup="dialog"
          aria-expanded={dropdown.open}
          onClick={dropdown.toggle}
        >
          <Download size={ICON_SIZE.row} aria-hidden />
          Import
        </Button>
      }
    >
      <WorkflowImportSection
        projects={importer.sourceProjects}
        workspaces={importer.workspaces}
        sourceProjectId={importer.sourceProjectId}
        workflows={importer.sourceWorkflows}
        sourceWorkflowId={importer.sourceWorkflowId}
        isLoadingWorkflows={importer.isLoadingSource}
        isImporting={importer.isImporting}
        loadError={importer.sourceLoadError}
        importError={importer.importError}
        onSelectProject={(projectId) => void importer.selectSourceProject(projectId)}
        onSelectWorkflow={importer.setSourceWorkflowId}
        onImport={() => void importer.importSelected()}
      />
    </AnchoredPopover>
  );
};
