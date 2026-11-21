import type { IconGlyph } from '@goodboy/ui/icons';
import { CheckCheck, Copy, Link, Mail, MailOpen, Pencil, ScrollText } from '@goodboy/ui/icons';
import { CONCEPT_ICONS } from '../components/conceptIcons';
import { NAMES } from './names';

export type Verb = {
  readonly label: string;
  readonly icon: IconGlyph;
};

export const VERBS = {
  openInChanges: { label: NAMES.openInChanges, icon: CONCEPT_ICONS.diff },
  openInTerminal: { label: NAMES.openInTerminal, icon: CONCEPT_ICONS.terminal },
  openInExternalTerminal: { label: NAMES.openInExternalTerminal, icon: CONCEPT_ICONS.terminal },
  openTranscript: { label: NAMES.openTranscript, icon: ScrollText },
  copyPath: { label: 'Copy path', icon: Copy },
  copyWorktreePath: { label: 'Copy worktree path', icon: Copy },
  copyFolderPath: { label: 'Copy folder path', icon: Copy },
  copyLink: { label: 'Copy link', icon: Link },
  editDraft: { label: 'Edit', icon: Pencil },
  markAsRead: { label: NAMES.markAsRead, icon: MailOpen },
  markAsUnread: { label: NAMES.markAsUnread, icon: Mail },
  markAllAsRead: { label: NAMES.markAllAsRead, icon: CheckCheck },
} as const satisfies Record<string, Verb>;

type EditorParams = {
  readonly editorLabel: string | null;
};

export const openInEditorLabelOf = ({ editorLabel }: EditorParams): string =>
  editorLabel === null ? 'Open in editor' : `Open in ${editorLabel}`;
