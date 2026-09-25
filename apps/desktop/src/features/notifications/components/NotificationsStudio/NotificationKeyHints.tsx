import { Eyebrow, KbdPill } from '@goodboy/ui';

const HINTS = [
  { keys: ['j', 'k'], label: 'Next or previous' },
  { keys: ['↵'], label: 'Run the action' },
  { keys: ['e'], label: 'Dismiss' },
] as const;

export const NotificationKeyHints = () => (
  <div className="flex flex-col gap-1.5 px-2">
    <Eyebrow label="Keys" muted />
    <dl className="flex flex-col gap-1">
      {HINTS.map((hint) => (
        <div key={hint.label} className="flex items-center justify-between gap-2 text-2xs">
          <dt className="text-muted-foreground">{hint.label}</dt>
          <dd className="flex items-center gap-1">
            {hint.keys.map((key) => (
              <KbdPill key={key}>{key}</KbdPill>
            ))}
          </dd>
        </div>
      ))}
    </dl>
  </div>
);
