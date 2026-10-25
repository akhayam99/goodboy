import { TailScene } from './c01/TailScene';

export const U25_C01_TAIL_SCENES = {
  'c01-tail-working': () => <TailScene state="working" />,
  'c01-tail-waiting': () => <TailScene state="waiting" />,
  'c01-tail-queued': () => <TailScene state="queued" />,
  'c01-tail-paused': () => <TailScene state="paused" />,
  'c01-tail-failed': () => <TailScene state="failed" />,
  'c01-tail-stopped': () => <TailScene state="stopped" />,
  'c01-tail-agentstopping': () => <TailScene state="agentstopping" />,
  'c01-tail-agentstalled': () => <TailScene state="agentstalled" />,
  'c01-tail-childstopped': () => <TailScene state="childstopped" />,
  'c01-tail-childconfirm': () => <TailScene state="childconfirm" />,
  'c01-tail-childasked': () => <TailScene state="childasked" />,
};
