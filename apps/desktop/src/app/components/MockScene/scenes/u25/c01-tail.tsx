import { TailScene } from './c01/TailScene';

export const U25_C01_TAIL_SCENES = {
  'c01-tail-working': () => <TailScene state="working" />,
  'c01-tail-waiting': () => <TailScene state="waiting" />,
  'c01-tail-queued': () => <TailScene state="queued" />,
  'c01-tail-paused': () => <TailScene state="paused" />,
  'c01-tail-failed': () => <TailScene state="failed" />,
  'c01-tail-stopped': () => <TailScene state="stopped" />,
  'c01-tail-run': () => <TailScene state="run" />,
  'c01-tail-cleanup': () => <TailScene state="cleanup" />,
  'c01-tail-cifix': () => <TailScene state="cifix" />,
  'c01-tail-draft': () => <TailScene state="draft" />,
  'c01-tail-fixrun': () => <TailScene state="fixrun" />,
  'c01-tail-history': () => <TailScene state="history" />,
  'c01-tail-stopping': () => <TailScene state="stopping" />,
  'c01-tail-childstopped': () => <TailScene state="childstopped" />,
  'c01-tail-childconfirm': () => <TailScene state="childconfirm" />,
  'c01-tail-childasked': () => <TailScene state="childasked" />,
};
