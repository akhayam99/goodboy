type Props = {
  readonly text: string;
  readonly isGroup?: boolean;
  readonly className?: string;
};

export const Eyebrow = ({ text, isGroup = true, className }: Props) => (
  <p
    className={['eyebrow', className].filter(Boolean).join(' ')}
    data-group={isGroup ? text : undefined}
  >
    {text}
  </p>
);
