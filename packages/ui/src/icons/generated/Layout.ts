import { glyph } from '../glyph';

export const Layout = glyph({
  name: 'Layout',
  drawing: {
    regular:
      'm216,40H40a16,16,0,0,0-16,16v144a16,16,0,0,0,16,16h176a16,16,0,0,0,16-16V56a16,16,0,0,0-16-16zm0,16v40H40V56zM40,112h56v88H40zm176,88H112v-88h104v88z',
    duotone: {
      shade: 'm104,104v104H40a8,8,0,0,1-8-8v-96z',
      line: 'm216,40H40a16,16,0,0,0-16,16v144a16,16,0,0,0,16,16h176a16,16,0,0,0,16-16V56a16,16,0,0,0-16-16zm0,16v40H40V56zM40,112h56v88H40zm176,88H112v-88h104v88z',
    },
  },
});
