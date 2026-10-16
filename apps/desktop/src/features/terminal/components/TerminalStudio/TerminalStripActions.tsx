import { Button, OverflowMenu, type OverflowMenuItem } from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { useCopyText } from '../../../../shared/hooks/useCopyText';
import { useOpenSession } from '../../../../shared/hooks/useOpenSession';
import type { TerminalWorktree } from '../../terminalWorktrees';

type Props = {
  readonly worktree: TerminalWorktree;
};

type MenuEntry = Extract<OverflowMenuItem, { readonly kind: 'item' }>;

export const TerminalStripActions = ({ worktree }: Props) => {
  const copyText = useCopyText();
  const openSession = useOpenSession();
  const { path, sessionId } = worktree;
  const copyItem: MenuEntry | null =
    path === null
      ? null
      : {
          kind: 'item',
          key: 'copy-path',
          label: worktree.kind === 'workspace' ? 'Copy folder path' : 'Copy worktree path',
          onClick: () => void copyText({ text: path }),
        };
  const sessionItem: MenuEntry | null =
    sessionId === null
      ? null
      : {
          kind: 'item',
          key: 'open-session',
          label: 'Open session',
          onClick: () => openSession({ sessionId }),
        };
  const items = [copyItem, sessionItem].filter((item): item is MenuEntry => item !== null);
  if (items.length > 1) {
    return (
      <OverflowMenu
        label={`More on ${worktree.projectName}`}
        trigger={<CONCEPT_ICONS.more size={ICON_SIZE.control} aria-hidden />}
        items={items}
      />
    );
  }
  const [only] = items;
  if (only === undefined) {
    return null;
  }
  return (
    <Button size="xs" variant="quiet" onClick={only.onClick}>
      {only.label}
    </Button>
  );
};
