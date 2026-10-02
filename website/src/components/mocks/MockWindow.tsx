import './mocks.css';
import type { ReactNode } from 'react';

type Tone = 'neutral' | 'accent' | 'ok' | 'warn';

type WindowProps = {
  readonly title?: ReactNode;
  readonly children: ReactNode;
  readonly className?: string;
};

type RowProps = {
  readonly children: ReactNode;
  readonly className?: string;
};

type ChipProps = {
  readonly children: ReactNode;
  readonly tone?: Tone;
  readonly className?: string;
};

type DotProps = {
  readonly tone?: Exclude<Tone, 'neutral'>;
  readonly isRunning?: boolean;
};

const join = (...names: readonly (string | false | undefined)[]) => names.filter(Boolean).join(' ');

export const MockWindow = ({ title, children, className }: WindowProps) => (
  <div className={join('mkWin', className)}>
    {title === undefined ? null : <div className="mkRow mkTitle">{title}</div>}
    {children}
  </div>
);

export const MockRow = ({ children, className }: RowProps) => (
  <div className={join('mkRow', className)}>{children}</div>
);

export const MockChip = ({ children, tone = 'neutral', className }: ChipProps) => (
  <span className={join('mkChip', className)} data-tone={tone}>
    {children}
  </span>
);

export const MockDot = ({ tone = 'accent', isRunning = false }: DotProps) => (
  <span
    className="mkDot"
    data-tone={tone}
    data-running={isRunning ? '' : undefined}
    aria-hidden="true"
  />
);
