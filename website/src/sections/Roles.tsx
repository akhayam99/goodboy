import './Roles.css';
import { useEffect, useState, type CSSProperties } from 'react';
import { BrandMark, type BrandId } from '../components/BrandIcons';
import { delay, prefersReducedMotion, useInViewOnce } from '../components/Reveal';
import { SITE } from '../site';

type EffortValue = 'Low' | 'Medium' | 'High' | 'Luna' | 'Terra' | 'Sol';

type Step = {
  readonly n: number;
  readonly role: string;
  readonly tone: string;
  readonly brand: BrandId;
  readonly provider: string;
  readonly model: string;
  readonly effort: EffortValue;
  readonly options: readonly EffortValue[];
  readonly task: string;
  readonly why: string;
};

const EFFORTS: readonly EffortValue[] = ['Low', 'Medium', 'High'];

const VARIANTS: readonly EffortValue[] = ['Luna', 'Terra', 'Sol'];

const LEGEND: readonly (readonly [string, string])[] = [
  ['scout', 'scout'],
  ['planner', 'planner'],
  ['implementer', 'implementer'],
  ['tester', 'rl-tester'],
  ['reviewer', 'reviewer'],
  ['investigator', 'rl-investigator'],
  ['resolver', 'rl-resolver'],
];

const STEPS: readonly Step[] = [
  {
    n: 1,
    role: 'scout',
    tone: 'scout',
    brand: 'anthropic',
    provider: 'Claude',
    model: 'Haiku 4.5',
    effort: 'Low',
    options: EFFORTS,
    task: 'Read how notifications are stored',
    why: 'reads a lot, decides nothing',
  },
  {
    n: 2,
    role: 'planner',
    tone: 'planner',
    brand: 'anthropic',
    provider: 'Claude',
    model: 'Opus',
    effort: 'High',
    options: EFFORTS,
    task: 'Draft the archive steps',
    why: 'the one that has to think',
  },
  {
    n: 3,
    role: 'implementer',
    tone: 'implementer',
    brand: 'codex',
    provider: 'Codex',
    model: 'GPT-5.6 Sol',
    effort: 'Sol',
    options: VARIANTS,
    task: 'Archive endpoint, batches of 500',
    why: 'writes most of the code',
  },
  {
    n: 4,
    role: 'tester',
    tone: 'rl-tester',
    brand: 'codex',
    provider: 'Codex',
    model: 'GPT-5.6 Terra',
    effort: 'Terra',
    options: VARIANTS,
    task: 'Run the suite, fix the reds',
    why: 'runs the suite, fixes the reds',
  },
  {
    n: 5,
    role: 'reviewer',
    tone: 'reviewer',
    brand: 'cursor',
    provider: 'Cursor',
    model: 'Composer',
    effort: 'Medium',
    options: EFFORTS,
    task: 'Read the diff before the PR',
    why: 'reads the diff, not the repo',
  },
  {
    n: 6,
    role: 'resolver',
    tone: 'rl-resolver',
    brand: 'anthropic',
    provider: 'Claude',
    model: 'Sonnet',
    effort: 'Low',
    options: EFFORTS,
    task: 'Answer review comments',
    why: 'small edits, one at a time',
  },
];

const FIRST_BEAT = 500;

const BEAT_GAP = 420;

const segStyle = (i: number) => ({ '--i': `${i}` }) as CSSProperties;

const Caret = () => (
  <svg
    className="rl-car"
    viewBox="0 0 12 12"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M3 4.75 6 7.75 9 4.75" />
  </svg>
);

const Effortometer = ({
  effort,
  options,
  set,
}: {
  readonly effort: EffortValue;
  readonly options: readonly EffortValue[];
  readonly set: boolean;
}) => (
  <span
    className="rl-seg"
    data-set={set ? 'y' : undefined}
    style={segStyle(set ? options.indexOf(effort) : 0)}
  >
    <span className="rl-thumb" />
    {options.map((value) => (
      <span className="rl-sv" key={value} data-on={set && value === effort ? 'y' : undefined}>
        {value}
      </span>
    ))}
  </span>
);

export const Roles = () => {
  const { ref, inView } = useInViewOnce<HTMLDivElement>();
  const [picked, setPicked] = useState(() => (prefersReducedMotion() ? STEPS.length : 0));

  useEffect(() => {
    if (!inView || prefersReducedMotion()) {
      return;
    }
    const timers = STEPS.map((_, i) =>
      window.setTimeout(
        () => setPicked((current) => Math.max(current, i + 1)),
        FIRST_BEAT + i * BEAT_GAP,
      ),
    );
    return () => timers.forEach(window.clearTimeout);
  }, [inView]);

  return (
    <section className="block" id="roles" aria-labelledby="h2-roles">
      <div className="wrap">
        <div className="blockHead">
          <h2 className="rv" id="h2-roles">
            The right model for each step
          </h2>
          <p className="sub rv" style={delay(80)}>
            Seven roles come in the box: scout, planner, implementer, tester, reviewer, investigator
            and resolver. Each step in a workflow picks its own provider, model and effort, and any
            of them is one click from being changed.
          </p>
        </div>

        <div className="appframe rl-frame rv" style={delay(160)} ref={ref} aria-hidden="true">
          <div className="tbar">
            <span className="tl r" />
            <span className="tl y" />
            <span className="tl g" />
            <span className="tname">goodboy, acme / workflows / Ship a feature</span>
          </div>

          <div className="rl-legend">
            <span className="rl-eyebrow">Roles</span>
            <span className="rl-chips">
              {LEGEND.map(([role, tone]) => (
                <span className={`kb ${tone}`} key={role}>
                  {role}
                </span>
              ))}
            </span>
          </div>

          <div className="hairline" />

          <div className="rl-list">
            {STEPS.map((step) => {
              const set = picked >= step.n;
              return (
                <div className="rl-row" key={step.n}>
                  <span className="rl-n">{step.n}</span>
                  <span className={`kb ${step.tone}`}>{step.role}</span>
                  <span className="rl-task">{step.task}</span>
                  <span className="rl-ctrls">
                    <span className="rl-ctrl rl-prov">
                      <BrandMark brand={step.brand} size={13} />
                      <span className="rl-cv">{step.provider}</span>
                      <Caret />
                    </span>
                    <span className="rl-ctrl rl-model">
                      <span className="rl-cv">{step.model}</span>
                      <Caret />
                    </span>
                    <Effortometer effort={step.effort} options={step.options} set={set} />
                    <span className="rl-slot">
                      <span className="rl-why" data-in={set ? 'y' : undefined}>
                        {step.why}
                      </span>
                    </span>
                  </span>
                </div>
              );
            })}
          </div>

          <div className="rl-foot">
            <span className="rl-add">+ Add step</span>
          </div>
        </div>

        <p className="caption rv" style={delay(200)}>
          The scout reads the codebase for two cents. The planner thinks, and that is the one that
          costs real money.
        </p>
        <a className="more rv" style={delay(220)} href={`${SITE.concepts}#workflows`}>
          How workflows work <span className="arr">→</span>
        </a>
      </div>
    </section>
  );
};
