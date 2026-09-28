import { Copy, FolderX, GitBranch, Play, Unlink, XCircle } from 'lucide-react';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import type { MountActionTarget, ObjectKindDefinition } from '../types';

export type MountConfirmKind = 'unmount' | 'forget' | 'detach';

export const MOUNT_CONFIRM_EVENT = 'goodboy:mount-confirm';

export type MountConfirmRequest = {
  readonly mountKey: string;
  readonly kind: MountConfirmKind;
};

export const requestMountConfirm = ({ mountKey, kind }: MountConfirmRequest): void => {
  window.dispatchEvent(
    new CustomEvent<MountConfirmRequest>(MOUNT_CONFIRM_EVENT, { detail: { mountKey, kind } }),
  );
};

export type MountEditor = {
  readonly binary: string;
  readonly label: string;
};

export type MountFacts = {
  readonly mountKey: string;
  readonly noun: 'worktree' | 'folder';
  readonly worktreePath: string | null;
  readonly branch: string;
  readonly hasTools: boolean;
  readonly canStartTurnsHere: boolean;
  readonly hasMount: boolean;
  readonly isAttached: boolean;
  readonly canDetach: boolean;
  readonly editors: ReadonlyArray<MountEditor>;
  readonly onTerminal: () => void;
  readonly onScripts: () => void;
  readonly onStartTurnsHere: () => void;
  readonly onOpenEditor: (binary: string) => void;
  readonly onRewriteHistory?: (() => void) | null;
};

type FactsOnly = { readonly facts: MountFacts };

const confirmInMenu =
  (kind: MountConfirmKind) =>
  ({ facts }: FactsOnly): void =>
    requestMountConfirm({ mountKey: facts.mountKey, kind });

export const MOUNT_KIND: ObjectKindDefinition<MountActionTarget, MountFacts> = {
  noun: 'project',
  facts: ({ target }) => target.facts,
  actions: [
    {
      id: 'mount.terminal',
      label: 'Open terminal',
      icon: CONCEPT_ICONS.terminal,
      group: 'open',
      when: ({ facts }) => facts.hasTools,
      run: ({ facts }) => facts.onTerminal(),
    },
    {
      id: 'mount.scripts',
      label: 'Open scripts',
      icon: CONCEPT_ICONS.scripts,
      group: 'open',
      when: ({ facts }) => facts.hasTools,
      run: ({ facts }) => facts.onScripts(),
    },
    {
      id: 'mount.editor',
      label: 'Open in editor',
      icon: CONCEPT_ICONS.editor,
      group: 'open',
      when: ({ facts }) => facts.hasTools,
      blockedReason: ({ facts }) => (facts.editors.length === 0 ? 'No editor detected' : null),
      choices: ({ facts }) =>
        facts.editors.map((editor) => ({
          id: editor.binary,
          label: editor.label,
          isCurrent: false,
        })),
      run: ({ facts, choice }) => {
        if (choice !== null) {
          facts.onOpenEditor(choice);
        }
      },
    },
    {
      id: 'mount.startTurns',
      label: 'Start new turns here',
      icon: Play,
      group: 'act',
      when: ({ facts }) => facts.hasTools && facts.canStartTurnsHere,
      run: ({ facts }) => facts.onStartTurnsHere(),
    },
    {
      id: 'mount.rewriteHistory',
      label: 'Rewrite history',
      icon: CONCEPT_ICONS.history,
      group: 'act',
      when: ({ facts }) => facts.hasTools && facts.onRewriteHistory != null,
      run: ({ facts }) => facts.onRewriteHistory?.(),
    },
    {
      id: 'mount.copyPath',
      label: 'Copy path',
      icon: Copy,
      group: 'copy',
      when: ({ facts }) => facts.hasTools && facts.worktreePath !== null,
      run: ({ facts, env }) => env.copyText({ text: facts.worktreePath ?? '' }),
    },
    {
      id: 'mount.copyBranch',
      label: 'Copy branch name',
      icon: GitBranch,
      group: 'copy',
      when: ({ facts }) => facts.hasMount && facts.branch !== '',
      run: ({ facts, env }) => env.copyText({ text: facts.branch }),
    },
    {
      id: 'mount.close',
      label: ({ facts }) => `Close ${facts.noun}`,
      icon: XCircle,
      group: 'danger',
      hasCustomConfirm: true,
      when: ({ facts }) => facts.hasMount && facts.isAttached,
      run: confirmInMenu('unmount'),
    },
    {
      id: 'mount.remove',
      label: 'Remove from session',
      icon: FolderX,
      group: 'danger',
      hasCustomConfirm: true,
      when: ({ facts }) => facts.hasMount && !facts.isAttached,
      run: confirmInMenu('forget'),
    },
    {
      id: 'mount.detach',
      label: 'Detach project',
      icon: Unlink,
      group: 'danger',
      hasCustomConfirm: true,
      when: ({ facts }) => facts.canDetach,
      run: confirmInMenu('detach'),
    },
  ],
};
