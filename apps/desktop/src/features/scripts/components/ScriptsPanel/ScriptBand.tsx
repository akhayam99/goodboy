import type { ReactNode } from 'react';
import { SectionHeader } from '@goodboy/ui';
import type { SessionScriptGroup } from '../../buildSessionScripts';
import { scriptGroupScopeOf } from '../../scriptGroupScopeOf';

type Props = {
  readonly label: string;
  readonly group: Pick<SessionScriptGroup, 'projectName' | 'branch'>;
  readonly count: number;
  readonly hint?: string;
  readonly action?: ReactNode;
  readonly children: ReactNode;
};

export const ScriptBand = ({ label, group, count, hint, action, children }: Props) => (
  <section
    aria-label={`${label} of ${scriptGroupScopeOf({ group })}`}
    className="flex flex-col gap-1"
  >
    <SectionHeader
      label={label}
      hint={hint}
      action={action}
      meta={
        count > 1 ? (
          <span className="text-meta tabular-nums text-faint-foreground">{count}</span>
        ) : undefined
      }
      className="px-2"
    />
    <div className="flex flex-col gap-0.5">{children}</div>
  </section>
);
