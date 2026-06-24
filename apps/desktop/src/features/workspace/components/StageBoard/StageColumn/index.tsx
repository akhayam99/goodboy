import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn, Eyebrow, ScrollFade } from '@goodboy/ui';
import type { Session, SessionStage } from '@goodboy/types';
import { SESSION_STAGE_META, STAGE_TONE } from '../../../../session/session-stage';
import { StageBoardCard } from '../StageBoardCard';
import type { BoardNavigation } from '../useBoardNavigation';

const ZERO_STATE: Record<SessionStage, string> = {
  attention: 'nothing needs you',
  running: 'nothing running',
  review: 'nothing in review',
  building: 'nothing building',
  done: 'nothing done yet',
};

type StageColumnProps = {
  readonly stage: SessionStage;
  readonly sessions: ReadonlyArray<Session>;
  readonly nav: BoardNavigation;
};

export const StageColumn = ({ stage, sessions, nav }: StageColumnProps) => {
  const collapsible = stage === 'done';
  const [collapsed, setCollapsed] = useState(collapsible);
  const meta = SESSION_STAGE_META[stage];
  const empty = sessions.length === 0;

  const header = (
    <span className="flex items-center gap-1.5">
      <Eyebrow label={meta.label} tone={STAGE_TONE[stage]} badge muted={empty} />
      <span className="text-2xs tabular-nums text-muted-foreground/60">{sessions.length}</span>
    </span>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {collapsible ? (
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-expanded={!collapsed}
          title={collapsed ? 'expand done' : 'collapse done'}
          className="flex shrink-0 items-center gap-1 text-left"
        >
          <ChevronDown
            size={12}
            aria-hidden
            className={cn(
              'shrink-0 text-muted-foreground/50 transition-transform',
              collapsed && '-rotate-90',
            )}
          />
          {header}
        </button>
      ) : (
        <div className="shrink-0">{header}</div>
      )}

      {!collapsed && (
        <ScrollFade orientation="vertical" className="flex-1">
          <div className="flex flex-col gap-2">
            {empty ? (
              <p className="px-1 py-6 text-center text-2xs text-muted-foreground/50">
                {ZERO_STATE[stage]}
              </p>
            ) : (
              sessions.map((session) => (
                <StageBoardCard key={session.id} session={session} nav={nav} />
              ))
            )}
          </div>
        </ScrollFade>
      )}
    </div>
  );
};
