import { PageHeader } from '@goodboy/ui';
import { NAMES } from '../../../shared/utils/names';

export const HomePage = () => (
  <main aria-label={NAMES.home} className="flex min-h-0 flex-1 flex-col">
    <PageHeader page="home" isOnColumn title={NAMES.home} />
  </main>
);
