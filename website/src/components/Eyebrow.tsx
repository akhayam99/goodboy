export type EyebrowKind = 'group' | 'audience' | 'page';

type Props = {
  readonly text: string;
  readonly kind?: EyebrowKind;
  readonly className?: string;
  readonly isReveal?: boolean;
};

export const Eyebrow = ({ text, kind = 'group', className, isReveal = false }: Props) => (
  <p
    className={['eyebrow', className].filter(Boolean).join(' ')}
    data-group={kind === 'group' ? text : undefined}
    data-audience={kind === 'audience' ? text : undefined}
    data-reveal={isReveal ? '' : undefined}
  >
    {text}
  </p>
);
