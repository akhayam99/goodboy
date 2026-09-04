import type { ReactNode } from 'react';
import { BrandMark, type BrandId } from './BrandIcons';

export type Stage = 'you' | 'run' | 'rev' | 'build' | 'done';

export type PrState = 'draft' | 'open' | 'green' | 'merged';

export type Pr = {
  readonly label: string;
  readonly state: PrState;
};

export const Avatars = ({ on }: { readonly on: readonly BrandId[] }) => (
  <span className="avs">
    {on.map((brand) => (
      <span className="av" key={brand}>
        <BrandMark brand={brand} size={13} />
      </span>
    ))}
  </span>
);

const PrGlyph = ({ state }: { readonly state: PrState }) =>
  state === 'green' ? (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <circle cx="8" cy="8" r="6.25" />
      <path d="M5.4 8.2 7.2 10l3.4-3.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <circle cx="4.4" cy="3.6" r="1.6" />
      <circle cx="4.4" cy="12.4" r="1.6" />
      <path d="M4.4 5.2v5.6" strokeLinecap="round" />
      <circle cx="11.6" cy="12.4" r="1.6" />
      <path d="M11.6 10.8V6.4a2 2 0 0 0-2-2H7.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.2 2.8 7.4 4.4l1.8 1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

type Props = {
  readonly goal: string;
  readonly stage?: Stage;
  readonly stageLabel?: string;
  readonly reason?: string;
  readonly project?: string;
  readonly pr?: Pr;
  readonly tags?: readonly string[];
  readonly cost?: string;
  readonly on: readonly BrandId[];
  readonly action?: ReactNode;
};

export const SessionCard = ({
  goal,
  stage,
  stageLabel,
  reason,
  project,
  pr,
  tags = [],
  cost,
  on,
  action,
}: Props) => (
  <div className="scard">
    {pr != null && (
      <div className={`prslot ${pr.state}`}>
        <PrGlyph state={pr.state} />
        <span>{pr.label}</span>
      </div>
    )}
    <div className="goal">{goal}</div>
    {reason != null && <div className="reason">{reason}</div>}
    <div className="meta">
      {reason == null && stageLabel != null && (
        <span className={`pill stage-${stage ?? 'run'}`}>{stageLabel}</span>
      )}
      {project != null && <span className="pill proj">{project}</span>}
      {tags.map((tag) => (
        <span className="pill" key={tag}>
          {tag}
        </span>
      ))}
      {cost != null && <span className="cost">{cost}</span>}
    </div>
    <div className="meta">
      <Avatars on={on} />
      {action}
    </div>
  </div>
);
