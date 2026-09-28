export type EyebrowKind = 'group' | 'audience' | 'page';

type Props = {
  readonly text: string;
  readonly kind?: EyebrowKind;
  readonly className?: string;
};

export const Eyebrow = ({ text, kind = 'group', className }: Props) => (
  <p
    className={['eyebrow', className].filter(Boolean).join(' ')}
    data-group={kind === 'group' ? text : undefined}
    data-audience={kind === 'audience' ? text : undefined}
  >
    {text}
  </p>
);
