#!/usr/bin/env python3
"""Rights-aware, small-batch automotive open-data pipeline.

Only NHTSA public endpoints and the licensed MechanicDB public sample are used.
Raw responses and the SQLite development database remain in ignored data/.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import sqlite3
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data"
RAW = DATA / "raw"
DB_PATH = DATA / "dev" / "repair_data.sqlite"
CATALOG_PATH = ROOT / "mvp" / "data" / "open-data-catalog.json"
USER_AGENT = "GarageAtlasOpenData/1.0 (rights-aware small-batch pipeline)"
TARGET_MAKES = ["Toyota", "Honda", "Hyundai", "Kia", "Mazda", "Ford", "VinFast", "Mitsubishi", "Suzuki", "Mercedes-Benz", "BMW"]
TARGET_VEHICLES = [("Toyota", "Camry", 2020), ("Honda", "Civic", 2020), ("Hyundai", "Elantra", 2020)]
MECHANICDB = "https://raw.githubusercontent.com/MechanicDB/MechanicDB-public/main/"

VI = {
    "P0300": ("Phát hiện bỏ máy ngẫu nhiên / nhiều xi-lanh", "ECU phát hiện hiện tượng bỏ máy xảy ra ngẫu nhiên hoặc trên nhiều xi-lanh."),
    "P0420": ("Hiệu suất bộ xúc tác dưới ngưỡng — Bank 1", "Hiệu suất bộ xúc tác ở bank 1 thấp hơn ngưỡng giám sát của ECU."),
    "P0562": ("Điện áp hệ thống thấp", "Điện áp nguồn hệ thống thấp hơn dải vận hành mà ECU mong đợi."),
    "U0100": ("Mất liên lạc với ECM/PCM", "Một module mất liên lạc mạng với mô-đun điều khiển động cơ hoặc hệ truyền động.")
}


class Client:
    def __init__(self, min_interval: float = 0.5, offline: bool = False):
        self.min_interval, self.offline, self.last_request = min_interval, offline, 0.0

    def get(self, url: str, source: str, suffix: str) -> bytes:
        digest = hashlib.sha256(url.encode("utf-8")).hexdigest()
        path = RAW / source / f"{digest}.{suffix}"
        if path.exists():
            return path.read_bytes()
        if self.offline:
            raise RuntimeError(f"Offline cache miss: {url}")
        path.parent.mkdir(parents=True, exist_ok=True)
        for attempt in range(3):
            delay = self.min_interval - (time.monotonic() - self.last_request)
            if delay > 0:
                time.sleep(delay)
            try:
                request = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json,text/csv,text/plain"})
                with urlopen(request, timeout=25) as response:
                    body = response.read()
                    if response.status != 200:
                        raise RuntimeError(f"HTTP {response.status}")
                self.last_request = time.monotonic()
                path.write_bytes(body)
                return body
            except Exception:
                if attempt == 2:
                    raise
                time.sleep(2 ** attempt)
        raise RuntimeError("unreachable")


def utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


def connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    db.executescript("""
    pragma foreign_keys = on;
    create table if not exists data_sources (id text primary key, name text not null, url text not null, license text, attribution_text text, commercial_ok integer, redistribution_ok integer, review_status text not null, fetched_at text);
    create table if not exists makes (id integer primary key, name text not null unique, source_id text not null references data_sources(id));
    create table if not exists models (id integer primary key, make_id integer not null references makes(id), name text not null, source_id text not null references data_sources(id), unique(make_id,name));
    create table if not exists vehicle_years (id integer primary key, model_id integer not null references models(id), year integer not null, trim text, engine text, fuel text, transmission text, source_id text not null references data_sources(id), unique(model_id,year,trim,engine));
    create table if not exists dtc_codes (id integer primary key, source_code_id text, code text not null unique, system text, description_en text, description_vi text, title_en text, title_vi text, is_generic integer, source_id text not null references data_sources(id), translation_status text not null);
    create table if not exists repair_fixes (id integer primary key, source_fix_id text not null, dtc_code_id integer not null references dtc_codes(id), rank integer, title text, difficulty text, parts_cost_min real, parts_cost_max real, labor_hours real, steps text, source_id text not null references data_sources(id), unique(source_id,source_fix_id));
    create table if not exists parts (id integer primary key, source_part_id text not null, name_en text not null, name_vi text, category text, oem_number text, notes text, source_id text not null references data_sources(id), translation_status text not null, unique(source_id,source_part_id));
    create table if not exists fix_parts (fix_id integer references repair_fixes(id), part_id integer references parts(id), primary key(fix_id,part_id));
    create table if not exists recalls (id integer primary key, campaign_no text not null, make text not null, model text not null, model_year integer not null, component text, summary text, consequence text, remedy text, report_date text, source_url text not null, source_id text not null references data_sources(id), unique(source_id,campaign_no));
    create table if not exists complaints (id integer primary key, odi_no text not null, make text not null, model text not null, model_year integer not null, component text, summary text, complaint_date text, source_url text not null, source_id text not null references data_sources(id), unique(source_id,odi_no));
    create table if not exists api_cache (request_url text primary key, source_id text not null, sha256 text not null, fetched_at text not null, status_code integer not null);
    """)
    return db


def seed_sources(db: sqlite3.Connection) -> None:
    rows = [
        ("nhtsa-vpic", "NHTSA vPIC", "https://vpic.nhtsa.dot.gov/api/", "Public API; no SPDX license stated", "NHTSA vPIC", 1, 0, "approved"),
        ("nhtsa-recalls", "NHTSA Recalls API", "https://api.nhtsa.gov/recalls/", "Public API; redistribution not asserted", "NHTSA Recalls API", 1, 0, "approved"),
        ("nhtsa-complaints", "NHTSA Complaints API", "https://api.nhtsa.gov/complaints/", "Public API; redistribution not asserted", "NHTSA Complaints API", 1, 0, "approved"),
        ("mechanicdb-obd2-sample", "MechanicDB OBD-II developer sample", "https://github.com/MechanicDB/MechanicDB-public", "ODbL-1.0", "MechanicDB, ODbL v1.0", 1, 1, "approved"),
    ]
    for row in rows:
        db.execute("""insert into data_sources(id,name,url,license,attribution_text,commercial_ok,redistribution_ok,review_status,fetched_at)
            values(?,?,?,?,?,?,?,?,?) on conflict(id) do update set fetched_at=excluded.fetched_at""", (*row, utcnow()))
    db.commit()


def remember(db: sqlite3.Connection, source_id: str, url: str, body: bytes) -> None:
    db.execute("""insert into api_cache(request_url,source_id,sha256,fetched_at,status_code) values(?,?,?,?,200)
       on conflict(request_url) do update set sha256=excluded.sha256,fetched_at=excluded.fetched_at,status_code=200""", (url, source_id, hashlib.sha256(body).hexdigest(), utcnow()))


def fetch_json(client: Client, db: sqlite3.Connection, source_id: str, url: str) -> dict:
    body = client.get(url, source_id, "json")
    remember(db, source_id, url, body)
    return json.loads(body.decode("utf-8"))


def ingest_nhtsa(client: Client, db: sqlite3.Connection) -> None:
    for make in TARGET_MAKES:
        url = f"https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMake/{quote(make)}?format=json"
        payload = fetch_json(client, db, "nhtsa-vpic", url)
        db.execute("insert into makes(name,source_id) values(?,?) on conflict(name) do nothing", (make, "nhtsa-vpic"))
        make_id = db.execute("select id from makes where name=?", (make,)).fetchone()[0]
        for record in payload.get("Results", [])[:80]:
            name = (record.get("Model_Name") or "").strip()
            if name:
                db.execute("insert into models(make_id,name,source_id) values(?,?,?) on conflict(make_id,name) do nothing", (make_id, name, "nhtsa-vpic"))
    for make, model, year in TARGET_VEHICLES:
        params = urlencode({"make": make, "model": model, "modelYear": year})
        for source_id, endpoint, table in [("nhtsa-recalls", "https://api.nhtsa.gov/recalls/recallsByVehicle?", "recalls"), ("nhtsa-complaints", "https://api.nhtsa.gov/complaints/complaintsByVehicle?", "complaints")]:
            url = endpoint + params
            payload = fetch_json(client, db, source_id, url)
            for row in payload.get("results", [])[:30]:
                if table == "recalls":
                    campaign = str(row.get("NHTSACampaignNumber") or row.get("CampaignNumber") or "")
                    if campaign:
                        db.execute("""insert into recalls(campaign_no,make,model,model_year,component,summary,consequence,remedy,report_date,source_url,source_id)
                         values(?,?,?,?,?,?,?,?,?,?,?) on conflict(source_id,campaign_no) do update set summary=excluded.summary,remedy=excluded.remedy""", (campaign, make, model, year, row.get("Component"), row.get("Summary"), row.get("Consequence"), row.get("Remedy"), row.get("ReportReceivedDate"), url, source_id))
                else:
                    odi = str(row.get("odiNumber") or row.get("ODINumber") or "")
                    if odi:
                        db.execute("""insert into complaints(odi_no,make,model,model_year,component,summary,complaint_date,source_url,source_id)
                         values(?,?,?,?,?,?,?,?,?) on conflict(source_id,odi_no) do update set summary=excluded.summary""", (odi, make, model, year, row.get("components"), row.get("summary"), row.get("dateComplaintFiled"), url, source_id))
    db.commit()


def pipe_rows(body: bytes):
    return csv.DictReader(body.decode("utf-8-sig").splitlines(), delimiter="|")


def ingest_mechanicdb(client: Client, db: sqlite3.Connection) -> None:
    license_body = client.get(MECHANICDB + "LICENSE", "mechanicdb-obd2-sample", "txt")
    if b"Open Database License (ODbL) v1.0" not in license_body:
        raise RuntimeError("MechanicDB license preflight failed; data not imported")
    codes_body = client.get(MECHANICDB + "dtc_codes.csv", "mechanicdb-obd2-sample", "csv")
    fixes_body = client.get(MECHANICDB + "diagnostic_fixes.csv", "mechanicdb-obd2-sample", "csv")
    parts_body = client.get(MECHANICDB + "replacement_parts.csv", "mechanicdb-obd2-sample", "csv")
    for url, body in [(MECHANICDB + "dtc_codes.csv", codes_body), (MECHANICDB + "diagnostic_fixes.csv", fixes_body), (MECHANICDB + "replacement_parts.csv", parts_body)]:
        remember(db, "mechanicdb-obd2-sample", url, body)
    code_ids = {}
    for row in pipe_rows(codes_body):
        code = row["dtc_code"].strip()
        title_en = row.get("short_description", "").strip()
        title_vi, description_vi = VI.get(code, (None, None))
        translation_status = "machine" if title_vi else "needs_review"
        db.execute("""insert into dtc_codes(source_code_id,code,system,description_en,description_vi,title_en,title_vi,is_generic,source_id,translation_status)
          values(?,?,?,?,?,?,?,?,?,?) on conflict(code) do update set description_en=excluded.description_en,title_en=excluded.title_en,title_vi=coalesce(excluded.title_vi,dtc_codes.title_vi),description_vi=coalesce(excluded.description_vi,dtc_codes.description_vi),translation_status=excluded.translation_status""", (row.get("code_id"), code, row.get("system_category"), row.get("detailed_technical_explanation"), description_vi, title_en, title_vi, 0 if row.get("is_oem_specific") == "1" else 1, "mechanicdb-obd2-sample", translation_status))
        code_ids[row.get("code_id")] = db.execute("select id from dtc_codes where code=?", (code,)).fetchone()[0]
    fix_ids = {}
    for row in pipe_rows(fixes_body):
        dtc_id = code_ids.get(row.get("code_id"))
        if not dtc_id:
            continue
        db.execute("""insert into repair_fixes(source_fix_id,dtc_code_id,rank,title,difficulty,parts_cost_min,parts_cost_max,labor_hours,steps,source_id)
          values(?,?,?,?,?,?,?,?,?,?) on conflict(source_id,source_fix_id) do update set title=excluded.title,steps=excluded.steps""", (row["fix_id"], dtc_id, row.get("probability_rank"), row.get("fix_title"), row.get("difficulty_level"), row.get("est_parts_cost_min_usd"), row.get("est_parts_cost_max_usd"), row.get("est_labor_hours"), row.get("step_by_step_instructions"), "mechanicdb-obd2-sample"))
        fix_ids[row["fix_id"]] = db.execute("select id from repair_fixes where source_id=? and source_fix_id=?", ("mechanicdb-obd2-sample", row["fix_id"])).fetchone()[0]
    for row in pipe_rows(parts_body):
        part_id = row["part_id"]
        db.execute("""insert into parts(source_part_id,name_en,name_vi,category,oem_number,notes,source_id,translation_status)
          values(?,?,?,?,?,?,?,?) on conflict(source_id,source_part_id) do update set name_en=excluded.name_en,notes=excluded.notes""", (part_id, row.get("part_name"), None, "repair tool or replacement part", None, row.get("amazon_search_query"), "mechanicdb-obd2-sample", "needs_review"))
        local_part = db.execute("select id from parts where source_id=? and source_part_id=?", ("mechanicdb-obd2-sample", part_id)).fetchone()[0]
        if row.get("fix_id") in fix_ids:
            db.execute("insert or ignore into fix_parts(fix_id,part_id) values(?,?)", (fix_ids[row["fix_id"]], local_part))
    db.commit()


def export_catalog(db: sqlite3.Connection) -> dict:
    def rows(sql, params=()):
        return [dict(row) for row in db.execute(sql, params).fetchall()]
    output = {
        "generated_at": utcnow(),
        "disclaimer": "Thông tin sửa chữa mang tính tham khảo. Đối chiếu tài liệu kỹ thuật của hãng và tuân thủ an toàn trước khi thao tác.",
        "sources": rows("select id,name,url,license,attribution_text,commercial_ok,redistribution_ok,review_status,fetched_at from data_sources order by id"),
        "dtc_codes": rows("select code,system,title_en,title_vi,description_en,description_vi,translation_status from dtc_codes order by code"),
        "repair_fixes": rows("""select d.code,f.rank,f.title,f.difficulty,f.parts_cost_min,f.parts_cost_max,f.labor_hours,f.steps
           from repair_fixes f join dtc_codes d on d.id=f.dtc_code_id order by d.code,f.rank"""),
        "parts": rows("select name_en,name_vi,category,oem_number,notes,translation_status from parts order by name_en"),
        "recalls": rows("select campaign_no,make,model,model_year,component,summary,consequence,remedy,report_date,source_url from recalls order by report_date desc"),
        "complaints": rows("select odi_no,make,model,model_year,component,summary,complaint_date,source_url from complaints order by complaint_date desc"),
        "makes": rows("select name from makes order by name"),
        "stats": {name: db.execute(f"select count(*) from {name}").fetchone()[0] for name in ("makes","models","dtc_codes","repair_fixes","parts","recalls","complaints")}
    }
    CATALOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    CATALOG_PATH.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    return output


def verify(db: sqlite3.Connection, client: Client) -> None:
    vin = "1HGCM82633A004352"
    decoded = fetch_json(client, db, "nhtsa-vpic", f"https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/{vin}?format=json")
    result = decoded.get("Results", [{}])[0]
    assert result.get("Make") == "HONDA", "VIN sample did not decode as Honda"
    assert db.execute("select count(*) from dtc_codes where code='P0420'").fetchone()[0] == 1, "P0420 missing"
    assert db.execute("select count(*) from recalls").fetchone()[0] > 0, "No recall test data"
    assert db.execute("select count(*) from parts").fetchone()[0] > 0, "No parts test data"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--offline", action="store_true", help="Only use existing local raw cache")
    parser.add_argument("--skip-verify", action="store_true")
    args = parser.parse_args()
    db = connect()
    client = Client(offline=args.offline)
    seed_sources(db)
    ingest_nhtsa(client, db)
    ingest_mechanicdb(client, db)
    catalog = export_catalog(db)
    if not args.skip_verify:
        verify(db, client)
    unknown = db.execute("select count(*) from data_sources where review_status='unknown'").fetchone()[0]
    print(json.dumps({"database": str(DB_PATH), "catalog": str(CATALOG_PATH), "stats": catalog["stats"], "license_unknown_sources": unknown}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"Pipeline failed: {exc}", file=sys.stderr)
        raise SystemExit(1)
