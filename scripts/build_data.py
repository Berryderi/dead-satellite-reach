"""Turn raw CelesTrak records into data/satellites.json for the page.

Usage: python3 scripts/build_data.py raw/gp.jsonl data/satellites.json 2026-11-02
"""
import datetime as dt
import json
import math
import sys

MU = 398600.4418
EARTH_RADIUS_KM = 6378.137
J2 = 1.08263e-3
# Above this, one altitude no longer describes the orbit, so the simple estimate doesn't apply.
MAX_ECCENTRICITY = 0.02


def sun_right_ascension(when):
    days = (when - dt.datetime(2000, 1, 1, 12)).total_seconds() / 86400
    mean_longitude = (280.46 + 0.9856474 * days) % 360
    anomaly = math.radians((357.528 + 0.9856003 * days) % 360)
    longitude = math.radians(mean_longitude + 1.915 * math.sin(anomaly) + 0.02 * math.sin(2 * anomaly))
    tilt = math.radians(23.439 - 4e-7 * days)
    return math.degrees(math.atan2(math.cos(tilt) * math.sin(longitude), math.cos(longitude))) % 360


def main(source, target, date_text):
    reference = dt.datetime.fromisoformat(date_text)
    sats, excluded = [], 0
    for line in open(source):
        record = json.loads(line)
        eccentricity = float(record["ECCENTRICITY"])
        if eccentricity >= MAX_ECCENTRICITY:
            excluded += 1
            continue
        epoch = dt.datetime.fromisoformat(record["EPOCH"][:19])
        motion = float(record["MEAN_MOTION"]) * 2 * math.pi / 86400
        semi_major = (MU / motion**2) ** (1 / 3)
        inclination = float(record["INCLINATION"])
        rate = (
            -1.5 * J2 * (EARTH_RADIUS_KM / semi_major) ** 2 * motion
            * math.cos(math.radians(inclination)) / (1 - eccentricity**2) ** 2
            * 86400 * 180 / math.pi
        )
        raan = (float(record["RA_OF_ASC_NODE"]) + rate * (reference - epoch).total_seconds() / 86400) % 360
        rcs = record["_rcs"]
        sats.append({
            "name": record["OBJECT_NAME"], "id": record["NORAD_CAT_ID"], "owner": record["_owner"],
            "launch": int(record["_launch"][:4]), "h": round(semi_major - EARTH_RADIUS_KM, 2),
            "i": round(inclination, 4), "raan": round(raan, 4), "rate": round(rate, 6),
            "rcs": round(float(rcs), 3) if rcs else None,
        })
    sats.sort(key=lambda s: s["id"])
    meta = {
        "date": date_text, "sunRa": round(sun_right_ascension(reference + dt.timedelta(hours=12)), 4),
        "count": len(sats), "excludedEccentric": excluded, "source": "CelesTrak SATCAT and GP data",
    }
    with open(target, "w") as out:
        json.dump({"meta": meta, "sats": sats}, out, separators=(",", ":"))
    print(meta)


if __name__ == "__main__":
    main(*sys.argv[1:4])
