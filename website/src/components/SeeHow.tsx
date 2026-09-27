import { SITE } from '../site';

type Props = {
  readonly anchor: string;
};

export const SeeHow = ({ anchor }: Props) => (
  <a className="seeHow" href={`${SITE.features}#${anchor}`}>
    See how it works
  </a>
);
