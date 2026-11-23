import type { ReactNode } from 'react';
import { cn } from '../../cn';
import { moveShellRailFocus } from './moveShellRailFocus';
import { ShellRailFormContext, type ShellRailForm } from './shellRailFormContext';
import { SHELL_RAIL_EDGE_PX, SHELL_RAIL_WIDTH_PX } from './shellRailGeometry';
import { useShellRailForm } from './useShellRailForm';

type Props = {
  readonly label: string;
  readonly form?: ShellRailForm;
  readonly className?: string;
  readonly children: ReactNode;
};

export const ShellRail = ({ label, form, className, children }: Props) => {
  const windowForm = useShellRailForm();
  const shown = form ?? windowForm;
  return (
    <ShellRailFormContext.Provider value={shown}>
      <nav
        aria-label={label}
        data-shell-rail={shown}
        className={cn(
          'flex h-full min-h-0 shrink-0 flex-col items-center',
          shown === 'wide' ? 'gap-2' : 'gap-1',
          className,
        )}
        style={{
          width: SHELL_RAIL_WIDTH_PX[shown],
          paddingTop: SHELL_RAIL_EDGE_PX,
          paddingBottom: SHELL_RAIL_EDGE_PX,
        }}
        onKeyDown={(event) => moveShellRailFocus({ event })}
      >
        {children}
      </nav>
    </ShellRailFormContext.Provider>
  );
};
