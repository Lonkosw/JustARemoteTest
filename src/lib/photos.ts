import { db, newRowFields, touchedFields } from "./db";
import { supabase } from "./supabase";
import type { ProgressPhoto } from "./types";

// Progress photos. The image is resized in the browser, kept in IndexedDB
// (photo_files) and uploaded to the private "progress-photos" bucket by the
// sync engine. Other devices download it on first view.

export const PHOTO_BUCKET = "progress-photos";
export type Pose = NonNullable<ProgressPhoto["pose"]>;

export const POSE_LABELS: Record<Pose, string> = {
  front: "Frente",
  side: "Lado",
  back: "Costas",
  other: "Outra",
};

const FULL_SIZE = 1600;
const THUMB_SIZE = 400;

/** Scale an image so its longest side is at most `max` px, as JPEG. */
export async function resizeImage(file: Blob, max: number, quality = 0.85): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = new OffscreenCanvas(width, height);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return canvas.convertToBlob({ type: "image/jpeg", quality });
}

export function listPhotos(userId: string): Promise<ProgressPhoto[]> {
  return db.progress_photos
    .where("user_id")
    .equals(userId)
    .filter((p) => !p.deleted_at)
    .toArray()
    .then((rows) => rows.sort((a, b) => b.taken_on.localeCompare(a.taken_on) || b.created_at.localeCompare(a.created_at)));
}

export async function addPhoto(
  userId: string,
  file: Blob,
  values: { taken_on: string; pose: Pose },
): Promise<string> {
  const [full, thumb] = await Promise.all([resizeImage(file, FULL_SIZE), resizeImage(file, THUMB_SIZE, 0.8)]);
  const fields = newRowFields(userId);
  const photo: ProgressPhoto = {
    ...fields,
    taken_on: values.taken_on,
    pose: values.pose,
    storage_path: `${userId}/${fields.id}.jpg`,
  };
  await db.transaction("rw", db.progress_photos, db.photo_files, async () => {
    await db.photo_files.add({ id: photo.id, full, thumb, uploaded: 0 });
    await db.progress_photos.add(photo);
  });
  return photo.id;
}

export async function updatePhoto(id: string, values: Partial<Pick<ProgressPhoto, "taken_on" | "pose">>) {
  await db.progress_photos.update(id, { ...values, ...touchedFields() });
}

/** Soft delete the row (sync removes the stored file) and drop the local copy. */
export async function deletePhoto(id: string) {
  await db.transaction("rw", db.progress_photos, db.photo_files, async () => {
    await db.progress_photos.update(id, { deleted_at: new Date().toISOString(), ...touchedFields() });
    await db.photo_files.delete(id);
  });
}

const inflight = new Map<string, Promise<Blob | null>>();

/**
 * The image of a photo: the local copy, or (cloud mode) a download that is
 * then kept locally. Null when unavailable, e.g. offline on a new device.
 */
export function getPhotoBlob(photo: ProgressPhoto, size: "full" | "thumb"): Promise<Blob | null> {
  const key = `${photo.id}:${size}`;
  if (!inflight.has(key)) {
    inflight.set(
      key,
      loadPhotoBlob(photo, size).finally(() => inflight.delete(key)),
    );
  }
  return inflight.get(key)!;
}

async function loadPhotoBlob(photo: ProgressPhoto, size: "full" | "thumb"): Promise<Blob | null> {
  const local = await db.photo_files.get(photo.id);
  if (local) return local[size];
  if (!supabase) return null;

  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).download(photo.storage_path);
  if (error || !data) return null;
  const full = data.type === "image/jpeg" ? data : new Blob([data], { type: "image/jpeg" });
  const thumb = await resizeImage(full, THUMB_SIZE, 0.8).catch(() => full);
  // The row may have been deleted while downloading.
  if ((await db.progress_photos.get(photo.id))?.deleted_at) return null;
  await db.photo_files.put({ id: photo.id, full, thumb, uploaded: 1 });
  return size === "full" ? full : thumb;
}
