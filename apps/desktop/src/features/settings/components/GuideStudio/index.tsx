import { useRef, useState, type ReactNode } from 'react';
import { cn, Divider } from '@goodboy/ui';
import {
  BookOpen,
  GitBranch,
  LayoutDashboard,
  Lightbulb,
  MessagesSquare,
  Palette,
  Wrench,
} from 'lucide-react';
import { StudioShell } from '../../../../shared/components/StudioShell';
import { DogMascot } from '../../../../shared/components/DogMascot';
import { SECTION_ICONS } from '../../../../shared/components/section-icons';
import { GuideContent } from './parts/GuideContent';

type Props = {
  readonly onClose: () => void;
};

type Section =
  | 'overview'
  | 'board'
  | 'session'
  | 'turn'
  | 'tools'
  | 'tokens'
  | 'agents'
  | 'tips'
  | 'legenda';

type NavItem = {
  readonly id: Section;
  readonly label: string;
  readonly icon: ReactNode;
};

const NAV_ITEMS: ReadonlyArray<NavItem> = [
  { id: 'overview', label: 'Overview', icon: <BookOpen size={13} aria-hidden /> },
  { id: 'board', label: 'Stage board', icon: <LayoutDashboard size={13} aria-hidden /> },
  { id: 'session', label: 'Sessions', icon: <GitBranch size={13} aria-hidden /> },
  { id: 'turn', label: 'Turns', icon: <MessagesSquare size={13} aria-hidden /> },
  { id: 'tools', label: 'Tools', icon: <Wrench size={13} aria-hidden /> },
  {
    id: 'tokens',
    label: 'Tokens & cost',
    icon: <SECTION_ICONS.budget size={13} aria-hidden />,
  },
  { id: 'agents', label: 'Agents', icon: <DogMascot size={13} /> },
  { id: 'tips', label: 'Tips', icon: <Lightbulb size={13} aria-hidden /> },
  { id: 'legenda', label: 'Legend', icon: <Palette size={13} aria-hidden /> },
];

export const GuideStudio = ({ onClose }: Props) => {
  const scrollToRef = useRef<(id: Section) => void>(() => {});
  const suppressUntilRef = useRef(0);
  const [active, setActive] = useState<Section>('overview');

  const jump = (id: Section) => {
    suppressUntilRef.current = Date.now() + 700;
    setActive(id);
    scrollToRef.current(id);
  };

  const onVisible = (id: Section) => {
    if (Date.now() >= suppressUntilRef.current) {
      setActive(id);
    }
  };

  return (
    <StudioShell
      icon={BookOpen}
      title="Getting started"
      workspaceName="How Goodboy fits together"
      closeLabel="close getting started"
      onClose={onClose}
    >
      {() => (
        <div className="flex min-h-0 flex-1">
          <nav
            aria-label="guide sections"
            className="flex w-52 shrink-0 flex-col gap-1 bg-subtle/40 p-3"
          >
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => jump(item.id)}
                aria-current={active === item.id ? 'true' : undefined}
                className={cn(
                  'relative flex items-center gap-2 rounded-md py-2 pl-3 pr-2 text-left text-sm motion-safe:transition-colors',
                  active === item.id
                    ? 'bg-background font-medium text-foreground shadow-sm before:absolute before:left-1 before:top-2 before:bottom-2 before:w-[3px] before:rounded-full before:bg-primary'
                    : 'text-muted-foreground hover:bg-background/60 hover:text-foreground',
                )}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
          <Divider orientation="vertical" />
          <div className="min-h-0 flex-1">
            <GuideContent
              onJump={jump}
              onVisible={onVisible}
              registerScrollTo={(fn) => {
                scrollToRef.current = fn;
              }}
            />
          </div>
        </div>
      )}
    </StudioShell>
  );
};
