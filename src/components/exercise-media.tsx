"use client";
import { frame, thumb, type Clip } from "@/lib/clips";

/** Imagem de card: um quadro real do vídeo; se o YouTube não tiver esse quadro, usa a capa. */
export function ClipFrame({ clip, alt = "", className = "" }: { clip: Clip; alt?: string; className?: string }) {
  return (
    <img className={`media-fill yt-frame ${className}`} src={frame(clip)} alt={alt} decoding="async"
      onLoad={e => { const img = e.currentTarget; if (img.naturalWidth <= 120 && !img.src.endsWith("hqdefault.jpg")) img.src = thumb(clip); }}
      onError={e => { const img = e.currentTarget; if (!img.src.endsWith("hqdefault.jpg")) img.src = thumb(clip); }} />
  );
}
