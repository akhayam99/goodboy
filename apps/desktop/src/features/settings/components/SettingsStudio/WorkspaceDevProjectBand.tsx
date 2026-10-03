import { useState } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { Band, Button, FieldRow } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { ConvertWorkspaceFlow } from '../../../workspace/convertWorkspace';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly isInitiallyOpen: boolean;
};

export const WorkspaceDevProjectBand = ({ workspaceId, isInitiallyOpen }: Props) => {
  const project = useAppStore(
    (s) =>
      s.projects.find(
        (candidate) => candidate.workspaceId === workspaceId && candidate.kind === 'folder',
      ) ?? null,
  );
  const [isOpen, setIsOpen] = useState(isInitiallyOpen);

  if (project === null) {
    return null;
  }

  return (
    <Band
      inset="content"
      label="Dev project"
      ariaLabel="Dev project"
      hint="For a project that started as a plain folder."
      icon={<CONCEPT_ICONS.projectFolder size={ICON_SIZE.row} aria-hidden />}
      headingLevel={2}
    >
      <FieldRow
        label={`Turn ${project.name} into a dev project`}
        help="Gives it a git repository, so sessions get their own branch and pull requests."
      >
        <Button
          variant="secondary"
          size="sm"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((current) => !current)}
        >
          {isOpen ? 'Hide' : 'Convert…'}
        </Button>
      </FieldRow>
      {isOpen ? (
        <ConvertWorkspaceFlow
          workspaceId={workspaceId}
          project={project}
          onClose={() => setIsOpen(false)}
        />
      ) : null}
    </Band>
  );
};
