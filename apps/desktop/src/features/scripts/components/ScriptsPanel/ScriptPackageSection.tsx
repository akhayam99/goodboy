import type { ReactNode } from 'react';
import type { ScriptPackageSection as Section } from '../../groupScriptsByPackage';
import { SCRIPT_SOURCE_LABEL } from '../../scriptSourceLabel';

type Props = {
  readonly section: Section;
  readonly children: ReactNode;
};

export const ScriptPackageSection = ({ section, children }: Props) => {
  const manifest = SCRIPT_SOURCE_LABEL[section.source];
  const path = section.relDir === '' ? manifest : `${section.relDir}/${manifest}`;

  return (
    <section aria-label={`${section.packageName} scripts`} className="flex flex-col gap-0.5">
      <header className="flex h-6 min-w-0 items-center gap-2 px-2">
        <span className="truncate text-2xs font-medium text-muted-foreground">
          {section.packageName}
        </span>
        <span className="min-w-0 truncate font-mono text-3xs text-faint-foreground">{path}</span>
        <span className="shrink-0 text-2xs tabular-nums text-faint-foreground">
          {section.scripts.length}
        </span>
      </header>
      {children}
    </section>
  );
};
