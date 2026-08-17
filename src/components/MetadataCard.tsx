"use client";

import { Badge } from "./ui/primitives";
import { CalendarIcon, ClockIcon, EyeIcon, ListVideoIcon, UserIcon } from "./ui/icons";
import { formatCount, formatDuration } from "@/lib/utils/format-bytes";
import type { MediaMetadata } from "@/types";

export function MetadataCard({ meta }: { meta: MediaMetadata }) {
  const isPlaylist = meta.kind === "playlist";
  return (
    <div className="panel animate-fade-in overflow-hidden">
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:p-5">
        {meta.thumbnail ? (
          <img
            src={meta.thumbnail}
            alt={`Thumbnail for ${meta.title}`}
            className="h-40 w-full rounded-xl object-cover sm:h-28 sm:w-48"
            loading="lazy"
          />
        ) : (
          <div className="flex h-40 w-full items-center justify-center rounded-xl bg-panel2 text-ink-faint sm:h-28 sm:w-48">
            <ListVideoIcon className="h-8 w-8" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-center gap-2">
            <Badge tone={isPlaylist ? "info" : "success"}>
              {isPlaylist ? "Playlist" : "Single video"}
            </Badge>
            {isPlaylist && meta.playlistCount != null && (
              <Badge tone="neutral">{meta.playlistCount} items</Badge>
            )}
          </div>

          <h2 className="line-clamp-2 text-lg font-semibold leading-snug text-ink">
            {meta.title}
          </h2>

          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-muted">
            {meta.uploader && (
              <span className="inline-flex items-center gap-1.5">
                <UserIcon className="h-3.5 w-3.5" /> {meta.uploader}
              </span>
            )}
            {meta.durationSeconds != null && (
              <span className="inline-flex items-center gap-1.5">
                <ClockIcon className="h-3.5 w-3.5" />
                {formatDuration(meta.durationSeconds)}
              </span>
            )}
            {meta.viewCount != null && (
              <span className="inline-flex items-center gap-1.5">
                <EyeIcon className="h-3.5 w-3.5" /> {formatCount(meta.viewCount)} views
              </span>
            )}
            {meta.uploadDate && (
              <span className="inline-flex items-center gap-1.5">
                <CalendarIcon className="h-3.5 w-3.5" /> {meta.uploadDate}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
