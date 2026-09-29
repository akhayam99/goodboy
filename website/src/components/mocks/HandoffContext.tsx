import { HARBORLINE, type ContextBlock } from '../../data/harborline';

const { HANDOFF_CONTEXT, HANDOFF_DECISIONS } = HARBORLINE;

type Props = {
  readonly tint: Readonly<Record<ContextBlock, boolean>>;
};

type TintParams = {
  readonly base: string;
  readonly isTinted: boolean;
};

const tinted = ({ base, isTinted }: TintParams) => (isTinted ? `${base} is-tint` : base);

export const HandoffContext = ({ tint }: Props) => (
  <section className="mk-ctx">
    <div className="mk-ctxhead">
      <span className="mk-ctxtitle">{HANDOFF_CONTEXT.title}</span>
      <span className="mk-tabs">
        <span className={tinted({ base: 'mk-tab', isTinted: tint.goal })}>
          {HANDOFF_CONTEXT.tabs.goal}
        </span>
        <span className={tinted({ base: 'mk-tab is-on', isTinted: tint.dec })}>
          {HANDOFF_CONTEXT.tabs.dec} <span className="mk-n">{HANDOFF_CONTEXT.decisionCount}</span>
        </span>
        <span className={tinted({ base: 'mk-tab', isTinted: tint.sum })}>
          {HANDOFF_CONTEXT.tabs.sum}
        </span>
      </span>
    </div>
    <div className={tinted({ base: 'mk-goal', isTinted: tint.goal })}>{HANDOFF_CONTEXT.goal}</div>
    {HANDOFF_DECISIONS.map((decision) => (
      <div key={decision.id} className={tinted({ base: 'mk-dec', isTinted: tint.dec })}>
        <span>
          <span className="mk-dchip">{decision.id}</span>
        </span>
        <div>
          <div className="mk-dt">{decision.title}</div>
          <div className={decision.isMinor === true ? 'mk-dr is-minor' : 'mk-dr'}>
            {decision.reason}
          </div>
        </div>
      </div>
    ))}
  </section>
);
