# Dead satellite reach

A public demo for an early idea: a station in orbit that clears dead satellites for their owners and reuses what still works. This page answers the first question: which dead satellites could one station reach, and who owns them?

Live page: https://berryderi.github.io/dead-satellite-reach/

The station doesn't exist, and no owner has agreed to anything.

## How the estimate works
- **Data:** CelesTrak catalog status and orbital elements, snapshot in `data/satellites.json`. It covers payloads marked non-operational, near-circular, tilted 90 to 105 degrees, between 400 km and 2,000 km.
- **Station:** a circular sun-synchronous orbit at the chosen altitude and local time.
- **Fuel:** a one-way combined plane and altitude change, scanned every 5 days through the wait, with nodes drifting at constant J2 rates. See `reach.js`.
- **Left out:** the return trip, phasing inside the orbit, capture of tumbling objects, long-period inclination drift, and whether each satellite is really dead. Not reviewed by a spacecraft engineer.

## Run it
```
python3 -m http.server 8000     # then open http://localhost:8000
npm test
```
`test/golden.json` holds counts from a separate Python calculation on the same data.

## Refresh the data
```
python3 scripts/fetch_catalog.py raw/
python3 scripts/build_data.py raw/gp.jsonl data/satellites.json YYYY-MM-DD
```
Refreshing changes the counts, so regenerate `test/golden.json` too.

## Credit
Satellite data originates from USSPACECOM via [Space-Track.org](https://www.space-track.org), retrieved through [CelesTrak](https://celestrak.org) (Dr. T.S. Kelso). The analysis is ours, not theirs. Built with Claude Code.
