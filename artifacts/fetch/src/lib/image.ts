export async function fileToResizedDataUrl(
  file: File,
  maxEdge = 1280,
  quality = 0.85,
): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error ?? new Error("Read failed"));
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("Image decode failed"));
    i.src = dataUrl;
  });
  const longest = Math.max(img.width, img.height);
  const scale = longest > maxEdge ? maxEdge / longest : 1;
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

export async function fileToResizedBlob(
  file: File,
  maxEdge = 1280,
  quality = 0.85,
): Promise<Blob> {
  const dataUrl = await fileToResizedDataUrl(file, maxEdge, quality);
  const resp = await fetch(dataUrl);
  return await resp.blob();
}

// In local mode the resized image is sent straight to the API as a data URL
// (no object storage). The server stores it on the row. This helper is a
// thin re-export of the data-URL variant so existing call sites keep working.
export async function uploadImageToObjectStorage(
  blob: Blob,
): Promise<string> {
  // Re-encode the blob back into a data URL — the original File path
  // already gave us a resized data URL; for callers that pass a Blob we
  // do the conversion here.
  return await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error ?? new Error("Read failed"));
    r.readAsDataURL(blob);
  });
}

// Back-compat: in the old Replit flow the response carried an
// `imageObjectPath`; in local mode we serve the `imageDataUrl` directly.
// If the row still has an object path, fall back to a data URL from the row.
export function objectPathToUrl(
  imageDataUrl: string | null | undefined,
): string | undefined {
  return imageDataUrl ?? undefined;
}
