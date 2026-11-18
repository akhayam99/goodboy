import { useEffect, useState } from 'react';
import { PushFixStatus } from '../../../../../features/history/pushFix/PushFixStatus';
import { StaleDepsNotice } from '../../../../../shared/components/StaleDepsNotice';
import { MOUNT_TARGET, SESSION } from '../resolveSeed';
import { PushFailureCardScene } from './PushFailureCardScene';
import { pushDepsSeed, type PushDepsVariant } from './pushDepsSeed';

type Props = {
  readonly variant: PushDepsVariant;
};

const HOOK_OUTPUT = [
  '$ pnpm typecheck',
  'src/ledger/postings.ts:41 Type error: "legacy-flex" is not assignable to type "Tone"',
  'husky - pre-push script failed (code 1)',
  `error: failed to push some refs to 'github.com:harborline/payments-api.git'`,
].join('\n');

const FAILURE_VARIANTS: ReadonlySet<PushDepsVariant> = new Set([
  'working',
  'stopped',
  'agent-failed',
  'deps-linked',
  'deps-installing',
]);

export const PushDepsScene = ({ variant }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    pushDepsSeed({ variant });
    setIsReady(true);
  }, [variant]);

  if (!isReady) {
    return null;
  }
  return (
    <main className="mx-auto flex w-[720px] flex-col gap-3 bg-background p-6">
      <p className="text-meta text-foreground">hl/fix-duplicate-credit</p>
      <StaleDepsNotice sessionId={SESSION.id} mountId={MOUNT_TARGET.mountId} />
      {FAILURE_VARIANTS.has(variant) ? (
        <PushFailureCardScene output={HOOK_OUTPUT} />
      ) : (
        <PushFixStatus sessionId={SESSION.id} mountId={MOUNT_TARGET.mountId} />
      )}
    </main>
  );
};
