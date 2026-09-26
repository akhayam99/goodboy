import { DogMascot } from '../../../../shared/components/DogMascot';

const WELCOME_LINES = [
  { label: 'Connect the AI you already use', time: '1 min' },
  { label: 'Pick a project folder', time: '30 s' },
  { label: 'Link your code host and your tasks', time: 'optional' },
  { label: 'Start your first agent', time: '2 min' },
] as const;

export const WelcomeStep = () => (
  <div className="flex flex-col gap-6">
    <DogMascot size={56} className="text-primary" />
    <div className="flex flex-col gap-1.5">
      <h2 tabIndex={-1} data-step-title className="text-display text-foreground outline-none">
        Welcome to Goodboy
      </h2>
      <p className="text-prose text-muted-foreground">
        Five short steps, then an agent reads your project.
      </p>
    </div>
    <ul className="flex flex-col gap-1">
      {WELCOME_LINES.map((line) => (
        <li
          key={line.label}
          className="flex items-center justify-between gap-3 rounded-md bg-subtle px-3.5 py-2.5"
        >
          <span className="text-body text-foreground">{line.label}</span>
          <span className="shrink-0 text-label tabular-nums text-faint-foreground">
            {line.time}
          </span>
        </li>
      ))}
    </ul>
  </div>
);
