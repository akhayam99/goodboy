import { useState } from 'react';
import { Monitor, Moon, Search, Sun } from 'lucide-react';
import { Eyebrow, Listbox, ListboxList, filterOptions } from '@goodboy/ui';
import type { ListboxOption } from '@goodboy/ui';
import { ListboxScenePanel } from './ListboxScenePanel';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

const THEMES: ReadonlyArray<ListboxOption<string>> = [
  { value: 'system', label: 'Match system', leading: <Monitor size={ICON_SIZE.row} /> },
  { value: 'light', label: 'Light', leading: <Sun size={ICON_SIZE.row} /> },
  { value: 'dark', label: 'Dark', leading: <Moon size={ICON_SIZE.row} /> },
];

const ROLES: ReadonlyArray<ListboxOption<string>> = [
  {
    value: 'scout',
    label: 'Scout',
    description: 'Finds the files, callers and tests that matter',
    group: 'Explore and plan',
  },
  {
    value: 'planner',
    label: 'Planner',
    description: 'Writes the plan the builders follow',
    group: 'Explore and plan',
  },
  {
    value: 'implementer',
    label: 'Implementer',
    description: 'Writes the code for one step',
    group: 'Build',
  },
  { value: 'tester', label: 'Tester', description: 'Adds and runs the tests', group: 'Build' },
  {
    value: 'resolver',
    label: 'Resolver',
    disabledReason: 'Needs a pull request on this branch',
    group: 'Build',
  },
];

const BRANCHES: ReadonlyArray<ListboxOption<string>> = [
  'main',
  'nw/fix-retry-backoff',
  'nw/fix-relay-metrics',
  'nw/fix-reconciliation-dates',
  'feat/ledger-export',
  'feat/notify-digest',
  'chore/payments-api-deps',
  'docs/harborline-readme',
  'release/0.8',
].map((name) => ({ value: name, label: name, isCode: true }));

const PROJECTS: ReadonlyArray<ListboxOption<string>> = [
  { value: 'ledger-core', label: 'ledger-core', meta: 4 },
  { value: 'notify-relay', label: 'notify-relay', meta: 2 },
  { value: 'payments-api', label: 'payments-api', meta: 3 },
  { value: 'storefront-web', label: 'storefront-web', meta: 1 },
];

const BRANCH_QUERY = 'fix-re';

export const ListboxScene = () => {
  const [theme, setTheme] = useState<string | null>('dark');
  const [verbosity, setVerbosity] = useState<string | null>('normal');
  const branchEntries = filterOptions({ options: BRANCHES, query: BRANCH_QUERY });

  return (
    <main className="flex h-screen w-full flex-col gap-8 overflow-hidden bg-background p-6 text-foreground">
      <section aria-label="Triggers" className="flex flex-col gap-2">
        <Eyebrow label="Triggers" />
        <div className="flex items-center gap-6">
          <Listbox ariaLabel="Theme" value={theme} options={THEMES} onChange={setTheme} />
          <Listbox
            ariaLabel="Verbosity"
            trigger="quiet"
            size="sm"
            value={verbosity}
            options={[
              { value: 'brief', label: 'Brief' },
              { value: 'normal', label: 'Normal' },
              { value: 'verbose', label: 'Verbose' },
            ]}
            onChange={setVerbosity}
          />
          <Listbox
            ariaLabel="Role"
            trigger="chip"
            value="implementer"
            options={ROLES}
            onChange={() => undefined}
          />
          <Listbox
            ariaLabel="Editor"
            size="sm"
            value="auto"
            options={[{ value: 'auto', label: 'Auto' }]}
            onChange={() => undefined}
            disabled
            disabledReason="Follows the workspace"
          />
        </div>
      </section>
      <div className="flex flex-wrap items-start gap-8">
        <ListboxScenePanel label="Simple">
          <ListboxList
            id="scene-theme"
            ariaLabel="Theme options"
            entries={filterOptions({ options: THEMES, query: '' })}
            activeIndex={1}
            selectedValues={['dark']}
            onSelect={() => undefined}
            onActivate={() => undefined}
          />
        </ListboxScenePanel>
        <ListboxScenePanel label="Groups and descriptions">
          <ListboxList
            id="scene-roles"
            ariaLabel="Role options"
            entries={filterOptions({ options: ROLES, query: '' })}
            activeIndex={2}
            selectedValues={['implementer']}
            onSelect={() => undefined}
            onActivate={() => undefined}
          />
        </ListboxScenePanel>
        <ListboxScenePanel label="Search">
          <div className="flex h-9 items-center gap-2 px-2 text-muted-foreground">
            <Search size={ICON_SIZE.row} aria-hidden />
            <span className="flex-1 text-body text-foreground">{BRANCH_QUERY}</span>
            <span className="text-meta text-faint-foreground">
              {branchEntries.length} of {BRANCHES.length}
            </span>
          </div>
          <ListboxList
            id="scene-branches"
            ariaLabel="Branch options"
            entries={branchEntries}
            activeIndex={0}
            selectedValues={[]}
            onSelect={() => undefined}
            onActivate={() => undefined}
          />
        </ListboxScenePanel>
        <ListboxScenePanel label="Multiple">
          <ListboxList
            id="scene-projects"
            ariaLabel="Project options"
            entries={filterOptions({ options: PROJECTS, query: '' })}
            activeIndex={0}
            selectedValues={['ledger-core', 'notify-relay']}
            isMultiple
            onSelect={() => undefined}
            onActivate={() => undefined}
          />
          <div className="flex items-center justify-between px-2 py-1 text-meta text-faint-foreground">
            <span>2 of 4</span>
          </div>
        </ListboxScenePanel>
      </div>
    </main>
  );
};
