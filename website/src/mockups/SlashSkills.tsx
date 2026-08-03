import { useToggleInView } from '../components/Reveal';
import { CycleBar } from './CycleBar';
import { useCycle, usePrefersReducedMotion } from './motion';

type SkillRow = {
  name: string;
  desc: string;
};

const SKILLS: ReadonlyArray<SkillRow> = [
  { name: '/release', desc: 'bump, tag, build the dmg, publish' },
  { name: '/qa', desc: 'typecheck, tests, build, one verdict' },
  { name: '/pr-sweep', desc: 'review the diff before pushing' },
];

export const SlashSkills = () => {
  const reduced = usePrefersReducedMotion();
  const { ref: viewRef, inView } = useToggleInView<HTMLDivElement>();
  const beat = useCycle(2, 3600, inView && !reduced);
  const picked = beat === 1;

  return (
    <div
      ref={viewRef}
      aria-hidden="true"
      className="w-full rounded-xl border border-border-soft/70 bg-subtle/40 p-3"
    >
      <div className="flex h-5 items-center justify-between text-[9.5px] text-muted-foreground">
        <span className="font-semibold uppercase tracking-[0.08em]">Composer</span>
        <span className="font-mono">acme-web</span>
      </div>
      <CycleBar beat={beat} ms={3600} active={inView && !reduced} />

      <div className="mt-2 flex h-9 items-center gap-2 rounded-lg border border-border-soft/70 bg-background px-3 text-[11px]">
        {picked ? (
          <span key="picked" className="tg-fade flex items-center gap-2">
            <span className="chip chip-primary font-mono">/release</span>
            <span className="text-foreground/85">cut 0.1.55, notes from the merged PRs</span>
          </span>
        ) : (
          <span key="typing" className="tg-fade flex items-center font-mono text-foreground/85">
            /rel
            <span className="pulse ml-0.5 inline-block h-3 w-[6px] bg-foreground/50" />
          </span>
        )}
      </div>

      {picked ? (
        <div
          key="hint"
          className="tg-fade mt-2 flex h-[74px] flex-col justify-center gap-1.5 rounded-lg border border-border-soft/50 bg-muted/25 px-3 text-[9.5px] text-muted-foreground"
        >
          <span className="flex items-center gap-2">
            <span className="chip chip-primary">workspace skill</span>
            <span>Plain markdown, scoped to this workspace</span>
          </span>
          <span>Runs on whichever agent is on duty, whatever the provider</span>
        </div>
      ) : (
        <div
          key="menu"
          className="tg-fade mt-2 flex h-[74px] flex-col justify-center rounded-lg border border-border-soft/50 bg-background/60 px-1.5 py-1.5"
        >
          {SKILLS.map((skill, i) => (
            <span
              key={skill.name}
              className={`flex items-baseline gap-2 rounded-md px-2 py-1 text-[10px] ${
                i === 0 ? 'bg-primary/10' : ''
              }`}
            >
              <span className={`font-mono ${i === 0 ? 'text-primary' : 'text-foreground/85'}`}>
                {skill.name}
              </span>
              <span className="truncate text-muted-foreground">{skill.desc}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
