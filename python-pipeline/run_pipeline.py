import json
import os
import random
import re
from urllib.parse import urlencode

import geopandas as gpd
import pandas as pd
from colour import Color
from fuzzywuzzy import process
from scipy import stats
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

    dataset = "fr-en-dnb-par-etablissement"
    session = 2021
    secteur = "public"
    departement = "075"
    delimiter = ";"
    payload = [
        ("refine", f'session:"{session}"'),
        ("refine", f'secteur_d_enseignement:"{secteur.upper()}"'),
        ("refine", f'code_departement:"{departement}"'),
        ("use_labels", True),
        ("delimiter", delimiter),
    ]

    full_url = f"{base_url}/{dataset}/exports/csv?{urlencode(payload)}"
    print(full_url)

    return pd.read_csv(full_url, delimiter=delimiter)


class CollegeMatchingError(Exception):
    pass


def fuzzy_match_college(nom_paris, df_educnat):
    """Trouver le nom de collège s'approchant le plus de `nom_paris` parmis `df_educnat.nom`."""
    res = process.extractOne(nom_paris, df_educnat.nom, score_cutoff=90)
    try:
        nom_educnat = res[0]
        return df_educnat[df_educnat.nom == nom_educnat].iloc[0]["code"]
    except TypeError:
        raise CollegeMatchingError(
            f'Pas de collège correspondant à "{nom_paris}" dans le CSV de réussite au brevet'
        )


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


def merge_college_paris_educnat(df_paris, df_educnat):
    """Réalise la jointure entre les dataframes de la Ville de Paris et de l'Éducation Nationale.

    Le dataframe de la Ville de Paris contient les noms, adresses et géolocalisations des collèges.
    Le dataframe de l'Éducation Nationale contient les taux de réussite au brevet des collèges.

    Faute de mieux, la jointure est réalisée en faisant un fuzzy matching entre les noms des collèges
    présents dans les deux datasets.
    """
    df_educnat["nom"] = df_educnat.Patronyme.apply(clean_nom)
    df_paris["code"] = df_paris.nom.apply(clean_nom).apply(
        lambda x: fuzzy_match_college(x, df_educnat)
    )
    df_educnat.drop(columns=["nom"], inplace=True)
    merged = pd.merge(df_paris, df_educnat, on="code")
    return merged


def prepro_df_paris_etab(df):
    """Preprocessing de la dataframe d'établissements issue du dataset de la Ville de Paris."""
    df["code_postal"] = df["arr_insee"].apply(lambda x: str(x).replace("751", "750"))
    df["nom"] = df["libelle"]
    return df


def prepro_df_educnat(df):
    """Preprocessing de la dataframe issue du dataset de l'Éducation Nationale."""
    df["txreussite"] = round(100 * df["Admis"] / df["Presents"], ndigits=1)
    df["txmention"] = round(
        100 * (df["Admis"] - df["Admis sans mention"]) / df["Presents"], ndigits=1
    )

    df["code"] = df["Numero d'etablissement"]
    return df


def prepro_df_paris_secto(df_secto, df_etab):
    """Preprocessing de la dataframe de sectorisation de collèges issue du dataset de la Ville de Paris.

    Les secteurs scolaires peuvent être liés à plus d'un établissement (maximum 4). Pour cela, nous stockons
    dans la dataframe de sortie une liste d'établissements dans la colonne `etabs`.

    Les propriétés telles que taux de réussite et de mention au brevet pour un secteur scolaire sont la moyenne
    de ces propriétés pour tous les établissements qui y sont rattachés.
    """

    def _get_etabs(row_secto, df_etab):
        etabs = []
        for i in [1, 2, 3, 4]:
            nom = row_secto[f"lib_etab_{i}"]
            if nom != nom:  # C'est un NaN
                continue
            etab = df_etab[df_etab.nom == nom].iloc[0]
            etabs.append(etab)
        return etabs

    df_secto["etabs"] = ""
    for index, row_secto in df_secto.iterrows():
        etabs = _get_etabs(row_secto, df_etab)

        presents = 0
        admis = 0
        admis_no_mention = 0
        for etab in etabs:
            presents += etab["Presents"]
            admis += etab["Admis"]
            admis_no_mention += etab["Admis sans mention"]

        df_secto.loc[index, "txreussite"] = round(100 * admis / presents, ndigits=1)
        df_secto.loc[index, "txmention"] = round(
            100 * (admis - admis_no_mention) / presents, ndigits=1
        )

        # Utilisation de `df.at[]` au lieu de `df.loc[]` ici à cause d'un comportement obscur de pandas,
        # cf https://stackoverflow.com/a/71686858
        df_secto.at[index, "etabs"] = [
            {
                "nom": etab.nom,
                "adresse": etab.adresse,
                "code_postal": etab.code_postal,
                "lng": etab.geometry.x,
                "lat": etab.geometry.y,
                "txreussite": etab.txreussite,
                "txmention": etab.txmention,
            }
            for etab in etabs
        ]

    # Assignation d'une couleur en fonction des taux
    gradient = [el.get_hex() for el in Color("#FAEB6E").range_to("#1A2E38", 20)]

    def _taux_to_color(taux, taux_series):
        rank = stats.percentileofscore(taux_series, taux, kind="weak")
        color = gradient[int((rank - 0.001) / 5)]
        return color

    df_secto["colreussite"] = df_secto.txreussite.apply(
        lambda tx: _taux_to_color(tx, df_etab.txreussite)
    )
    df_secto["colmention"] = df_secto.txmention.apply(
        lambda tx: _taux_to_color(tx, df_etab.txmention)
    )

    zone_colors = [
        "#80b1d3",
        "#8dd3c7",
        "#b3de69",
        "#bc80bd",
        "#bebada",
        "#ccebc5",
        "#d9d9d9",
        "#fb8072",
        "#fccde5",
        "#fdb462",
        "#ffed6f",
        "#ffffb3",
    ]
    random.seed(1234)  # On fixe une seed afin d'avoir toujours le même résultat
    # Affectation aléatoire d'une couleur de la liste à chacune des zones
    df_secto["colzone"] = random.choices(zone_colors, k=len(df_secto))

    cols_to_keep = ["colzone", "colreussite", "colmention", "geometry", "etabs"]
    return df_secto[cols_to_keep]


def simplify_geoms_df(geoms, tolerance=3):
    """Simplification des géométries de `df`, en utilisant une marge de tolérance donnée.

    Args:
        geoms (gpd.GeoSeries): géométries à simplifier
        tolerance (float): borne max de distance entre les géométries d'origine et les géométries simplifiées,
            en mètres

    Returns:
        gpd.GeoSeries: géométries simplifiées
    """
    # La méthode `simplify` de `geopandas` prend en entrée un valeur de `tolerance` dont la valeur est interprétée
    # dans l'unité du système de coordonées des géométries passées.
    # Il est plus naturel pour nous de raisonner en mètres, mais par défaut les géométries passées sont dans un
    # système de coordonnées en degrés de longitude/latitude. Nous les convertissons donc d'abord dans la zone
    # UTM locale — qui est un système de coordonnées en mètres
    # cf https://en.wikipedia.org/wiki/Universal_Transverse_Mercator_coordinate_system — pour effectuer la
    # simplification, avant de les re-convertir en longitude/latitude (== EPSG:4326)
    utm_crs = geoms.estimate_utm_crs()
    return geoms.to_crs(utm_crs).simplify(tolerance=tolerance).to_crs("EPSG:4326")


def limit_coordinate_precision(string):
    # Afin d'avoir des GeoJSON le plus légers possible, on conserve 5 chiffres après la virgule
    # sur les longitudes/latitudes, ce qui équivaut à ~1 mètre d'approximation selon
    # https://wiki.openstreetmap.org/wiki/Precision_of_coordinates,
    # ce qui est largement suffisant pour notre usage.
    return re.sub(r"(\.[0-9]{5})[0-9]+", r"\1", string)


def generate_geojson_colleges(id_projet, path):
    df_paris_etab = get_paris_data_geojson(
        dataset="etablissements-scolaires-colleges",
        id_projet=id_projet,
    )
    df_paris_etab = prepro_df_paris_etab(df_paris_etab)

    df_educnat = get_colleges_reussite_brevet()
    df_educnat = prepro_df_educnat(df_educnat)

    df_etab = merge_college_paris_educnat(df_paris_etab, df_educnat)

    df_secto = get_paris_data_geojson(
        dataset="secteurs-scolaires-colleges",
        id_projet=id_projet,
    )
    df_secto["geometry"] = simplify_geoms_df(df_secto["geometry"])
    df_secto = prepro_df_paris_secto(df_secto, df_etab)

    cols_to_keep = [
        "nom",
        "adresse",
        "code_postal",
        "geometry",
        "txreussite",
        "txmention",
    ]
    df_etab = df_etab[cols_to_keep]

    # Idéalement, on aimerait utiliser `df_secto.to_file("myfile.geojson", COORDINATE_PRECISION=5)` directement
    # pour sauver la dataframe sous format GeoJSON avec un nombre maîtrisé de chiffres après la virgule
    # dans les coordonnées.
    # Mais `df_secto` a une colone `etabs` qui contient une liste, et cela n'est pas géré par le driver GeoJSON
    # de `geopandas`, cf https://github.com/geopandas/geopandas/issues/2113.
    # On passe donc par un `.to_json()`, puis on tronque les chiffres après la virgule en utilisant une regex.
    json_secto = json.loads(limit_coordinate_precision(df_secto.to_json()))

    json_etab = json.loads(limit_coordinate_precision(df_etab.to_json()))

    # On crée un GeoJSON contenant à la fois les établissements et les secteurs
    json_all_features = {
        "type": "FeatureCollection",
        "features": json_secto["features"] + json_etab["features"],
    }
    with open(path, "w") as f:
        json.dump(json_all_features, f)


if __name__ == "__main__":
    generate_geojson_colleges(
        id_projet="COLLEGES (année scolaire 2024/2025)",
        path=os.path.realpath(
            os.path.join(__file__, "..", "..", "data", "colleges.geojson")
        ),
    )
