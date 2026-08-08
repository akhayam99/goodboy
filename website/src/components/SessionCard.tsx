import type { ReactNode } from 'react';
import { BrandMark, type BrandId } from './BrandIcons';

export type Stage = 'you' | 'run' | 'rev' | 'build' | 'done';

export const Avatars = ({ on }: { readonly on: readonly BrandId[] }) => (
  <span className="avs">
    {on.map((brand) => (
      <span className="av" key={brand}>
        <BrandMark brand={brand} size={13} />
      </span>
    ))}
  </span>
);

type Props = {
  readonly goal: string;
  readonly stage?: Stage;
  readonly stageLabel?: string;
  readonly tags?: readonly string[];
  readonly cost?: string;
  readonly on: readonly BrandId[];
  readonly action?: ReactNode;
};

export const SessionCard = ({ goal, stage, stageLabel, tags = [], cost, on, action }: Props) => (
  <div className="scard">
    <div className="goal">{goal}</div>
    <div className="meta">
      {stageLabel != null && <span className={`pill stage-${stage ?? 'run'}`}>{stageLabel}</span>}
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
