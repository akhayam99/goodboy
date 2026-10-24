import { Download } from 'lucide-react';
import { GithubIcon, ICON_SIZE } from '@goodboy/ui';
import { DemoLink } from './DemoLink';
import { DEMO_LINKS } from './demoLinks';

export const DemoRailActions = () => (
  <div className="flex flex-col gap-2">
    <DemoLink href={DEMO_LINKS.download} variant="primary" className="w-full">
      <Download size={ICON_SIZE.control} />
      Download for macOS
    </DemoLink>
    <DemoLink href={DEMO_LINKS.github} variant="secondary" className="w-full">
      <GithubIcon size={ICON_SIZE.control} />
      Star on GitHub
    </DemoLink>
  </div>
);
