import { DESTINATIONS } from '../../../../../shared/navigation/destinations';
import { DestinationRow } from './DestinationRow';

const HEADERS = ['Destination', 'Column and folded rail', 'Go menu', 'Palette', 'Shortcut sheet'];

export const DestinationSheetScene = () => (
  <main className="min-h-screen bg-background p-4 text-body text-foreground">
    <table className="w-full max-w-4xl border-collapse text-left">
      <caption className="pb-3 text-left text-heading">One destination list</caption>
      <thead>
        <tr>
          {HEADERS.map((header) => (
            <th key={header} scope="col" className="px-3 py-2 text-eyebrow text-muted-foreground">
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {DESTINATIONS.map((destination) => (
          <DestinationRow key={destination.id} destination={destination} />
        ))}
      </tbody>
    </table>
  </main>
);
