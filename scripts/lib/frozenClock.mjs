export const FROZEN_AT = Date.parse('2026-11-05T16:00:00');

export const frozenClockSource = ({ at }) =>
  `(()=>{const F=${at};const D=Date;class X extends D{constructor(...a){a.length===0?super(F):super(...a)}static now(){return F}}window.Date=X})()`;
