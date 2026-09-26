import {
  ArchiveRestore,
  Bot,
  Copy,
  Download,
  ExternalLink,
  FileDown,
  FolderOpen,
  Pencil,
  Play,
  RotateCcw,
  RotateCw,
  Square,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import type { ArtifactActionId } from './artifactActions';

type ActionPresentation = Readonly<{
  label: string;
  icon: LucideIcon;
  description?: string;
}>;

export const ARTIFACT_ACTION_PRESENTATION = {
  runPlan: { label: 'Run plan', icon: Play },
  runAgain: { label: 'Run again', icon: RotateCw },
  restore: { label: 'Restore', icon: ArchiveRestore },
  edit: { label: 'Edit', icon: Pencil },
  stop: { label: 'Stop', icon: Square },
  newVariant: { label: 'New variant', icon: RotateCcw },
  export: { label: 'Export', icon: Download },
  openInBrowser: {
    label: 'Open in browser',
    icon: ExternalLink,
    description: 'Opens the saved file. Print it from there as a PDF.',
  },
  copySource: { label: 'Copy', icon: Copy },
  saveSource: { label: 'Save a copy', icon: FileDown },
  showInFinder: {
    label: 'Show in Finder',
    icon: FolderOpen,
    description: 'The copy Goodboy keeps on disk for this artifact',
  },
  regenerate: {
    label: 'Regenerate',
    icon: RotateCcw,
    description: 'Writes a new report from the same evidence',
  },
  discard: { label: 'Discard', icon: Trash2 },
  openAgent: { label: 'Open agent', icon: Bot },
} as const satisfies Record<ArtifactActionId, ActionPresentation>;
