type Props = {
  readonly html: string;
};

export const Prose = ({ html }: Props) => (
  <div className="prose" dangerouslySetInnerHTML={{ __html: html }} />
);
