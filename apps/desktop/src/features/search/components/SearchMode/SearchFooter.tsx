import { KbdPill } from '@goodboy/ui';

type Hint = {
  readonly keys: string;
  readonly label: string;
};

const HINTS: ReadonlyArray<Hint> = [
  { keys: '↑↓', label: 'move' },
  { keys: '↵', label: 'open' },
  { keys: '→', label: 'actions' },
  { keys: '⇥', label: 'commands' },
  { keys: '⌫', label: 'widen' },
  { keys: 'esc', label: 'close' },
];

type Props = {
  readonly progress: string | null;
};

export const SearchFooter = ({ progress }: Props) => (
  <div className="flex items-center gap-4 bg-fill px-4 py-2">
    <ul className="flex flex-1 flex-wrap items-center gap-4" aria-label="Keys">
      {HINTS.map((hint) => (
        <li key={hint.label} className="flex items-center gap-1 text-meta text-faint-foreground">
          <KbdPill>{hint.keys}</KbdPill>
          {hint.label}
        </li>
      ))}
    </ul>
    {progress === null ? null : (
      <span role="status" className="text-meta text-faint-foreground">
        {progress}
      </span>
    )}
  </div>
);
