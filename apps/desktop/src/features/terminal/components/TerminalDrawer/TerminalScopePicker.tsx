import { Listbox, StatusDot, TEXT_ROLE, type ListboxOption } from '@goodboy/ui';
import { TERMINAL_PICKER_EVENTS } from '../../terminalPickerEvents';
import type { TerminalTarget } from '../../terminalTargets';
import type { TerminalWorktree } from '../../terminalWorktrees';
import { scopeLabelOf } from './terminalScope';

const SESSION_FOLDER_KEY = 'session-folder';

type Props = {
  readonly worktree: TerminalWorktree;
  readonly targets: ReadonlyArray<TerminalTarget>;
  readonly isBranchless: boolean;
  readonly busyPaths: ReadonlySet<string>;
  readonly onPickTarget: (target: TerminalTarget) => void;
  readonly onPickSessionFolder: () => void;
};

const runningDot = <StatusDot tone="info" size="sm" ariaLabel="A shell here runs a process" />;

export const TerminalScopePicker = ({
  worktree,
  targets,
  isBranchless,
  busyPaths,
  onPickTarget,
  onPickSessionFolder,
}: Props) => {
  const label = scopeLabelOf({ worktree, isBranchless });
  const options: ReadonlyArray<ListboxOption<string>> = [
    ...targets.map((target) => ({
      value: target.key,
      label: target.label,
      ...(busyPaths.has(target.path) && { leading: runningDot }),
    })),
    ...(isBranchless ? [{ value: SESSION_FOLDER_KEY, label: 'Session folder' }] : []),
  ];
  const isOnSessionFolder = isBranchless && worktree.kind === 'path';
  const current = isOnSessionFolder
    ? SESSION_FOLDER_KEY
    : (targets.find((target) => target.path === worktree.path)?.key ?? null);

  return (
    <Listbox<string>
      options={options}
      value={current}
      trigger="quiet"
      size="sm"
      ariaLabel="Terminal folder"
      openEvent={TERMINAL_PICKER_EVENTS.drawer}
      searchable
      valueLabel={
        <span className="flex min-w-0 items-center gap-1 text-ui">
          {label.project === null ? null : (
            <span className={`shrink-0 whitespace-pre ${TEXT_ROLE.secondary}`}>
              {`${label.project} · `}
            </span>
          )}
          <span className={label.isMono ? 'min-w-0 truncate font-mono' : 'min-w-0 truncate'}>
            {label.place}
          </span>
        </span>
      }
      align="start"
      popupWidth="content"
      onChange={(key) => {
        if (key === SESSION_FOLDER_KEY) {
          onPickSessionFolder();
          return;
        }
        const target = targets.find((candidate) => candidate.key === key);
        if (target !== undefined) {
          onPickTarget(target);
        }
      }}
    />
  );
};
