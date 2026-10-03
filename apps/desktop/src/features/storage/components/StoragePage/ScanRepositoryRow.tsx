import { useState } from 'react';
import { Plus } from 'lucide-react';
import { BandRow, Button } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { usePickFolder } from '../../../../shared/hooks/usePickFolder';

export const ScanRepositoryRow = () => {
  const scanStorageRepository = useAppStore((state) => state.scanStorageRepository);
  const reportError = useAppStore((state) => state.reportError);
  const pickFolder = usePickFolder();
  const [isScanning, setIsScanning] = useState(false);

  const onScan = async () => {
    const picked = await pickFolder();
    if (picked === null) {
      return;
    }
    setIsScanning(true);
    try {
      await scanStorageRepository({ repoRoot: picked });
    } catch (error) {
      void reportError({ title: "Couldn't scan that repository", error });
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <BandRow>
      <span className="min-w-0 flex-1 text-secondary text-faint-foreground">
        A repository from a workspace you removed?
      </span>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => void onScan()}
        isBusy={isScanning}
        busyLabel="Scanning"
      >
        <Plus size={ICON_SIZE.row} aria-hidden />
        Scan another repository
      </Button>
    </BandRow>
  );
};
