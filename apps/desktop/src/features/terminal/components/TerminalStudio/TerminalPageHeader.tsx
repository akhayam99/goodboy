import { PaneTitleRow, useInheritedPaneActions } from '@goodboy/ui';

export const TerminalPageHeader = () => {
  const inherited = useInheritedPaneActions();
  return (
    <div className="flex h-10 shrink-0 flex-col justify-center px-4">
      <PaneTitleRow title="Terminal" {...(inherited != null && { actions: inherited })} />
    </div>
  );
};
