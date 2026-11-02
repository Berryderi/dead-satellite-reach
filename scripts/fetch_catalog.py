"""Download CelesTrak's catalog and orbital elements for dead satellites near polar orbit.

Usage: python3 scripts/fetch_catalog.py raw/
Slow on purpose: CelesTrak asks users not to overload it.
"""
import csv
import json
import logging
import pathlib
import sys
import time
import urllib.request

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
CATALOG_URL = "https://celestrak.org/pub/satcat.csv"
ELEMENTS_URL = "https://celestrak.org/NORAD/elements/gp.php?CATNR={id}&FORMAT=json"
HEADERS = {"User-Agent": "dead-satellite-reach"}
PAUSE_SECONDS = 2
MAX_APOGEE_KM = 2000
MIN_MEAN_ALTITUDE_KM = 400
MIN_INCLINATION, MAX_INCLINATION = 90, 105


def number(text):
    try:
        return float(text)
    except ValueError:
        return None


def is_candidate(row):
    if row["OBJECT_TYPE"] != "PAY" or row["DECAY_DATE"].strip() or row["OPS_STATUS_CODE"].strip() != "-":
        return False
    apogee, perigee, inclination = (number(row[k]) for k in ("APOGEE", "PERIGEE", "INCLINATION"))
    if None in (apogee, perigee, inclination) or apogee > MAX_APOGEE_KM:
        return False
    return MIN_INCLINATION <= inclination <= MAX_INCLINATION and (apogee + perigee) / 2 >= MIN_MEAN_ALTITUDE_KM


def fetch(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=20) as response:
        return response.read()


def main(raw_dir):
    raw = pathlib.Path(raw_dir)
    raw.mkdir(parents=True, exist_ok=True)
    catalog = raw / "satcat.csv"
    catalog.write_bytes(fetch(CATALOG_URL))
    rows = list(csv.DictReader(catalog.open(newline="", encoding="utf-8", errors="replace")))
    selected = [r for r in rows if is_candidate(r)]
    logging.info("selected %d", len(selected))
    with (raw / "gp.jsonl").open("w") as out:
        for row in selected:
            try:
                record = json.loads(fetch(ELEMENTS_URL.format(id=row["NORAD_CAT_ID"])))[0]
            except Exception as error:
                logging.warning("no elements for %s: %s", row["NORAD_CAT_ID"], error)
                continue
            record.update(_owner=row["OWNER"], _launch=row["LAUNCH_DATE"], _rcs=row["RCS"])
            out.write(json.dumps(record) + "\n")
            time.sleep(PAUSE_SECONDS)


if __name__ == "__main__":
    main(sys.argv[1])
