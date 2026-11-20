# Pose Engine (RF-DETR) Implementation Plan

> **For agentic workers:** steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pipeline de vídeo → detecção de atletas + pose (RF-DETR Keypoint) → tracking de IDs (ByteTrack) → vídeo anotado + JSONL, com CLI e Streamlit.

**Architecture:** `RFDETRKeypointPreview` entrega boxes+keypoints num único forward; ByteTrack mantém IDs; One Euro Filter suaviza keypoints e marca `estimated`. Abstrações `PoseEstimator`/`Tracker` permitem trocar modelos depois.

**Tech Stack:** Python 3.11, torch 2.11+cu128 (RTX 3050 6GB), rfdetr 1.12.x, supervision (ByteTrack + KeyPoints), opencv, numpy, streamlit, pytest.

**Spec:** `docs/superpowers/specs/2026-11-20-rfdetr-pose-design.md`

## Global Constraints

- Imports flat (`from core.schema import ...`) com `sys.path.insert(0, BASE_DIR)` nos entry points e conftest — convenção do `ball_engine`.
- Docstrings e comentários em português, como no `ball_engine`.
- Nenhuma métrica/dado sai sem ter sido calculado; `estimated=True` diferencia interpolado de detectado.
- `rfdetr` pinado em versão com ≥7 dias de release (1.12.1, de 12/11/2026).
- Testes rápidos não podem baixar pesos nem rodar o modelo real — RF-DETR é testado via stub de `model.predict` retornando `sv.KeyPoints` sintético.
- Não commitar: alterações pendentes do `ball_engine/` (pertocem a `teste/tracknet-bola`), vídeos, exports.

## Convenções

- `pose_engine/` na raiz do repo. Entry points: `pose_engine/run_pipeline.py` (CLI), `pose_engine/app.py` (Streamlit, rodar com `streamlit run pose_engine/app.py` da raiz).
- `pytest pose_engine/tests` da raiz do repo (conftest insere `pose_engine/` no sys.path).
- Saídas: `pose_engine/exports/<stem>_annotated.mp4` + `<stem>.jsonl`.

---

### Task 1: Scaffold + instalação + smoke do RF-DETR

**Files:**
- Create: `pose_engine/{__init__.py,requirements.txt}`, `pose_engine/{config,core,visualization,tests}/__init__.py` (onde couber), `pose_engine/data/videos/.gitkeep`, `pose_engine/exports/.gitkeep`, `pose_engine/tests/conftest.py`
- Modify: `.gitignore` (raiz) — adicionar `pose_engine/data/videos/*`, `pose_engine/exports/*` (mantendo `.gitkeep`), `pose_engine/models/`

**Passos:**

- [ ] Criar estrutura de diretórios e `.gitkeep`s.
- [ ] `pose_engine/requirements.txt`:

```
rfdetr==1.12.1
supervision>=0.24
opencv-python>=4.7
numpy>=1.24
scipy>=1.10
pandas>=2.0
streamlit>=1.30
plotly>=5.18
pytest>=7.0
```

- [ ] `pip install -r pose_engine/requirements.txt`. Se conflito de torch, reportar e ajustar pin.
- [ ] Smoke manual (script descartável em temp, não commita): `RFDETRKeypointPreview()` → baixa peso → `predict` numa imagem (gerar imagem sintética ou frame do vídeo do usuário se houver). Confirmar que retorna `sv.KeyPoints` com `.xy` `(N,17,2)` e `.confidence` `(N,17)`. **Registrar nesta sessão os atributos reais do objeto retornado** (se tem `.data` com boxes) — define a extração de bbox no Task 4.
- [ ] `tests/conftest.py`:

```python
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
```

- [ ] Atualizar `.gitignore` da raiz.
- [ ] Commit: `chore: scaffold pose_engine + deps (rfdetr 1.12.1)`

---

### Task 2: `config/settings.py`, `config/keypoints.py`, `core/schema.py`

**Files:**
- Create: `pose_engine/config/settings.py`, `pose_engine/config/keypoints.py`, `pose_engine/core/schema.py`
- Test: `pose_engine/tests/test_schema.py`

**Produces (interfaces):**
- `COCO_KEYPOINTS: list[str]` (17), `SKELETON_EDGES: list[tuple[str,str]]`, `COCO_INDEX: dict[str,int]`
- `settings`: `VIDEO_DIR`, `EXPORT_DIR`, `DETECTION_THRESHOLD`, `KEYPOINT_MIN_CONF`, `ONE_EURO_MIN_CUTOFF`, `ONE_EURO_BETA`, `MAX_LOST_FRAMES`, `SPORTS = ["volleyball", "basketball"]`
- `Keypoint(name, x, y, confidence, estimated)` + `.detected` property
- `TrackedAthlete(track_id, bbox, bbox_confidence, pose: list[Keypoint])`
- `FrameResult(frame, timestamp, sport, athletes)` + `.to_dict()`

- [ ] **RED** — `tests/test_schema.py`:

```python
from core.schema import Keypoint, TrackedAthlete, FrameResult

def test_keypoint_detected_vs_estimated():
    d = Keypoint("nose", 10.0, 20.0, 0.9, estimated=False)
    assert d.detected and not d.estimated
    e = Keypoint("nose", 11.0, 21.0, 0.3, estimated=True)
    assert e.estimated and not e.detected

def test_frame_result_to_dict_shape():
    kp = Keypoint("left_shoulder", 420.0, 180.0, 0.98)
    ath = TrackedAthlete(track_id=3, bbox=(1.0, 2.0, 3.0, 4.0),
                         bbox_confidence=0.97, pose=[kp])
    fr = FrameResult(frame=120, timestamp=4.0, sport="volleyball",
                     athletes=[ath])
    d = fr.to_dict()
    assert d["frame"] == 120 and d["timestamp"] == 4.0
    assert d["sport"] == "volleyball"
    a = d["athletes"][0]
    assert a["athlete_id"] == 3
    assert a["pose"]["left_shoulder"]["x"] == 420.0
    assert a["pose"]["left_shoulder"]["estimated"] is False

def test_frame_result_to_dict_is_json_serializable():
    import json
    kp = Keypoint("nose", 1.0, 2.0, 0.5)
    fr = FrameResult(0, 0.0, "basketball",
                     [TrackedAthlete(1, (0,0,1,1), 0.9, [kp])])
    json.dumps(fr.to_dict())  # não pode lançar exceção
```

- [ ] Rodar `pytest pose_engine/tests/test_schema.py -v` → FAIL (módulo não existe).
- [ ] **GREEN** — `config/keypoints.py`:

```python
"""Esquema COCO-17 e arestas do esqueleto (ordem usada pelo RF-DETR Keypoint)."""

COCO_KEYPOINTS = [
    "nose", "left_eye", "right_eye", "left_ear", "right_ear",
    "left_shoulder", "right_shoulder",
    "left_elbow", "right_elbow",
    "left_wrist", "right_wrist",
    "left_hip", "right_hip",
    "left_knee", "right_knee",
    "left_ankle", "right_ankle",
]
NUM_KEYPOINTS = len(COCO_KEYPOINTS)
COCO_INDEX = {name: i for i, name in enumerate(COCO_KEYPOINTS)}

SKELETON_EDGES = [
    ("nose", "left_eye"), ("left_eye", "left_ear"),
    ("nose", "right_eye"), ("right_eye", "right_ear"),
    ("left_shoulder", "right_shoulder"),
    ("left_shoulder", "left_elbow"), ("left_elbow", "left_wrist"),
    ("right_shoulder", "right_elbow"), ("right_elbow", "right_wrist"),
    ("left_shoulder", "left_hip"), ("right_shoulder", "right_hip"),
    ("left_hip", "right_hip"),
    ("left_hip", "left_knee"), ("left_knee", "left_ankle"),
    ("right_hip", "right_knee"), ("right_knee", "right_ankle"),
]
```

- [ ] `config/settings.py`:

```python
"""Caminhos e parâmetros do pose_engine."""
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "data"
VIDEO_DIR = DATA_DIR / "videos"
RESULTS_DIR = DATA_DIR / "results"
EXPORT_DIR = BASE_DIR / "exports"

DETECTION_THRESHOLD = 0.5      # confiança mínima da detecção de pessoa
KEYPOINT_MIN_CONF = 0.5        # abaixo disso o keypoint vira "estimated"
ONE_EURO_MIN_CUTOFF = 1.0      # Hz — suavização em repouso
ONE_EURO_BETA = 0.007          # resposta a movimento rápido
MAX_LOST_FRAMES = 30           # pruning de suavizadores de tracks ausentes

SPORTS = ["volleyball", "basketball"]

for _d in (VIDEO_DIR, RESULTS_DIR, EXPORT_DIR):
    _d.mkdir(parents=True, exist_ok=True)
```

- [ ] `core/schema.py`:

```python
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
```

- [ ] Rodar testes → PASS. Commit: `feat(pose_engine): schema de dados + config COCO-17`

---

### Task 3: `core/video_processor.py`

**Files:**
- Create: `pose_engine/core/video_processor.py`
- Test: `pose_engine/tests/test_video_processor.py`

**Produces:**
- `VideoMetadata(fps, width, height, frame_count, duration)`
- `probe(video_path) -> VideoMetadata` (levanta `ValueError` se não abre)
- `iter_frames(video_path, start_s=0.0, end_s=None) -> Iterator[(frame_idx, timestamp, bgr)]`

- [ ] **RED** — `tests/test_video_processor.py` (vídeo sintético via `cv2.VideoWriter` mp4v, 60 frames 320×240 @30fps, fixture em conftest):

```python
import cv2, numpy as np, pytest
from core.video_processor import probe, iter_frames

def test_probe_metadata(synth_video):
    m = probe(synth_video)
    assert m.frame_count == 60 and m.width == 320 and m.height == 240
    assert abs(m.fps - 30.0) < 0.5 and abs(m.duration - 2.0) < 0.1

def test_probe_invalid_path(tmp_path):
    with pytest.raises(ValueError):
        probe(tmp_path / "nao_existe.mp4")

def test_iter_frames_full(synth_video):
    frames = list(iter_frames(synth_video))
    assert len(frames) == 60
    idx, ts, img = frames[30]
    assert idx == 30 and abs(ts - 1.0) < 0.05 and img.shape == (240, 320, 3)

def test_iter_frames_trim(synth_video):
    frames = list(iter_frames(synth_video, start_s=1.0, end_s=1.5))
    idxs = [i for i, _, _ in frames]
    assert idxs[0] == 30 and idxs[-1] <= 45

def test_timestamps_monotonicos(synth_video):
    ts = [t for _, t, _ in iter_frames(synth_video)]
    assert all(b > a for a, b in zip(ts, ts[1:]))
```

- [ ] Fixture em `conftest.py` (gerar uma vez por sessão em tmp_path):

```python
import cv2, numpy as np, pytest

@pytest.fixture(scope="session")
def synth_video(tmp_path_factory):
    path = tmp_path_factory.mktemp("v") / "synth.mp4"
    w = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"mp4v"),
                        30.0, (320, 240))
    for i in range(60):
        img = np.full((240, 320, 3), 40, np.uint8)
        cv2.rectangle(img, (10 + i, 50), (40 + i, 150), (0, 255, 0), -1)
        cv2.rectangle(img, (250 - i, 60), (280 - i, 160), (255, 0, 0), -1)
        w.write(img)
    w.release()
    return path
```

- [ ] Rodar → FAIL. **GREEN** — `core/video_processor.py`:

```python
"""Leitura de vídeo: metadata e iteração frame a frame com timestamps."""
from __future__ import annotations
from dataclasses import dataclass
from pathlib import Path
import cv2


@dataclass
class VideoMetadata:
    fps: float
    width: int
    height: int
    frame_count: int
    duration: float


def probe(video_path) -> VideoMetadata:
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise ValueError(f"Não foi possível abrir o vídeo: {video_path}")
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    meta = VideoMetadata(
        fps=fps,
        width=int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)),
        height=int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)),
        frame_count=int(cap.get(cv2.CAP_PROP_FRAME_COUNT)),
        duration=0.0,
    )
    cap.release()
    meta.duration = meta.frame_count / meta.fps if meta.fps else 0.0
    return meta


def iter_frames(video_path, start_s=0.0, end_s=None):
    """Yields (frame_idx, timestamp_s, frame_bgr) no trecho [start_s, end_s]."""
    meta = probe(video_path)
    first = max(0, int(start_s * meta.fps))
    last = meta.frame_count if end_s is None else min(
        meta.frame_count, int(end_s * meta.fps) + 1)
    cap = cv2.VideoCapture(str(video_path))
    cap.set(cv2.CAP_PROP_POS_FRAMES, first)
    idx = first
    while idx < last:
        ok, frame = cap.read()
        if not ok:
            break
        yield idx, idx / meta.fps, frame
        idx += 1
    cap.release()
```

- [ ] Rodar → PASS. Commit: `feat(pose_engine): video_processor com probe e iter_frames`

---

### Task 4: `core/athlete_detector.py` — `PoseEstimator` ABC + `RFDETRPoseEstimator`

**Files:**
- Create: `pose_engine/core/athlete_detector.py`
- Test: `pose_engine/tests/test_detector.py`

**Consumes:** `config.keypoints.COCO_KEYPOINTS`, `settings.DETECTION_THRESHOLD`, `KEYPOINT_MIN_CONF`
**Produces:**
- `PoseDetection(bbox: np.ndarray shape(4), bbox_conf: float, xy: np.ndarray (17,2), conf: np.ndarray (17,))`
- `PoseEstimator` (ABC): `predict(frame_bgr) -> list[PoseDetection]`
- `RFDETRPoseEstimator(threshold, device)` implementando o ABC.

- [ ] **RED** — `tests/test_detector.py` com stub (não baixa modelo: injetar o objeto `model` fake cujo `.predict` retorna `sv.KeyPoints` sintético):

```python
import numpy as np, supervision as sv
from core.athlete_detector import PoseDetection, RFDETRPoseEstimator
from config.keypoints import NUM_KEYPOINTS


def _fake_keypoints():
    rng = np.random.default_rng(0)
    xy = rng.uniform(50, 200, size=(2, NUM_KEYPOINTS, 2)).astype(np.float32)
    conf = np.full((2, NUM_KEYPOINTS), 0.9, dtype=np.float32)
    conf[1, :5] = 0.1  # segundo atleta com 5 kpts fracos
    return sv.KeyPoints(xy=xy, confidence=conf)


class _FakeModel:
    def predict(self, img, threshold=0.5):
        return _fake_keypoints()


def _estimador_stub():
    est = RFDETRPoseEstimator.__new__(RFDETRPoseEstimator)
    est.threshold = 0.5
    est.keypoint_min_conf = 0.5
    est.model = _FakeModel()
    return est


def test_rfdetr_predict_maps_keypoints():
    est = _estimador_stub()
    frame = np.zeros((480, 640, 3), np.uint8)
    dets = est.predict(frame)
    assert len(dets) == 2
    d = dets[0]
    assert d.xy.shape == (NUM_KEYPOINTS, 2)
    assert d.conf.shape == (NUM_KEYPOINTS,)
    x1, y1, x2, y2 = d.bbox
    assert x2 > x1 and y2 > y1


def test_bbox_ignora_keypoints_fracos():
    est = _estimador_stub()
    dets = est.predict(np.zeros((480, 640, 3), np.uint8))
    d = dets[1]  # 5 primeiros kpts têm conf 0.1
    kps_bons = d.xy[d.conf >= est.keypoint_min_conf]
    assert d.bbox[0] >= kps_bons[:, 0].min() - 1e-6
    assert d.bbox[2] <= kps_bons[:, 0].max() + 1e-6
```

- [ ] Rodar → FAIL. **GREEN** — `core/athlete_detector.py`:

```python
"""Estimadores de pose. RFDETRKeypointPreview entrega boxes+keypoints por pessoa.

bbox é derivada da extensão dos keypoints com confiança suficiente (o objeto
sv.KeyPoints do rfdetr não expõe a caixa do detector diretamente).
"""
from __future__ import annotations
from abc import ABC, abstractmethod
from dataclasses import dataclass
import cv2
import numpy as np

from config.keypoints import NUM_KEYPOINTS
from config.settings import DETECTION_THRESHOLD, KEYPOINT_MIN_CONF


@dataclass
class PoseDetection:
    bbox: np.ndarray        # (4,) x1,y1,x2,y2
    bbox_conf: float
    xy: np.ndarray          # (K,2)
    conf: np.ndarray        # (K,)


class PoseEstimator(ABC):
    @abstractmethod
    def predict(self, frame_bgr) -> list:
        """Retorna list[PoseDetection] para um frame BGR."""


class RFDETRPoseEstimator(PoseEstimator):
    def __init__(self, threshold: float = DETECTION_THRESHOLD,
                 device: str | None = None):
        from rfdetr import RFDETRKeypointPreview
        self.threshold = threshold
        self.keypoint_min_conf = KEYPOINT_MIN_CONF
        kw = {} if device is None else {"device": device}
        self.model = RFDETRKeypointPreview(**kw)

    @staticmethod
    def _bbox_from_keypoints(xy, conf, min_conf):
        good = conf >= min_conf
        pts = xy[good] if good.any() else xy
        return np.array([pts[:, 0].min(), pts[:, 1].min(),
                         pts[:, 0].max(), pts[:, 1].max()], dtype=np.float32)

    def predict(self, frame_bgr) -> list:
        rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        kps = self.model.predict(rgb, threshold=self.threshold)
        out = []
        for i in range(len(kps.xy)):
            xy = np.asarray(kps.xy[i], dtype=np.float32)
            conf = np.asarray(kps.confidence[i], dtype=np.float32)
            out.append(PoseDetection(
                bbox=self._bbox_from_keypoints(xy, conf, self.keypoint_min_conf),
                bbox_conf=float(conf.max()) if conf.size else 0.0,
                xy=xy, conf=conf))
        return out
```

- [ ] Rodar → PASS. Commit: `feat(pose_engine): PoseEstimator ABC + wrapper RF-DETR Keypoint`

---

### Task 5: `core/keypoint_processor.py` — One Euro Filter + suavização por track

**Files:**
- Create: `pose_engine/core/keypoint_processor.py`
- Test: `pose_engine/tests/test_keypoint_processor.py`

**Consumes:** `schema.Keypoint`, settings `ONE_EURO_*`, `MAX_LOST_FRAMES`, `KEYPOINT_MIN_CONF`
**Produces:**
- `OneEuroFilter(min_cutoff, beta, d_cutoff)` com `__call__(x, dt) -> float` e `.updates`
- `KeypointProcessor()` com `process(track_id, kpts: list[Keypoint]) -> list[Keypoint]` e `prune(active_ids)`

- [ ] **RED** — testes:

```python
import numpy as np
from core.keypoint_processor import OneEuroFilter, KeypointProcessor
from core.schema import Keypoint


def test_one_euro_reduz_ruido():
    rng = np.random.default_rng(1)
    f = OneEuroFilter(min_cutoff=1.0, beta=0.007)
    t = np.linspace(0, 2, 60)
    sinal = np.sin(2 * np.pi * t)
    ruidoso = sinal + rng.normal(0, 0.1, sinal.shape)
    filtrado = [f(x, dt=1/30) for x in ruidoso]
    # erro médio do filtrado deve ser menor que o do ruidoso
    err_in = np.abs(ruidoso - sinal).mean()
    err_out = np.abs(np.array(filtrado) - sinal).mean()
    assert err_out < err_in


def test_processor_marca_estimated_quando_conf_baixa():
    p = KeypointProcessor()
    k_ok = [Keypoint("nose", 100, 100, 0.9)]
    p.process(1, k_ok); p.process(1, k_ok)  # cria histórico
    out = p.process(1, [Keypoint("nose", 300, 300, 0.1)])[0]
    assert out.estimated is True
    assert abs(out.x - 100) < 50  # puxado para o histórico, não para 300


def test_processor_conf_zero_sem_historico():
    p = KeypointProcessor()
    out = p.process(7, [Keypoint("nose", 50, 50, 0.1)])[0]
    assert out.estimated is True and out.confidence == 0.0


def test_processor_suaviza_mantendo_detected():
    p = KeypointProcessor()
    out = p.process(1, [Keypoint("nose", 100, 100, 0.95)])[0]
    assert out.detected and not out.estimated and out.confidence == 0.95
```

- [ ] Rodar → FAIL. **GREEN** — implementar `OneEuroFilter` (fórmula clássica: `cutoff = min_cutoff + beta*|dx/dt|`; `alpha = 1/(1 + tau/dt)`, `tau = 1/(2π·cutoff)`; derivada filtrada com `d_cutoff`) + `OneEuro2D` (x,y) + `KeypointProcessor` com `dict[track_id, dict[kpt_name, OneEuro2D]]`; regra: `conf >= KEYPOINT_MIN_CONF` → filtra e `estimated=False`; senão, se `updates >= 2` → usa estado do filtro, `estimated=True`, mantém conf original; sem histórico → `estimated=True`, `confidence=0.0`. `prune(active_ids)` remove suavizadores de tracks fora do conjunto ativo (chamado pela pipeline com os ids vistos nos últimos `MAX_LOST_FRAMES`).
- [ ] Rodar → PASS. Commit: `feat(pose_engine): suavização One Euro + flag estimated`

---

### Task 6: `core/athlete_tracker.py` — `Tracker` ABC + `ByteTrackTracker`

**Files:**
- Create: `pose_engine/core/athlete_tracker.py`
- Test: `pose_engine/tests/test_tracker.py`

**Consumes:** `PoseDetection` (Task 4)
**Produces:** `Tracker` ABC: `update(dets: list[PoseDetection]) -> list[tuple[int, PoseDetection]]`; `ByteTrackTracker(track_thresh, match_thresh, track_buffer)`; associação track→keypoints por IoU da box (version-proof, não depende de `Detections.data` sobreviver à filtragem).

- [ ] **RED** — testes:

```python
import numpy as np
from core.athlete_detector import PoseDetection
from core.athlete_tracker import ByteTrackTracker


def _det(cx, cy, w=40, h=100, conf=0.9):
    xy = np.stack([np.linspace(cx - w/2, cx + w/2, 17),
                   np.linspace(cy - h/2, cy + h/2, 17)], axis=1).astype(np.float32)
    return PoseDetection(bbox=np.array([cx-w/2, cy-h/2, cx+w/2, cy+h/2],
                                       dtype=np.float32),
                         bbox_conf=conf, xy=xy,
                         conf=np.full(17, 0.9, np.float32))


def test_ids_estaveis_em_movimento():
    trk = ByteTrackTracker()
    ids_a, ids_b = [], []
    for i in range(20):
        out = dict(trk.update([_det(100 + i*3, 200), _det(500 - i*3, 200)]))
        ids_a.append([t for t, d in out.items() if d.bbox[0] < 300][0])
        ids_b.append([t for t, d in out.items() if d.bbox[0] > 300][0])
    assert len(set(ids_a)) == 1 and len(set(ids_b)) == 1
    assert ids_a[0] != ids_b[0]


def test_id_sobrevive_a_oclusao_curta():
    trk = ByteTrackTracker()
    tid = None
    for i in range(40):
        dets = [_det(100 + i, 200)]
        if not (15 <= i < 20):  # some 5 frames (< track_buffer)
            dets.append(_det(500, 300))
        out = dict(trk.update(dets))
        parado = [t for t, d in out.items() if abs(d.bbox[0] - 480) < 40]
        if parado:
            if tid is None:
                tid = parado[0]
            elif i >= 20:
                assert parado[0] == tid
```

- [ ] Rodar → FAIL. **GREEN** — `core/athlete_tracker.py`:

```python
"""Rastreamento multi-objeto. ByteTrack via supervision; Tracker é ABC p/ troca futura."""
from __future__ import annotations
from abc import ABC, abstractmethod
import numpy as np
import supervision as sv


class Tracker(ABC):
    @abstractmethod
    def update(self, detections: list) -> list:
        """list[PoseDetection] -> list[(track_id, PoseDetection)]."""


def _iou(a, b):
    x1, y1 = max(a[0], b[0]), max(a[1], b[1])
    x2, y2 = min(a[2], b[2]), min(a[3], b[3])
    inter = max(0, x2 - x1) * max(0, y2 - y1)
    area = (a[2]-a[0])*(a[3]-a[1]) + (b[2]-b[0])*(b[3]-b[1]) - inter
    return inter / area if area > 0 else 0.0


class ByteTrackTracker(Tracker):
    def __init__(self, track_thresh=0.5, match_thresh=0.8, track_buffer=30):
        self._bt = sv.ByteTrack(track_activation_threshold=track_thresh,
                                lost_track_buffer=track_buffer,
                                minimum_matching_threshold=match_thresh)

    def update(self, detections: list) -> list:
        if not detections:
            self._bt.update_with_detections(sv.Detections.empty())
            return []
        sv_dets = sv.Detections(
            xyxy=np.stack([d.bbox for d in detections]),
            confidence=np.array([d.bbox_conf for d in detections]),
            class_id=np.zeros(len(detections), dtype=int))
        tracked = self._bt.update_with_detections(sv_dets)
        out = []
        for box, tid in zip(tracked.xyxy, tracked.tracker_id):
            i = int(np.argmax([_iou(box, d.bbox) for d in detections]))
            out.append((int(tid), detections[i]))
        return out
```

- [ ] Rodar → PASS (se `sv.ByteTrack` tiver assinatura diferente na versão instalada, ajustar kwargs conforme `inspect.signature`). Commit: `feat(pose_engine): Tracker ABC + ByteTrack com IDs estáveis`

---

### Task 7: `visualization/skeleton_overlay.py` + `core/pipeline.py`

**Files:**
- Create: `pose_engine/visualization/skeleton_overlay.py`, `pose_engine/core/pipeline.py`
- Test: `pose_engine/tests/test_pipeline.py`, `pose_engine/tests/test_overlay.py`

**Consumes:** tudo das tasks 2–6. **Produces:** `draw_frame(bgr, athletes) -> np.ndarray`; `run(video_path, sport, out_dir, start_s, end_s, estimator=None, tracker=None, progress_cb=None) -> dict`

- [ ] **RED** — `test_overlay.py`: `draw_frame` retorna mesmo shape e altera pixels; atleta com todos os kpts `estimated` ainda desenha (estilo diferente — basta não quebrar).
- [ ] **RED** — `test_pipeline.py` com `FakeEstimator` (2 pessoas movendo, keypoints = bastão sintético; pessoa 2 some frames 15–19; alguns kpts com conf baixa):

```python
def test_pipeline_synthetic_video(synth_video, tmp_path):
    est = _FakeEstimator()
    res = run(synth_video, "volleyball", tmp_path, estimator=est)
    assert res["frames"] == 60
    lines = res["jsonl_path"].read_text().strip().splitlines()
    assert len(lines) == 60
    import json
    rec = json.loads(lines[30])
    assert rec["frame"] == 30 and "athletes" in rec
    a = rec["athletes"][0]
    assert len(a["pose"]) == 17
    cap = cv2.VideoCapture(str(res["video_path"]))
    ok, _ = cap.read(); cap.release()
    assert ok
    ids = {a["athlete_id"] for l in lines[:15] for a in json.loads(l)["athletes"]}
    assert len(ids) == 2
```

- [ ] Rodar → FAIL. **GREEN**:
  - `skeleton_overlay.draw_frame`: bbox + `#{track_id}` (cv2.rectangle/putText), arestas `SKELETON_EDGES` (cor por confiança média das pontas; linha fina/tracejada se alguma `estimated`), vértices (fill menor se `estimated`).
  - `pipeline.run`: loop frame→`est.predict`→`trk.update`→`smoother.process(track_id, kpts)`→`FrameResult`→jsonl+overlay→`cv2.VideoWriter(mp4v, fps do probe)`. `kpts` montados via `COCO_KEYPOINTS[i]` + `d.xy[i]` + `d.conf[i]`. `progress_cb(frac)`. Retorna `{"jsonl_path", "video_path", "frames", "athletes_seen"}`. `prune` do smoother com ids ativos.
- [ ] Rodar → PASS. Commit: `feat(pose_engine): overlay de esqueleto + pipeline ponta-a-ponta`

---

### Task 8: Entry points — `run_pipeline.py` (CLI) + `app.py` (Streamlit)

**Files:**
- Create: `pose_engine/run_pipeline.py`, `pose_engine/app.py`

- [ ] `run_pipeline.py` — mesmo padrão do `ball_engine` (sys.path insert + argparse): `--video --sport {volleyball,basketball} --start --end --out --device`. Chama `pipeline.run` com `progress_cb` imprimindo `%` a cada 5%.
- [ ] `app.py` — `st.set_page_config`, upload → salva em `VIDEO_DIR`; `probe` mostra fps/resolução/duração; seletores esporte + trecho (slider 0–duration); botão "Processar" → `st.spinner` + `st.progress` via callback; exibe `st.video(annotated)`, `st.dataframe` com amostra do JSONL, `st.download_button` para JSONL e MP4. Estado em `st.session_state`. Lazy-load do `RFDETRPoseEstimator` (`@st.cache_resource`).
- [ ] Teste manual: `python pose_engine/run_pipeline.py --help`; `streamlit run pose_engine/app.py` abre sem erro (import check via `python -c "import pose_engine.app"` não rola por causa do streamlit — checar com `python -m py_compile`).
- [ ] Commit: `feat(pose_engine): CLI e interface Streamlit`

---

### Task 9: Validação com vídeo real + registro de limitações

- [ ] Usuário baixa um vídeo de vôlei/basquete → `pose_engine/data/videos/`.
- [ ] Rodar CLI no trecho curto (10–15s), GPU: checar detecções, IDs estáveis, esqueleto no corpo, JSONL com confianças.
- [ ] Anotar resultados e limitações observadas (IDs trocando, kpts falhando, fps de processamento) no final da spec ou em `pose_engine/README.md` curto.
- [ ] Commit final + resumo para o usuário.
