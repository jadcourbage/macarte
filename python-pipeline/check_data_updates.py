"""CarteScolaire.paris — Data Freshness Checker

Standalone script (stdlib only) that checks whether new data has been published
on each source used by the pipeline.

Mirror of run_pipeline.py constants — update manually after each pipeline run.
"""

import json
import sys
import urllib.request
from datetime import date
from urllib.parse import urlencode

# === Data vintage — mirror in run_pipeline.py SECTO_YEAR / BREVET_SESSION / etc. ===
CURRENT_SECTO_YEAR     = "2025/2026"
CURRENT_BREVET_SESSION = 2024
CURRENT_IPS_RENTREE    = "2024-2025"
CURRENT_BAC_ANNEE      = 2024


def _fetch_facets(base_url, dataset, facet):
    """Fetch facet values from an ODS v2.1 /facets endpoint."""
    payload = [("facet", facet)]
    url = f"{base_url}/{dataset}/facets?{urlencode(payload)}"
    with urllib.request.urlopen(url, timeout=15) as resp:
        data = json.load(resp)
    facets = data.get("facets", [])
    for f in facets:
        if f.get("name") == facet:
            return [item["value"] for item in f.get("facets", [])]
    return []


def check_sectorisation():
    base = "https://opendata.paris.fr/api/explore/v2.1/catalog/datasets"
    values = _fetch_facets(base, "secteurs-scolaires-colleges", "id_projet")
    # Values look like 'COLLEGES (année scolaire 2025/2026)' — extract year part
    years = []
    for v in values:
        if "année scolaire" in v:
            year = v.split("année scolaire")[-1].strip().rstrip(")")
            years.append(year.strip())
    latest = max(years) if years else None
    configured = CURRENT_SECTO_YEAR
    return "Sectorisation", configured, latest


def check_brevet():
    base = "https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets"
    values = _fetch_facets(base, "fr-en-indicateurs-valeur-ajoutee-colleges", "session")
    # Values are numeric year strings e.g. "2024"
    latest = str(max(int(v) for v in values if v.isdigit())) if values else None
    configured = str(CURRENT_BREVET_SESSION)
    return "Brevet", configured, latest


def check_ips():
    base = "https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets"
    values = _fetch_facets(base, "fr-en-ips-colleges-ap2023", "rentree_scolaire")
    # Values are strings like "2024-2025"
    latest = max(values) if values else None
    configured = CURRENT_IPS_RENTREE
    return "IPS coll\u00e8ges", configured, latest


def check_bac():
    base = "https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets"
    values = _fetch_facets(base, "fr-en-indicateurs-de-resultat-des-lycees-gt_v2", "annee")
    latest = str(max(int(v) for v in values if v.isdigit())) if values else None
    configured = str(CURRENT_BAC_ANNEE)
    return "Bac", configured, latest


def main():
    today = date.today().isoformat()
    print(f"CarteScolaire \u2014 Data Freshness Report ({today})")
    print("=" * 50)

    checks = [check_sectorisation, check_brevet, check_ips, check_bac]
    updates_needed = 0

    for check_fn in checks:
        try:
            label, configured, latest = check_fn()
        except Exception as e:
            print(f"[ERROR]  {check_fn.__name__}: {e}")
            continue

        if latest is None:
            status = "[WARN] "
            note = "could not determine latest value"
        elif latest == configured:
            status = "[OK]   "
            note = ""
        else:
            status = "[UPDATE]"
            note = ""
            updates_needed += 1

        line = f"{status}  {label:<20} configured: {configured:<12} latest: {latest}"
        if note:
            line += f"  ({note})"
        print(line)

    print()
    if updates_needed == 0:
        print("All sources are up to date.")
    else:
        print(f"{updates_needed} update(s) available. Update run_pipeline.py constants and rerun the pipeline.")

    return updates_needed


if __name__ == "__main__":
    sys.exit(0 if main() == 0 else 1)
