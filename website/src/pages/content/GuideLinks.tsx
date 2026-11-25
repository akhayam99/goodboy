import type { GuideLink } from './Guide';

type Props = {
  readonly links: readonly GuideLink[];
};

export const GuideLinks = ({ links }: Props) => (
  <p className="guideLinks">
    {links.map((link) => (
      <a key={link.href} href={link.href}>
        {link.label}
      </a>
    ))}
  </p>
);
