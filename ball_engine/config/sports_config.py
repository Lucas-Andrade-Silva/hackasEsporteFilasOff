"""Parâmetros por modalidade esportiva."""

SPORTS = {
    "volleyball": {
        "label": "Vôlei",
        # Faixas HSV usadas no fallback cor+forma (OpenCV H: 0-179)
        "hsv_ranges": [
            # amarelo (Mikasa V200W e similares)
            ((20, 100, 140), (38, 255, 255)),
            # branco/azul claro genérico: saturação baixa, valor alto
            ((0, 0, 200), (179, 60, 255)),
        ],
        "ball_area_frac": (0.00008, 0.004),  # fração min/max da área do frame
        "court": {"length_m": 18.0, "width_m": 9.0},
    },
    "basketball": {
        "label": "Basquete",
        "hsv_ranges": [
            # laranja da bola
            ((5, 120, 120), (20, 255, 255)),
        ],
        "ball_area_frac": (0.00015, 0.008),
        "court": {"length_m": 28.0, "width_m": 15.0},
    },
}

SPORT_KEYS = list(SPORTS.keys())
