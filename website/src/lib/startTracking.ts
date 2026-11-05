import { isCountedClick } from './isCountedClick';
import { readTrackEvent, type TrackSpec } from './readTrackEvent';
import trackEvents from './trackEvents.json';

const CLICKS = ['click', 'auxclick'] as const;
const SPEC: TrackSpec = trackEvents;

let isStarted = false;

type EventParams = {
  readonly event: Event;
};

const isMeasurementGranted = () => {
  const consent: unknown = Reflect.get(window, 'goodboyConsent');
  return (
    typeof consent === 'object' &&
    consent !== null &&
    Reflect.get(consent, 'isMeasurementGranted') === true
  );
};

const dataLayer = () => {
  const layer: unknown = Reflect.get(window, 'dataLayer');
  return Array.isArray(layer) ? layer : null;
};

const onClick = ({ event }: EventParams) => {
  if (!(event.target instanceof Element)) {
    return;
  }
  if (event instanceof MouseEvent && !isCountedClick({ button: event.button })) {
    return;
  }
  const element = event.target.closest('[data-track]');
  const layer = dataLayer();
  if (element === null || layer === null || !isMeasurementGranted()) {
    return;
  }
  const tracked = readTrackEvent({
    attributes: Object.fromEntries(
      Array.from(element.attributes, (attribute) => [attribute.name, attribute.value]),
    ),
    spec: SPEC,
  });
  if (tracked === null) {
    return;
  }
  layer.push({ event: tracked.event, ...tracked.params });
};

export const startTracking = () => {
  if (isStarted) {
    return;
  }
  isStarted = true;
  CLICKS.forEach((name) => document.addEventListener(name, (event) => onClick({ event })));
};
