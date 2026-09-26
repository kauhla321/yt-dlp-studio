"use client";

import { Chip } from "./ui/primitives";
import { PlaylistIcon, VideoCamIcon } from "./ui/icons";
import { formatCount, formatDuration } from "@/lib/utils/format-bytes";
import type { MediaMetadata } from "@/types";

export function MetadataCard({
  meta,
  subtitleCount,
}: {
  meta: MediaMetadata;
  /** Only meaningful for kind === "video" (single video). */
  subtitleCount?: number;
}) {
  const isPlaylist = meta.kind === "playlist";

  return (
    <section aria-label={isPlaylist ? "playlist details" : "video details"} className="panel flex items-center gap-4 p-3.5">
      {isPlaylist ? (
        <div className="relative h-[99px] w-[176px] shrink-0">
          <div className="absolute inset-x-3.5 top-0 h-2 rounded-t-[8px] bg-surface-2" />
          <div className="absolute inset-x-1.5 top-1 h-2 rounded-t-[8px] bg-[#1a1a1a]" />
          <div className="absolute inset-x-0 bottom-0 top-2 flex items-center justify-center rounded-control bg-raised text-ink-dim">
            <PlaylistIcon className="h-[26px] w-[26px]" />
          </div>
        </div>
      ) : meta.thumbnail ? (
        <div className="relative h-[99px] w-[176px] shrink-0 overflow-hidden rounded-control">
          <img
            src={meta.thumbnail}
            alt={`Thumbnail for ${meta.title}`}
            className="h-full w-full object-cover"
            loading="lazy"
          />
          {meta.durationSeconds != null && (
            <span className="absolute bottom-1.5 right-1.5 rounded-[5px] bg-black/80 px-1.5 py-px text-[11px] text-white">
              {formatDuration(meta.durationSeconds)}
            </span>
          )}
        </div>
      ) : (
        <div className="relative flex h-[99px] w-[176px] shrink-0 items-center justify-center rounded-control bg-[#1c1c1c] text-ink-dim">
          <VideoCamIcon className="h-[26px] w-[26px]" />
          {meta.durationSeconds != null && (
            <span className="absolute bottom-1.5 right-1.5 rounded-[5px] bg-black/80 px-1.5 py-px text-[11px] text-white">
              {formatDuration(meta.durationSeconds)}
            </span>
          )}
        </div>
      )}

      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex gap-1.5">
          <Chip tone="inverted">{isPlaylist ? "playlist" : "single video"}</Chip>
          {isPlaylist && meta.playlistCount != null && (
            <Chip tone="neutral">{meta.playlistCount} items</Chip>
          )}
          {!isPlaylist && (subtitleCount ?? 0) > 0 && (
            <Chip tone="neutral">
              {subtitleCount} subtitle track{subtitleCount === 1 ? "" : "s"}
            </Chip>
          )}
        </div>

        <h2 className="line-clamp-2 text-[17px] font-semibold leading-snug text-ink">
          {meta.title}
        </h2>

        <div className="flex flex-wrap items-center gap-x-1.5 text-xs text-ink-muted">
          {meta.uploader && <span>{meta.uploader}</span>}
          {meta.uploader && (meta.durationSeconds != null || meta.viewCount != null || meta.uploadDate) && (
            <span>·</span>
          )}
          {!isPlaylist && meta.durationSeconds != null && <span>{formatDuration(meta.durationSeconds)}</span>}
          {!isPlaylist && meta.durationSeconds != null && (meta.viewCount != null || meta.uploadDate) && <span>·</span>}
          {meta.viewCount != null && <span>{formatCount(meta.viewCount)} views</span>}
          {meta.viewCount != null && meta.uploadDate && <span>·</span>}
          {meta.uploadDate && <span>{meta.uploadDate}</span>}
        </div>
      </div>
    </section>
  );
}
