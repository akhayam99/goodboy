import { useEffect } from 'react';
import { ChevronDown, FileJson, FolderOpen, Plus } from '@goodboy/ui/icons';
import {
  AnchoredPopover,
  Button,
  ICON_SIZE,
  MenuTriggerButton,
  useDropdown,
  type MenuEntry,
} from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { revealLabelOf } from '../../../../shared/utils/revealLabelOf';
import { ARTIFACT_KIND_CONCEPT } from '../../artifactPresentation';
import { newArtifactEventName } from '../../newArtifactEventName';
import { openArtifactsFolder } from '../../artifactMirror/artifactMirrorInvoke';
import { sessionById } from '../../../../store/slices/sessions/sessionIndex';
import { AppMenuList } from '../../../actions/AppMenuList';

type Props = {
  readonly sessionId: SessionId;
  readonly isEmpty: boolean;
  readonly onImportWireframe: () => void;
};

const FILES_LABEL = 'Artifact files';

export const ArtifactNewMenu = ({ sessionId, isEmpty, onImportWireframe }: Props) => {
  const openArtifactCreation = useAppStore((state) => state.openArtifactCreation);
  const workspaceSlug = useAppStore((state) => {
    const workspaceId = sessionById(state.sessions, sessionId)?.workspaceId;
    return state.workspaces.find((workspace) => workspace.id === workspaceId)?.slug ?? null;
  });
  const dropdown = useDropdown({
    align: 'end',
    width: 'w-80 max-w-[calc(100vw-2rem)]',
    expectedHeight: 170,
    expectedWidth: 320,
  });
  const isOpen = dropdown.open;
  const toggle = dropdown.toggle;

  useEffect(() => {
    const name = newArtifactEventName(sessionId);
    const listener = () => {
      if (!isOpen) {
        toggle();
      }
    };
    window.addEventListener(name, listener);
    return () => window.removeEventListener(name, listener);
  }, [isOpen, toggle, sessionId]);

  const fileEntries: ReadonlyArray<MenuEntry> = [
    {
      kind: 'item',
      key: 'import-wireframe',
      label: 'Import wireframe JSON…',
      description: 'Import a .json spec',
      icon: FileJson,
      onSelect: onImportWireframe,
    },
    { kind: 'separator', key: 'folder-separator' },
    {
      kind: 'item',
      key: 'show-folder',
      label: revealLabelOf(),
      icon: FolderOpen,
      isDisabled: workspaceSlug === null,
      onSelect: () => {
        if (workspaceSlug !== null) {
          void openArtifactsFolder({ workspaceSlug });
        }
      },
    },
  ];

  if (!isEmpty) {
    return (
      <AnchoredPopover
        dropdown={dropdown}
        trigger={
          <MenuTriggerButton
            label={FILES_LABEL}
            isOpen={dropdown.open}
            size="control"
            onClick={dropdown.toggle}
          >
            <FolderOpen size={ICON_SIZE.control} aria-hidden />
          </MenuTriggerButton>
        }
      >
        <AppMenuList label={FILES_LABEL} onClose={dropdown.close} entries={fileEntries} />
      </AnchoredPopover>
    );
  }

  return (
    <AnchoredPopover
      dropdown={dropdown}
      trigger={
        <Button
          variant="secondary"
          size="sm"
          onClick={dropdown.toggle}
          aria-haspopup="menu"
          aria-expanded={dropdown.open}
          data-testid="artifact-new"
        >
          <Plus size={ICON_SIZE.row} aria-hidden />
          New artifact
          <ChevronDown size={ICON_SIZE.row} aria-hidden className="text-muted-foreground" />
        </Button>
      }
    >
      <AppMenuList
        label="New artifact"
        onClose={dropdown.close}
        entries={[
          {
            kind: 'item',
            key: 'report',
            label: 'Report',
            description: 'Writes up what this session did, from its agents and changes',
            icon: CONCEPT_ICONS[ARTIFACT_KIND_CONCEPT.report],
            onSelect: () =>
              openArtifactCreation({ sessionId, kind: 'report', workflowRunId: null }),
          },
          {
            kind: 'item',
            key: 'wireframe',
            label: 'Wireframe',
            description: 'Draws the screens and the flow you describe',
            icon: CONCEPT_ICONS[ARTIFACT_KIND_CONCEPT.wireframe],
            onSelect: () =>
              openArtifactCreation({ sessionId, kind: 'wireframe', workflowRunId: null }),
          },
          ...fileEntries,
        ]}
      />
    </AnchoredPopover>
  );
};
