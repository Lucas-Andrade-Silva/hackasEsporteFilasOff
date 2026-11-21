"""Parâmetros por modalidade esportiva."""

SPORTS = {
    "volleyball": {
        "label": "Vôlei",
        # Faixas HSV usadas no fallback cor+forma (OpenCV H: 0-179)
        "hsv_ranges": [
            # amarelo (Mikasa V200W e similares)
            ((20, 100, 140), (38, 255, 255)),
            # Sem faixa "branco" (S<60, V>200): nos testes ela casava com
            # areia clara e lâmpadas (0/8 acertos na praia) e alimentava o
            # InpaintNet com pontos falsos.
        ],
        "ball_area_frac": (0.00008, 0.004),  # fração min/max da área do frame
        "court": {"length_m": 18.0, "width_m": 9.0},
        # Velocidade máxima plausível da bola na imagem, em diagonais do
        # frame por segundo (gate de outliers e raio de busca do fallback).
        # Generoso de propósito: saque/cortada em plano fechado.
        "max_speed_diag_s": 2.0,
    },
    "basketball": {
        "label": "Basquete",
        "hsv_ranges": [
            # laranja da bola
            ((5, 120, 120), (20, 255, 255)),
        ],
        "ball_area_frac": (0.00015, 0.008),
        "court": {"length_m": 28.0, "width_m": 15.0},
        "max_speed_diag_s": 1.5,
    },
}

SPORT_KEYS = list(SPORTS.keys())
