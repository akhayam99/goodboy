import type { GuideStep } from './Guide';

type Props = {
  readonly steps: readonly GuideStep[];
};

export const GuideSteps = ({ steps }: Props) => (
  <ol className="guideSteps">
    {steps.map((step) => (
      <li key={step.text}>
        <div className="guideStep">
          <span>{step.text}</span>
          {step.command === undefined ? null : (
            <pre className="guideCode">
              <code>{step.command}</code>
            </pre>
          )}
        </div>
      </li>
    ))}
  </ol>
);
