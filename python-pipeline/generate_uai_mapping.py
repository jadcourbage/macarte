"""Génère une première version du fichier de mapping nom_paris → UAI en utilisant du fuzzy matching.

Ce fichier est destiné à être relu et corrigé manuellement, puis utilisé par `run_pipeline.py`.

Usage:
    python generate_uai_mapping.py
"""

import pandas as pd
from fuzzywuzzy import process

from run_pipeline import (
    clean_nom,
    get_colleges_reussite_brevet,
    get_paris_data_geojson,
    prepro_df_educnat,
    prepro_df_paris_etab,
)

OUTPUT_PATH = "uai_mapping.csv"


def generate_mapping(id_projet):
    df_paris_etab = get_paris_data_geojson(
        dataset="etablissements-scolaires-colleges",
        id_projet=id_projet,
    )
    df_paris_etab = prepro_df_paris_etab(df_paris_etab)

    df_educnat = get_colleges_reussite_brevet()
    df_educnat = prepro_df_educnat(df_educnat)
    df_educnat["nom_clean"] = df_educnat.Patronyme.apply(clean_nom)

    rows = []
    for nom_paris in sorted(df_paris_etab.nom.unique()):
        nom_clean = clean_nom(nom_paris)
        res = process.extractOne(nom_clean, df_educnat.nom_clean)
        matched_clean, score = res[0], res[1]
        matched_row = df_educnat[df_educnat.nom_clean == matched_clean].iloc[0]

        rows.append(
            {
                "nom_paris": nom_paris,
                "uai": matched_row["code"],
                "nom_educnat": matched_row["Patronyme"],
                "score": score,
            }
        )

    df = pd.DataFrame(rows)
    df.to_csv(OUTPUT_PATH, index=False)
    print(f"Mapping écrit dans {OUTPUT_PATH} ({len(df)} lignes)")
    print(f"  - {df['uai'].astype(bool).sum()} correspondances trouvées")
    print(f"  - {(~df['uai'].astype(bool)).sum()} sans correspondance (à compléter manuellement)")


if __name__ == "__main__":
    generate_mapping(id_projet="COLLEGES (année scolaire 2025/2026)")
