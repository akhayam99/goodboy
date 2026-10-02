import { useId } from 'react';
import PROVIDER_SOURCES from './brandIcons.source.json';
import { APP_BRAND_PATHS } from './mocks/icons';

const PROVIDER_IDS = [
  'anthropic',
  'codex',
  'cursor',
  'gemini',
  'opencode',
  'openrouter',
  'moonshot',
] as const;

export type ProviderId = (typeof PROVIDER_IDS)[number];

export type ToolId = 'github' | 'gitlab' | 'bitbucket' | 'linear' | 'jira' | 'sentry' | 'slack';

export type BrandId = ProviderId | ToolId;

export type Provider = {
  readonly id: ProviderId;
  readonly name: string;
  readonly path: string;
};

const isProviderId = (value: string): value is ProviderId =>
  PROVIDER_IDS.some((id) => id === value);

export const PROVIDERS: readonly Provider[] = PROVIDER_SOURCES.flatMap((source) =>
  isProviderId(source.id) ? [{ id: source.id, name: source.name, path: source.path }] : [],
);

const pathOf = (brand: BrandId): string => {
  if (isProviderId(brand)) {
    return PROVIDERS.find((provider) => provider.id === brand)?.path ?? '';
  }
  return APP_BRAND_PATHS[brand];
};

const GEMINI_STOPS = [
  { offset: 0, color: '#4893FC' },
  { offset: 0.27, color: '#4893FC' },
  { offset: 0.777, color: '#969DFF' },
  { offset: 1, color: '#BD99FE' },
] as const;

type Props = {
  readonly brand: BrandId;
  readonly size?: number;
  readonly className?: string;
  readonly isBrandColored?: boolean;
};

export const BrandMark = ({ brand, size = 16, className, isBrandColored = false }: Props) => {
  const gradientId = `brand-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const isGradient = isBrandColored && brand === 'gemini';

  return (
    <svg
      className={['bicon', className].filter(Boolean).join(' ')}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={isGradient ? `url(#${gradientId})` : 'currentColor'}
      aria-hidden="true"
      focusable="false"
      data-brand={isProviderId(brand) ? brand : undefined}
      data-brand-color={isBrandColored ? '' : undefined}
    >
      {isGradient ? (
        <defs>
          <linearGradient
            id={gradientId}
            x1="6.81"
            y1="16.03"
            x2="19.26"
            y2="5.54"
            gradientUnits="userSpaceOnUse"
          >
            {GEMINI_STOPS.map((stop) => (
              <stop key={stop.offset} offset={stop.offset} stopColor={stop.color} />
            ))}
          </linearGradient>
        </defs>
      ) : null}
      <path d={pathOf(brand)} />
    </svg>
  );
};
