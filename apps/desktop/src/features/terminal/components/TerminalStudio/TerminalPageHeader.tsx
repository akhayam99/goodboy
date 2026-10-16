import { useInheritedPaneActions } from '@goodboy/ui';

export const TerminalPageHeader = () => {
  const inherited = useInheritedPaneActions();
  return (
    <div
      data-slot="pane-title-row"
      className="flex h-10 shrink-0 items-center justify-between gap-3 px-4"
    >
      <h1 className="min-w-0 truncate text-title text-foreground">Terminal</h1>
      {inherited == null ? null : <div className="flex shrink-0 items-center">{inherited}</div>}
    </div>
  );
};
