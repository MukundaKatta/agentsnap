/**
 * Multi-tool example: a booking agent that calls 3 tools in sequence.
 * Demonstrates how a richer trace looks and how the snapshot detects
 * regressions if the agent reorders tools or skips one.
 */
import { test } from 'node:test';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { record, traceTool, expectSnapshot } from '../src/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const SNAP_DIR = join(here, '__snapshots__');

const searchFlights = traceTool('search_flights', async ({ from, to }) => [
  { id: 'UA123', from, to, price: 240 },
  { id: 'DL456', from, to, price: 199 },
]);

const checkSeatMap = traceTool('check_seat_map', async ({ flightId }) => ({
  flightId,
  windowAvailable: true,
}));

const bookFlight = traceTool('book_flight', async ({ flightId, seat }) => ({
  confirmation: `CONF-${flightId}-${seat}`,
}));

async function bookingAgent({ from, to }) {
  const flights = await searchFlights({ from, to });
  const cheapest = flights.reduce((a, b) => (a.price <= b.price ? a : b));
  const seat = (await checkSeatMap({ flightId: cheapest.id })).windowAvailable
    ? 'window'
    : 'aisle';
  const { confirmation } = await bookFlight({ flightId: cheapest.id, seat });
  return `Booked ${cheapest.id} (${seat}). ${confirmation}.`;
}

test('bookingAgent stays on its happy path', async () => {
  const trace = await record(() => bookingAgent({ from: 'NYC', to: 'SFO' }), {
    input: 'Book me a cheap NYC→SFO flight, prefer window seat',
    model: 'mock-deterministic',
  });
  await expectSnapshot(trace, join(SNAP_DIR, 'booking.snap.json'));
});
