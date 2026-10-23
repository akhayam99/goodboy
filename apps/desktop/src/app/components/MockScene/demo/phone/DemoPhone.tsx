import { useEffect, useState } from 'react';
import { Check, Link2, Moon, Share, Sun, type LucideIcon } from 'lucide-react';
import {
  FOCUS_RING,
  GithubIcon,
  ICON_SIZE,
  IconButton,
  Input,
  ScrollFade,
  buttonClasses,
  chipClasses,
  cn,
} from '@goodboy/ui';
import { BrandTile } from '../../../../../shared/components/BrandTile';
import { APP_VERSION } from '../../../../../shared/lib/appVersion';
import { applyDocumentTheme, type Theme } from '../../../../../shared/lib/theme';
import { DEMO_LINKS } from '../demoLinks';
import { PHONE_GROUPS } from './phoneGroups';
import { PHONE_LINKS } from './phoneLinks';
import { demoShareUrl } from './demoShareUrl';
import { deviceNoun } from './deviceNoun';
import { useHandoff, type HandoffState } from './useHandoff';

type NavigatorWithPlatform = Navigator & {
  readonly userAgentData?: { readonly platform?: string };
};

const BRAND_TILE_PX = 32;
const LIGHT_QUERY = '(prefers-color-scheme: light)';
const TOUCH_BUTTON = 'h-11 w-full';
const DEMO_HOST = new URL(PHONE_LINKS.demo).host;

const initialTheme = (): Theme => {
  const requested = new URLSearchParams(window.location.search).get('theme');
  if (requested === 'light' || requested === 'dark') {
    return requested;
  }
  const isSystemLight =
    typeof window.matchMedia === 'function' && window.matchMedia(LIGHT_QUERY).matches;
  return isSystemLight ? 'light' : 'dark';
};

const readNoun = () => {
  const agent: NavigatorWithPlatform = navigator;
  return deviceNoun({ userAgent: agent.userAgent, platform: agent.userAgentData?.platform });
};

const STATUS_COPY = {
  shared: 'Link shared',
  copied: 'Link copied',
  failed: 'Copying did not work. Select the link to copy it yourself.',
} as const satisfies Record<Exclude<HandoffState, 'idle'>, string>;

type IconParams = {
  readonly state: HandoffState;
  readonly canShare: boolean;
};

const handoffIcon = ({ state, canShare }: IconParams): LucideIcon => {
  if (state === 'shared' || state === 'copied') {
    return Check;
  }
  return canShare ? Share : Link2;
};

export const DemoPhone = () => {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [noun] = useState(readNoun);
  const [url] = useState(() => demoShareUrl({ hash: window.location.hash }));
  const { state, canShare, handoff } = useHandoff({
    url,
    title: 'Goodboy demo',
    text: `Open the Goodboy demo on your ${noun}.`,
  });
  const isDark = theme === 'dark';
  const hasFailed = state === 'failed';
  const HandoffIcon = handoffIcon({ state, canShare });
  const helper = canShare
    ? `Share the link to open it on your ${noun}.`
    : `Copy the link to open it on your ${noun}.`;

  useEffect(() => {
    document.getElementById('boot-shell')?.remove();
  }, []);

  useEffect(() => {
    applyDocumentTheme({ theme });
  }, [theme]);

  return (
    <ScrollFade className="h-full bg-background text-foreground" fadeSize="h-6" scrollbar="none">
      <div className="mx-auto flex min-h-full w-full max-w-xl flex-col gap-10 pb-[max(2rem,env(safe-area-inset-bottom))] pl-[max(1.5rem,env(safe-area-inset-left))] pr-[max(1.5rem,env(safe-area-inset-right))] pt-[max(0.75rem,env(safe-area-inset-top))]">
        <header className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <BrandTile size={BRAND_TILE_PX} className="ring-1 ring-inset ring-frame-edge" />
            <span className="text-title text-foreground">Goodboy</span>
            <span
              className={cn(
                chipClasses({ tone: 'neutral', kind: 'state' }),
                'h-6 text-ui tabular-nums',
              )}
            >
              v{APP_VERSION}
            </span>
          </div>
          <IconButton
            icon={isDark ? Sun : Moon}
            label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
            size="md"
            className="size-11"
            onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
          />
        </header>
        <main className="flex flex-1 flex-col gap-10 motion-safe:animate-fade-in">
          <section aria-labelledby="demo-phone-title" className="flex flex-col gap-3">
            <h1 id="demo-phone-title" className="text-display text-foreground">
              Give your agents a structure to work in
            </h1>
            <p className="text-read text-muted-foreground">
              Run Claude Code, Codex and Cursor on one task, with the subscriptions you already
              have.
            </p>
          </section>
          <div className="flex flex-col gap-3">
            <a
              href={DEMO_LINKS.github}
              target="_blank"
              rel="noreferrer"
              className={cn(buttonClasses({ variant: 'primary', size: 'md' }), TOUCH_BUTTON)}
            >
              <GithubIcon size={ICON_SIZE.control} />
              Star on GitHub
            </a>
            <button
              type="button"
              onClick={handoff}
              className={cn(buttonClasses({ variant: 'secondary', size: 'md' }), TOUCH_BUTTON)}
            >
              <HandoffIcon size={ICON_SIZE.control} aria-hidden />
              {hasFailed ? 'Try again' : `Open on your ${noun}`}
            </button>
            <p role="status" className="text-center text-ui text-muted-foreground">
              {state === 'idle' ? helper : STATUS_COPY[state]}
            </p>
            {hasFailed ? (
              <Input
                readOnly
                size="md"
                aria-label="Demo link"
                value={url}
                onFocus={(event) => event.currentTarget.select()}
                className="h-11 text-center"
              />
            ) : null}
          </div>
          <section aria-labelledby="demo-phone-groups" className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h2 id="demo-phone-groups" className="text-lead text-foreground">
                What the demo covers
              </h2>
              <p className="text-ui text-muted-foreground">
                Open {DEMO_HOST} on a computer to try each step yourself. Goodboy runs on macOS and
                Linux.
              </p>
            </div>
            <ol className="flex flex-col gap-2">
              {PHONE_GROUPS.map(({ title, line, icon: Icon }) => (
                <li key={title} className="flex items-start gap-3 rounded-lg bg-subtle px-3 py-2">
                  <span className="grid size-8 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
                    <Icon size={ICON_SIZE.control} aria-hidden />
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-row text-foreground">{title}</span>
                    <span className="text-ui text-muted-foreground">{line}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
          <a
            href={PHONE_LINKS.site}
            target="_blank"
            rel="noreferrer"
            className={cn(
              'inline-flex h-11 items-center justify-center self-center rounded-md px-3 text-ui text-muted-foreground hover:text-foreground',
              FOCUS_RING,
            )}
          >
            About Goodboy
          </a>
        </main>
      </div>
    </ScrollFade>
  );
};
