import { useEffect, useRef, useState } from 'react';
import { browserHost } from '../../browserHost';

type Params = {
  readonly tabId: string | undefined;
  readonly host: string | null;
  readonly isReadable: boolean;
  readonly mark: number;
};

type TrailRead = {
  readonly tabId: string | null;
  readonly hosts: ReadonlyArray<string>;
};

type ExtraParams = {
  readonly hosts: ReadonlyArray<string>;
  readonly host: string;
};

const NO_HOSTS: ReadonlyArray<string> = [];
const NOTHING_READ: TrailRead = { tabId: null, hosts: NO_HOSTS };

type KeyParams = {
  readonly host: string;
};

const keyOf = ({ host }: KeyParams): string => host.trim().replace(/\.$/, '').toLowerCase();

const extraHostsOf = ({ hosts, host }: ExtraParams): ReadonlyArray<string> => {
  const site = keyOf({ host });
  return hosts.filter(
    (known, index) => keyOf({ host: known }) !== site && hosts.indexOf(known) === index,
  );
};

const keepLastTrail = (): void => undefined;

export const useSiteTrail = ({ tabId, host, isReadable, mark }: Params): ReadonlyArray<string> => {
  const [read, setRead] = useState<TrailRead>(NOTHING_READ);
  const latest = useRef(0);

  useEffect(() => {
    if (!isReadable || tabId === undefined || host === null) {
      return;
    }
    latest.current += 1;
    const asked = latest.current;
    void browserHost.tabTrail({ tabId }).then((hosts) => {
      if (asked === latest.current) {
        setRead({ tabId, hosts: hosts ?? NO_HOSTS });
      }
    }, keepLastTrail);
  }, [tabId, host, isReadable, mark]);

  if (!isReadable || tabId === undefined || host === null || read.tabId !== tabId) {
    return NO_HOSTS;
  }
  return extraHostsOf({ hosts: read.hosts, host });
};
