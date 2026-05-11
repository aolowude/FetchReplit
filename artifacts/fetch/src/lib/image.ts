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

const API_BASE = `${import.meta.env.BASE_URL}api`;

export function objectPathToUrl(objectPath: string | null | undefined): string | undefined {
  if (!objectPath) return undefined;
  // objectPath looks like "/objects/uploads/uuid"; storage route is /api/storage/objects/<rest>
  const trimmed = objectPath.startsWith("/") ? objectPath.slice(1) : objectPath;
  return `${API_BASE}/storage/${trimmed}`;
}

export async function uploadImageToObjectStorage(
  blob: Blob,
  filename = "scan.jpg",
): Promise<string> {
  const requestRes = await fetch(`${API_BASE}/storage/uploads/request-url`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: filename,
      size: blob.size,
      contentType: blob.type || "image/jpeg",
    }),
  });
  if (!requestRes.ok) {
    throw new Error(`Failed to get upload URL (${requestRes.status})`);
  }
  const { uploadURL, objectPath } = (await requestRes.json()) as {
    uploadURL: string;
    objectPath: string;
  };
  const putRes = await fetch(uploadURL, {
    method: "PUT",
    headers: { "Content-Type": blob.type || "image/jpeg" },
    body: blob,
  });
  if (!putRes.ok) {
    throw new Error(`Upload failed (${putRes.status})`);
  }
  // Bind ownership ACL now that the object exists in storage.
  const finalizeRes = await fetch(`${API_BASE}/storage/uploads/finalize`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ objectPath }),
  });
  if (!finalizeRes.ok) {
    throw new Error(`Finalize failed (${finalizeRes.status})`);
  }
  const { objectPath: finalPath } = (await finalizeRes.json()) as { objectPath: string };
  return finalPath || objectPath;
}
