import json
import os
import re
import urllib.request
import warnings
from urllib.parse import urlencode

import geopandas as gpd
import pandas as pd
from unidecode import unidecode


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


def get_colleges_reussite_brevet():
    """Récupérer le dataset de taux de réussite au brevet des collèges.

    Returns:
        pd.DataFrame
    """
    base_url = "https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/"

    dataset = "fr-en-indicateurs-valeur-ajoutee-colleges"
    session = 2024
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

    Args:
        schools (dict): keyed by UAI, modified in place.

    Returns:
        dict: same dict with txreussite/txmention added to college entries.
    """
    df_educnat = get_colleges_reussite_brevet()
    df_educnat = prepro_df_educnat(df_educnat)

    brevet_by_uai = (
        df_educnat.set_index("code")[["txreussite", "txmention"]]
        .to_dict("index")
    )

    for uai, school in schools.items():
        if uai in brevet_by_uai:
            school["txreussite"] = brevet_by_uai[uai]["txreussite"]
            school["txmention"] = brevet_by_uai[uai]["txmention"]

    return schools


def merge_ips_colleges(schools):
    """Ajoute l'indice de positionnement social (IPS) pour les collèges parisiens.

    Args:
        schools (dict): keyed by UAI, modified in place.

    Returns:
        dict: same dict with ips/ips_national/ips_academique added to college entries.
    """
    base = ("https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets"
            "/fr-en-ips-colleges-ap2023/records")

    results = []
    offset = 0
    limit = 100
    while True:
        payload = [
            ("refine", 'rentree_scolaire:"2024-2025"'),
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

    matched = 0
    for record in results:
        uai = record.get("uai")
        if not uai or uai not in schools:
            continue
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
        matched += 1

    print(f"Merged IPS for {matched} colleges")
    return schools


def merge_bac_results(schools):
    """Ajoute les taux de réussite et de mention au Bac pour les lycées.

    Args:
        schools (dict): keyed by UAI, modified in place.

    Returns:
        dict: same dict with txreussite/txmention added to lycée entries.
    """
    base = ("https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets"
            "/fr-en-indicateurs-de-resultat-des-lycees-gt_v2/records")

    results = []
    offset = 0
    limit = 100
    while True:
        payload = [
            ("refine", "annee:2024"),
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

    for record in results:
        uai = record.get("uai")
        if not uai or uai not in schools:
            continue
        txr = record.get("taux_reu_total")
        txm = record.get("taux_men_total")
        if txr is not None:
            schools[uai]["txreussite"] = round(float(txr), 1)
        if txm is not None:
            schools[uai]["txmention"] = round(float(txm), 1)

    print(f"Merged Bac results for {sum(1 for r in results if r.get('uai') in schools)} lycées")
    return schools


ELITE_LYCEE_UAIS = ['0750654D', '0750655E', '0750685M']


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

    # Prepend elite UAIs to every college's secteur 1 list (deduped)
    for sectors in affectation.values():
        sectors["1"] = list(dict.fromkeys(ELITE_LYCEE_UAIS + sectors["1"]))

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


if __name__ == "__main__":
    schools = get_all_paris_schools()
    schools = merge_brevet_results(schools)
    schools = merge_bac_results(schools)
    schools = merge_ips_colleges(schools)
    write_schools_data(
        schools,
        path=os.path.realpath(
            os.path.join(__file__, "..", "..", "data", "schools_data.json")
        ),
    )
    generate_geojson_college_sectors(
        id_projet="COLLEGES (année scolaire 2025/2026)",
        schools=schools,
        path=os.path.realpath(
            os.path.join(__file__, "..", "..", "data", "colleges_sectors.geojson")
        ),
    )
    lycee_affectation = get_lycee_affectation()
    write_lycee_affectation(
        lycee_affectation,
        path=os.path.realpath(
            os.path.join(__file__, "..", "..", "data", "lycee_affectation.json")
        ),
    )
