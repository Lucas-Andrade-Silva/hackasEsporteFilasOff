"""Estruturas de dados do pipeline de rastreamento.

Regra central: posições detectadas nunca se misturam com posições
estimadas. Toda posição carrega `source` e `estimated`.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Optional

import pandas as pd

# Fontes de posição
SOURCE_TRACKNET = "tracknet"
SOURCE_YOLO = "yolo"
SOURCE_COLOR = "color_shape"
SOURCE_INPAINT = "inpaintnet"
SOURCE_INTERPOLATED = "interpolated"
SOURCE_NONE = "none"

DETECTED_SOURCES = {SOURCE_TRACKNET, SOURCE_YOLO, SOURCE_COLOR}
ESTIMATED_SOURCES = {SOURCE_INPAINT, SOURCE_INTERPOLATED}


@dataclass
class Detection:
    """Posição da bola em um frame."""
    x: Optional[float] = None
    y: Optional[float] = None
    confidence: float = 0.0
    visibility: bool = False
    source: str = SOURCE_NONE

    @property
    def estimated(self) -> bool:
        return self.source in ESTIMATED_SOURCES

    @property
    def detected(self) -> bool:
        return self.visibility and self.source in DETECTED_SOURCES

    def to_dict(self) -> dict:
        return {
            "x": self.x,
            "y": self.y,
            "confidence": round(self.confidence, 4),
            "visibility": self.visibility,
            "source": self.source,
            "estimated": self.estimated,
        }


@dataclass
class FrameRecord:
    """Registro estruturado de um frame processado."""
    frame: int
    timestamp: float
    ball: Detection = field(default_factory=Detection)
    physics: dict = field(default_factory=lambda: {
        "velocity": None, "acceleration": None, "curvature": None})
    event: dict = field(default_factory=lambda: {
        "type": None, "confidence": None})

    def to_dict(self) -> dict:
        return {
            "frame": self.frame,
            "timestamp": round(self.timestamp, 4),
            "ball": self.ball.to_dict(),
            "physics": self.physics,
            "event": self.event,
        }


@dataclass
class TrackingResult:
    """Resultado completo de uma análise."""
    video_path: str
    sport: str
    fps: float
    width: int
    height: int
    frame_count: int          # total de frames do vídeo
    processed_start: int      # primeiro frame processado
    records: list = field(default_factory=list)  # list[FrameRecord]
    meta: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "video": self.video_path,
            "sport": self.sport,
            "fps": self.fps,
            "resolution": {"width": self.width, "height": self.height},
            "frame_count": self.frame_count,
            "processed_start": self.processed_start,
            "meta": self.meta,
            "frames": [r.to_dict() for r in self.records],
        }

    def to_json(self, path: str | Path) -> Path:
        path = Path(path)
        path.write_text(json.dumps(self.to_dict(), ensure_ascii=False, indent=2),
                        encoding="utf-8")
        return path

    def to_dataframe(self) -> pd.DataFrame:
        rows = []
        for r in self.records:
            rows.append({
                "frame": r.frame,
                "timestamp": r.timestamp,
                "x": r.ball.x,
                "y": r.ball.y,
                "confidence": r.ball.confidence,
                "visibility": r.ball.visibility,
                "source": r.ball.source,
                "estimated": r.ball.estimated,
                "event_type": r.event.get("type"),
                "event_confidence": r.event.get("confidence"),
            })
        return pd.DataFrame(rows)

    def to_csv(self, path: str | Path) -> Path:
        path = Path(path)
        self.to_dataframe().to_csv(path, index=False)
        return path

    def stats(self) -> dict:
        n = len(self.records)
        det = sum(1 for r in self.records if r.ball.detected)
        est = sum(1 for r in self.records if r.ball.visibility and r.ball.estimated)
        by_source: dict = {}
        for r in self.records:
            if r.ball.visibility:
                by_source[r.ball.source] = by_source.get(r.ball.source, 0) + 1
        return {
            "frames_processados": n,
            "detectados": det,
            "estimados": est,
            "sem_posicao": n - det - est,
            "taxa_deteccao": round(det / n, 4) if n else 0.0,
            "por_fonte": by_source,
        }
