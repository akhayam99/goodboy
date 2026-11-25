import type { GuideStep } from './Guide';

type Props = {
  readonly steps: readonly GuideStep[];
};

export const GuideSteps = ({ steps }: Props) => (
  <ol className="guideSteps">
    {steps.map((step) => (
      <li key={step.text}>
        <span>{step.text}</span>
        {step.command === undefined ? null : (
          <pre className="guideCode">
            <code>{step.command}</code>
          </pre>
        )}
      </li>
    ))}
  </ol>
);
