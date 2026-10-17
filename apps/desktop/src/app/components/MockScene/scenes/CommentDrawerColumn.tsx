import { useAppStore } from '../../../../store';
import { selectOpenDrawer } from '../../../../store/slices/drawer/selectOpenDrawer';
import { DrawerHost } from '../../DrawerHost';

export const CommentDrawerColumn = () => {
  const isOpen = useAppStore((state) => selectOpenDrawer(state)?.kind === 'conversation');
  if (!isOpen) {
    return null;
  }
  return (
    <aside
      aria-label="Comment drawer"
      className="flex h-full min-h-0 w-[416px] shrink-0 flex-col border-l border-border-soft"
    >
      <DrawerHost />
    </aside>
  );
};
