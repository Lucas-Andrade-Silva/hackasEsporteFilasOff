"""Estruturas de dados por frame — única fonte de serialização (spec seção 14)."""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class Keypoint:
    name: str
    x: float
    y: float
    confidence: float
    estimated: bool = False   # True = preenchido por filtro/interpolação

    @property
    def detected(self) -> bool:
        return not self.estimated and self.confidence > 0.0


@dataclass
class TrackedAthlete:
    track_id: int
    bbox: tuple
    bbox_confidence: float
    pose: list = field(default_factory=list)


@dataclass
class FrameResult:
    frame: int
    timestamp: float
    sport: str
    athletes: list = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "frame": self.frame,
            "timestamp": self.timestamp,
            "sport": self.sport,
            "athletes": [
                {
                    "athlete_id": a.track_id,
                    "bbox": [float(v) for v in a.bbox],
                    "bbox_confidence": float(a.bbox_confidence),
                    "pose": {
                        k.name: {
                            "x": float(k.x), "y": float(k.y),
                            "confidence": float(k.confidence),
                            "estimated": bool(k.estimated),
                        } for k in a.pose
                    },
                } for a in self.athletes
            ],
        }
