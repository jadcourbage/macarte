import datetime
import json
import os
import re
import urllib.request
import warnings
from urllib.parse import urlencode

import geopandas as gpd
import pandas as pd
from unidecode import unidecode

# === Data vintage — NOTE: mirror in check_data_updates.py CURRENT_* constants ===
SECTO_YEAR     = "2026/2027"
BREVET_SESSION = 2024
IPS_RENTREE    = "2024-2025"
BAC_ANNEE      = 2024


def get_paris_data_geojson(dataset, id_projet=None):
    """Récupérer un dataset GeoJSON de opendata.paris.fr.

    Args:
        dataset (str): l'identifiant du dataset, ex : `etablissements-scolaires-colleges`
            (voir https://opendata.paris.fr/pages/catalogue/)
        id_projet (str): un filtre optionnel sur le dataset, ex : `COLLEGES (année scolaire 2023/2024)`

    Returns:
        gpd.GeoDataFrame
    """
    base_url = "https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/"

    payload = [("refine", f'id_projet:"{id_projet}"')]

    full_url = f"{base_url}/{dataset}/exports/geojson?{urlencode(payload)}"

    return gpd.read_file(full_url)


def get_colleges_reussite_brevet(session=None):
    """Récupérer le dataset de taux de réussite au brevet des collèges.

    Args:
        session (int): année de session (défaut: BREVET_SESSION)

    Returns:
        pd.DataFrame
    """
    if session is None:
        session = BREVET_SESSION

    base_url = "https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/"

    dataset = "fr-en-indicateurs-valeur-ajoutee-colleges"
    departement = "PARIS"
    delimiter = ";"
    payload = [
        ("refine", f'session:"{session}"'),
        ("refine", f'departement:"{departement}"'),
        ("use_labels", True),
        ("delimiter", delimiter),
    ]

    full_url = f"{base_url}/{dataset}/exports/csv?{urlencode(payload)}"
    print(full_url)

    return pd.read_csv(full_url, delimiter=delimiter)


UAI_MAPPING_PATH = os.path.join(os.path.dirname(__file__), "uai_mapping.csv")


def load_uai_mapping():
    """Charge le mapping nom_paris → UAI depuis le fichier CSV."""
    df = pd.read_csv(UAI_MAPPING_PATH, dtype=str, sep=";")
    mapping = dict(zip(df.nom_paris, df.uai))
    return mapping


def clean_nom(string):
    """Normalise un libellé d'établissement pour faciliter le merge entre datasets."""
    # `unidecode` retire les caractères spéciaux et accents
    string = unidecode(string)
    string = string.replace("-", " ")
    string = string.replace("SAINT", "ST")
    string.removeprefix("LA ")
    string.removeprefix("LE ")
    # Cas spécial pour "MADAME DE STAEL" vs "DE STAEL"
    string = string.replace("MADAME ", "")
    return string


def prepro_df_educnat(df):
    """Preprocessing de la dataframe issue du dataset de l'Éducation Nationale."""
    df["txreussite"] = round(df["Taux de réussite G"], ndigits=1)
    df["txmention"] = round(
        100 * df["Nb mentions global G"] / df["Nb candidats G"], ndigits=1
    )

    df["Presents"] = df["Nb candidats G"]
    df["Admis"] = round(df["Nb candidats G"] * df["Taux de réussite G"] / 100)
    df["Admis sans mention"] = df["Admis"] - df["Nb mentions global G"]

    df["Patronyme"] = df["Nom de l'établissement"]
    df["code"] = df["UAI"]

    return df


def get_all_paris_schools():
    """Fetch all Paris schools from the national API.

    Returns:
        dict: keyed by UAI code (str), values are dicts with school info.
    """
    base_url = "https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/"
    dataset = "fr-en-adresse-et-geolocalisation-etablissements-premier-et-second-degre"
    select_fields = (
        "numero_uai,patronyme_uai,adresse_uai,code_postal_uai,"
        "nature_uai,nature_uai_libe,secteur_public_prive_libe,latitude,longitude"
    )

    schools = {}
    offset = 0
    limit = 100

    while True:
        payload = [
            ("where", 'code_departement="075"'),
            ("select", select_fields),
            ("limit", limit),
            ("offset", offset),
        ]
        url = f"{base_url}/{dataset}/records?{urlencode(payload)}"
        print(f"Fetching schools: offset={offset} — {url}")

        with urllib.request.urlopen(url) as resp:
            data = json.load(resp)

        for record in data["results"]:
            uai = record.get("numero_uai")
            if not uai:
                continue
            lat = record.get("latitude")
            lng = record.get("longitude")
            schools[uai] = {
                "nom": record.get("patronyme_uai"),
                "adresse": record.get("adresse_uai"),
                "code_postal": str(record.get("code_postal_uai", "")),
                "nature_uai": record.get("nature_uai"),
                "nature_uai_libe": record.get("nature_uai_libe"),
                "secteur_public_prive_libe": record.get("secteur_public_prive_libe"),
                "lat": round(float(lat), 5) if lat is not None else None,
                "lng": round(float(lng), 5) if lng is not None else None,
            }

        batch = data["results"]
        offset += limit
        if len(batch) < limit:
            break

    print(f"Fetched {len(schools)} schools total")
    if len(schools) < 1200:
        raise RuntimeError(
            f"Only {len(schools)} schools fetched — API returned incomplete data. "
            "Re-run the pipeline."
        )
    return schools


def merge_brevet_results(schools):
    """Ajoute les taux de réussite et de mention au brevet pour les collèges.

    Fetches primary session (BREVET_SESSION); falls back to BREVET_SESSION-1 for
    colleges that are missing from the primary dataset. Stores brevet_session per school.

    Args:
        schools (dict): keyed by UAI, modified in place.

    Returns:
        dict: same dict with txreussite/txmention/brevet_session added to college entries.
    """
    df_primary = get_colleges_reussite_brevet(BREVET_SESSION)
    df_primary = prepro_df_educnat(df_primary)
    primary_by_uai = df_primary.set_index("code")[["txreussite", "txmention"]].to_dict("index")

    # Identify public colleges missing from the primary dataset
    colleges_needing_fallback = [
        uai for uai, s in schools.items()
        if s.get("nature_uai") == 340
        and s.get("secteur_public_prive_libe") == "Public"
        and uai not in primary_by_uai
    ]

    fallback_by_uai = {}
    if colleges_needing_fallback:
        fb_session = BREVET_SESSION - 1
        print(f"{len(colleges_needing_fallback)} colleges missing brevet {BREVET_SESSION}, fetching {fb_session}...")
        df_fallback = get_colleges_reussite_brevet(fb_session)
        df_fallback = prepro_df_educnat(df_fallback)
        fallback_by_uai = df_fallback.set_index("code")[["txreussite", "txmention"]].to_dict("index")

    for uai, school in schools.items():
        if uai in primary_by_uai:
            school["txreussite"] = primary_by_uai[uai]["txreussite"]
            school["txmention"] = primary_by_uai[uai]["txmention"]
            school["brevet_session"] = BREVET_SESSION
        elif uai in fallback_by_uai:
            school["txreussite"] = fallback_by_uai[uai]["txreussite"]
            school["txmention"] = fallback_by_uai[uai]["txmention"]
            school["brevet_session"] = BREVET_SESSION - 1
            print(f"  [fallback brevet] {uai} {school.get('nom')}")

    return schools


def _prev_ips_rentree(rentree):
    """Return the previous IPS rentree string. "2024-2025" → "2023-2024"."""
    start, end = int(rentree[:4]), int(rentree[5:])
    return f"{start - 1}-{end - 1}"


def _fetch_ips_records(rentree):
    """Fetch all IPS records for a given rentree_scolaire."""
    base = ("https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets"
            "/fr-en-ips-colleges-ap2023/records")
    results = []
    offset = 0
    limit = 100
    while True:
        payload = [
            ("refine", f'rentree_scolaire:"{rentree}"'),
            ("refine", 'code_du_departement:"75"'),
            ("select", "uai,ips,ips_national,ips_academique"),
            ("limit", limit),
            ("offset", offset),
        ]
        url = f"{base}?{urlencode(payload)}"
        print(url)
        with urllib.request.urlopen(url) as resp:
            data = json.load(resp)
        batch = data["results"]
        results.extend(batch)
        offset += limit
        if len(batch) < limit:
            break
    return results


def merge_ips_colleges(schools):
    """Ajoute l'indice de positionnement social (IPS) pour les collèges parisiens.

    Fetches primary rentree (IPS_RENTREE); falls back to previous year for schools
    missing from the primary dataset. Stores ips_rentree per school.

    Args:
        schools (dict): keyed by UAI, modified in place.

    Returns:
        dict: same dict with ips/ips_national/ips_academique/ips_rentree added to college entries.
    """
    primary_records = _fetch_ips_records(IPS_RENTREE)
    primary_by_uai = {r["uai"]: r for r in primary_records if r.get("uai")}

    # Identify public colleges needing fallback
    colleges_needing_fallback = [
        uai for uai, s in schools.items()
        if s.get("nature_uai") == 340
        and s.get("secteur_public_prive_libe") == "Public"
        and uai not in primary_by_uai
    ]

    fallback_by_uai = {}
    prev_rentree = _prev_ips_rentree(IPS_RENTREE)
    if colleges_needing_fallback:
        print(f"{len(colleges_needing_fallback)} colleges missing IPS {IPS_RENTREE}, fetching {prev_rentree}...")
        fallback_records = _fetch_ips_records(prev_rentree)
        fallback_by_uai = {r["uai"]: r for r in fallback_records if r.get("uai")}

    def _apply_ips(uai, record, rentree):
        ips = record.get("ips")
        ips_nat = record.get("ips_national")
        ips_acad = record.get("ips_academique")
        if ips is not None:
            schools[uai]["ips"] = round(float(ips), 1)
        if ips_nat is not None:
            schools[uai]["ips_national"] = round(float(ips_nat), 1)
        if ips_acad is not None:
            schools[uai]["ips_academique"] = round(float(ips_acad), 1)
        if (ips is not None and ips_nat is not None and ips_acad is not None
                and schools[uai].get("secteur_public_prive_libe") == "Public"):
            ips_val = float(ips)
            if ips_val < float(ips_nat):
                schools[uai]["bonus_ips"] = 1200
            elif ips_val < float(ips_acad):
                schools[uai]["bonus_ips"] = 600
            else:
                schools[uai]["bonus_ips"] = 0
        schools[uai]["ips_rentree"] = rentree

    matched = 0
    fallback_matched = 0
    for uai in list(schools.keys()):
        if uai in primary_by_uai:
            _apply_ips(uai, primary_by_uai[uai], IPS_RENTREE)
            matched += 1
        elif uai in fallback_by_uai:
            _apply_ips(uai, fallback_by_uai[uai], prev_rentree)
            fallback_matched += 1
            print(f"  [fallback IPS] {uai} {schools[uai].get('nom')}")

    print(f"Merged IPS for {matched} colleges ({fallback_matched} at {prev_rentree} fallback)")
    return schools


def _fetch_bac_records(annee):
    """Fetch all Bac result records for a given annee."""
    base = ("https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets"
            "/fr-en-indicateurs-de-resultat-des-lycees-gt_v2/records")
    results = []
    offset = 0
    limit = 100
    while True:
        payload = [
            ("refine", f"annee:{annee}"),
            ("refine", "code_departement:75"),
            ("select", "uai,taux_reu_total,taux_men_total"),
            ("limit", limit),
            ("offset", offset),
        ]
        url = f"{base}?{urlencode(payload)}"
        print(url)
        with urllib.request.urlopen(url) as resp:
            data = json.load(resp)
        batch = data["results"]
        results.extend(batch)
        offset += limit
        if len(batch) < limit:
            break
    return results


def merge_bac_results(schools):
    """Ajoute les taux de réussite et de mention au Bac pour les lycées.

    Fetches primary annee (BAC_ANNEE); falls back to BAC_ANNEE-1 for lycées missing
    from the primary dataset. Stores bac_annee per school.

    Args:
        schools (dict): keyed by UAI, modified in place.

    Returns:
        dict: same dict with txreussite/txmention/bac_annee added to lycée entries.
    """
    primary_records = _fetch_bac_records(BAC_ANNEE)
    primary_by_uai = {r["uai"]: r for r in primary_records if r.get("uai")}

    # Identify lycées needing fallback (those in schools but not in primary dataset)
    lycee_natures = {300, 301, 302, 306, 320}
    lycees_needing_fallback = [
        uai for uai, s in schools.items()
        if s.get("nature_uai") in lycee_natures
        and uai not in primary_by_uai
    ]

    fallback_by_uai = {}
    fb_annee = BAC_ANNEE - 1
    if lycees_needing_fallback:
        print(f"{len(lycees_needing_fallback)} lycées missing bac {BAC_ANNEE}, fetching {fb_annee}...")
        fallback_records = _fetch_bac_records(fb_annee)
        fallback_by_uai = {r["uai"]: r for r in fallback_records if r.get("uai")}

    matched = 0
    fallback_matched = 0
    for uai, school in schools.items():
        record = None
        annee = None
        if uai in primary_by_uai:
            record = primary_by_uai[uai]
            annee = BAC_ANNEE
            matched += 1
        elif uai in fallback_by_uai:
            record = fallback_by_uai[uai]
            annee = fb_annee
            fallback_matched += 1
            print(f"  [fallback bac] {uai} {school.get('nom')}")
        if record is not None:
            txr = record.get("taux_reu_total")
            txm = record.get("taux_men_total")
            if txr is not None:
                school["txreussite"] = round(float(txr), 1)
            if txm is not None:
                school["txmention"] = round(float(txm), 1)
            school["bac_annee"] = annee

    print(f"Merged Bac results for {matched} lycées ({fallback_matched} at {fb_annee} fallback)")
    return schools


HORS_SECTEUR_UAIS = ['0750654D', '0750655E', '0750685M']


def get_lycee_affectation():
    """Fetch lycée affectation data from ArcGIS FeatureServer (paginated).

    Returns:
        dict: { college_uai: { "1": [...], "2": [...], "3": [...] } }
    """
    base = (
        "https://services9.arcgis.com/ekT8MJFiVh8nvlV5/arcgis/rest/services/"
        "Affectation_Lyc%C3%A9es/FeatureServer/0/query"
        "?f=json&where=(Nom_tete+like+'%25')&outFields=*&returnGeometry=false&resultRecordCount=1000"
    )

    all_features = []
    offset = 0
    while True:
        url = f"{base}&resultOffset={offset}"
        print(f"Fetching lycée affectation: offset={offset}")
        with urllib.request.urlopen(url) as resp:
            data = json.load(resp)
        batch = data.get("features", [])
        all_features.extend(batch)
        if not data.get("exceededTransferLimit"):
            break
        offset += len(batch)

    print(f"Total ArcGIS features fetched: {len(all_features)}")

    affectation = {}
    for feature in all_features:
        attrs = feature.get("attributes", {})
        if attrs.get("type") != "LYC":
            continue
        college_uai = attrs.get("Réseau")
        lycee_uai = attrs.get("UAI")
        secteur = str(attrs.get("secteur", ""))
        if not college_uai or not lycee_uai or secteur not in ("1", "2", "3"):
            continue
        if college_uai not in affectation:
            affectation[college_uai] = {"1": [], "2": [], "3": []}
        if lycee_uai not in affectation[college_uai][secteur]:
            affectation[college_uai][secteur].append(lycee_uai)

    # Remove hors-secteur lycées from all regular sector assignments
    for sectors in affectation.values():
        for s in ('1', '2', '3'):
            sectors[s] = [u for u in sectors[s] if u not in HORS_SECTEUR_UAIS]

    affectation['hors_secteur'] = HORS_SECTEUR_UAIS

    print(f"Fetched affectation for {len(affectation)} colleges")
    return affectation


def write_lycee_affectation(affectation, path):
    """Écrit le dict d'affectation lycée au format JSON."""
    with open(path, "w", encoding="utf-8") as f:
        json.dump(affectation, f, ensure_ascii=False)
    print(f"Written lycee affectation for {len(affectation)} colleges to {path}")


def write_schools_data(schools, path):
    """Écrit le dict des écoles au format JSON.

    Args:
        schools (dict): keyed by UAI.
        path (str): chemin de sortie.
    """
    with open(path, "w", encoding="utf-8") as f:
        json.dump(schools, f, ensure_ascii=False)
    print(f"Written {len(schools)} schools to {path}")


def simplify_geoms_df(geoms, tolerance=3):
    """Simplification des géométries de `df`, en utilisant une marge de tolérance donnée.

    Args:
        geoms (gpd.GeoSeries): géométries à simplifier
        tolerance (float): borne max de distance entre les géométries d'origine et les géométries simplifiées,
            en mètres

    Returns:
        gpd.GeoSeries: géométries simplifiées
    """
    utm_crs = geoms.estimate_utm_crs()
    return geoms.to_crs(utm_crs).simplify(tolerance=tolerance).to_crs("EPSG:4326")


def limit_coordinate_precision(string):
    # Afin d'avoir des GeoJSON le plus légers possible, on conserve 5 chiffres après la virgule
    # sur les longitudes/latitudes, ce qui équivaut à ~1 mètre d'approximation selon
    # https://wiki.openstreetmap.org/wiki/Precision_of_coordinates,
    # ce qui est largement suffisant pour notre usage.
    return re.sub(r"(\.[0-9]{5})[0-9]+", r"\1", string)


def generate_geojson_college_sectors(id_projet, schools, path):
    """Génère un GeoJSON de secteurs scolaires de collèges (polygones uniquement).

    Chaque feature ne contient que la liste des UAI des établissements rattachés.
    Les couleurs sont calculées côté JS au chargement de la carte.

    Args:
        id_projet (str): filtre opendata.paris.fr, ex: `COLLEGES (année scolaire 2025/2026)`
        schools (dict): keyed by UAI (used only to warn on unmapped names)
        path (str): chemin de sortie GeoJSON
    """
    df_secto = get_paris_data_geojson(
        dataset="secteurs-scolaires-colleges",
        id_projet=id_projet,
    )
    df_secto["geometry"] = simplify_geoms_df(df_secto["geometry"])

    uai_mapping = load_uai_mapping()

    features = []
    for _, row in df_secto.iterrows():
        uais = []
        for i in [1, 2, 3, 4]:
            nom = row.get(f"lib_etab_{i}")
            if nom is None or (isinstance(nom, float) and pd.isna(nom)):
                continue
            uai = uai_mapping.get(str(nom).strip())
            if uai:
                uais.append(uai)
                if uai not in schools:
                    warnings.warn(f'UAI "{uai}" ({nom}) absent de schools_data')
            else:
                warnings.warn(f'Pas de code UAI pour "{nom}" dans uai_mapping.csv')

        if not uais:
            continue

        geom = row.geometry.__geo_interface__
        features.append({
            "type": "Feature",
            "properties": {"uais": uais},
            "geometry": geom,
        })

    geojson = {"type": "FeatureCollection", "features": features}
    json_str = limit_coordinate_precision(json.dumps(geojson))

    with open(path, "w", encoding="utf-8") as f:
        f.write(json_str)

    print(f"Written {len(features)} sector features to {path}")


def write_metadata(path):
    """Écrit les métadonnées du pipeline au format JSON."""
    metadata = {
        "secto_year": SECTO_YEAR.replace("/", "-"),
        "brevet_session": BREVET_SESSION,
        "bac_annee": BAC_ANNEE,
        "ips_rentree": IPS_RENTREE,
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
    }
    with open(path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, ensure_ascii=False, indent=2)
    print(f"Written metadata to {path}")


def print_run_summary(schools):
    """Affiche un résumé post-run des données de fallback par source."""
    # Brevet
    brevet_primary = [(uai, s) for uai, s in schools.items() if s.get("brevet_session") == BREVET_SESSION]
    brevet_fallback = [(uai, s) for uai, s in schools.items() if s.get("brevet_session") == BREVET_SESSION - 1]
    fb_brevet_str = ", ".join(f"{uai} {s.get('nom', '')}" for uai, s in brevet_fallback)
    print(f"Brevet: {len(brevet_primary)} schools at {BREVET_SESSION}, "
          f"{len(brevet_fallback)} at {BREVET_SESSION - 1} (fallback)"
          + (f": {fb_brevet_str}" if brevet_fallback else ""))

    # IPS
    ips_primary = [(uai, s) for uai, s in schools.items() if s.get("ips_rentree") == IPS_RENTREE]
    prev_rentree = _prev_ips_rentree(IPS_RENTREE)
    ips_fallback = [(uai, s) for uai, s in schools.items() if s.get("ips_rentree") == prev_rentree]
    print(f"IPS: {len(ips_primary)} schools at {IPS_RENTREE}, "
          f"{len(ips_fallback)} at {prev_rentree} (fallback)")

    # Bac
    bac_primary = [(uai, s) for uai, s in schools.items() if s.get("bac_annee") == BAC_ANNEE]
    bac_fallback = [(uai, s) for uai, s in schools.items() if s.get("bac_annee") == BAC_ANNEE - 1]
    fb_bac_str = ", ".join(f"{uai} {s.get('nom', '')}" for uai, s in bac_fallback)
    print(f"Bac: {len(bac_primary)} schools at {BAC_ANNEE}, "
          f"{len(bac_fallback)} at {BAC_ANNEE - 1} (fallback)"
          + (f": {fb_bac_str}" if bac_fallback else ""))


if __name__ == "__main__":
    data_dir = os.path.realpath(os.path.join(__file__, "..", "..", "data"))
    schools = get_all_paris_schools()
    schools = merge_brevet_results(schools)
    schools = merge_bac_results(schools)
    schools = merge_ips_colleges(schools)
    write_schools_data(
        schools,
        path=os.path.join(data_dir, "schools_data.json"),
    )
    write_metadata(
        path=os.path.join(data_dir, "metadata.json"),
    )
    print_run_summary(schools)
    generate_geojson_college_sectors(
        id_projet=f"COLLEGES (année scolaire {SECTO_YEAR})",
        schools=schools,
        path=os.path.join(data_dir, "colleges_sectors.geojson"),
    )
    lycee_affectation = get_lycee_affectation()
    write_lycee_affectation(
        lycee_affectation,
        path=os.path.join(data_dir, "lycee_affectation.json"),
    )
