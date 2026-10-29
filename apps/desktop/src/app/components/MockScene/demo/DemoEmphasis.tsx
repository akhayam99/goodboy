import { Fragment } from 'react';

type Props = {
  readonly text: string;
};

export const DemoEmphasis = ({ text }: Props) => (
  <>
    {text.split('**').map((part, index) =>
      index % 2 === 1 ? (
        <span key={`${index}-${part}`} className="text-foreground">
          {part}
        </span>
      ) : (
        <Fragment key={`${index}-${part}`}>{part}</Fragment>
      ),
    )}
  </>
);
