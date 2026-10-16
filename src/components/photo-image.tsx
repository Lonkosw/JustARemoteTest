"use client";

import { useEffect, useState } from "react";
import { getPhotoBlob } from "@/lib/photos";
import type { ProgressPhoto } from "@/lib/types";

/** Shows a progress photo from IndexedDB, downloading it first if needed. */
export function PhotoImage({
  photo,
  size,
  alt,
  className = "",
}: {
  photo: ProgressPhoto;
  size: "full" | "thumb";
  alt: string;
  className?: string;
}) {
  const [state, setState] = useState<{ id: string; url: string | null; failed: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;
    getPhotoBlob(photo, size).then((blob) => {
      if (cancelled) return;
      url = blob ? URL.createObjectURL(blob) : null;
      setState({ id: photo.id, url, failed: !blob });
    });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [photo, size]);

  const current = state?.id === photo.id ? state : null;
  if (current?.url) {
    // Object URLs from IndexedDB; next/image cannot optimize them.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={current.url} alt={alt} className={`object-cover ${className}`} />;
  }
  return (
    <div className={`flex items-center justify-center bg-surface-2 text-xs text-muted ${className}`} role="img" aria-label={alt}>
      {current?.failed ? "Indisponível offline" : ""}
    </div>
  );
}
