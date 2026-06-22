// Local (off-Replit) mode: no external object storage.
// Scans and fridge items store the resized image as a base64 data URL on
// the row itself, so this module is a no-op stub kept only because parts of
// the codebase import its types/symbols. The Google Cloud Storage client is
// NOT instantiated here — that would have failed off-Replit anyway.

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export class ObjectStorageService {
  // All methods are intentionally unimplemented; the local code paths no
  // longer call into them. They throw if invoked by accident so the breakage
  // is obvious in logs rather than silently returning bad data.
  getPublicObjectSearchPaths(): string[] {
    throw new Error("ObjectStorageService is disabled in local mode (DEV_AUTH=1).");
  }
  getPrivateObjectDir(): string {
    throw new Error("ObjectStorageService is disabled in local mode (DEV_AUTH=1).");
  }
  searchPublicObject(): Promise<null> {
    throw new Error("ObjectStorageService is disabled in local mode (DEV_AUTH=1).");
  }
  downloadObject(): Promise<Response> {
    throw new Error("ObjectStorageService is disabled in local mode (DEV_AUTH=1).");
  }
  getObjectEntityUploadURL(): Promise<string> {
    throw new Error("ObjectStorageService is disabled in local mode (DEV_AUTH=1).");
  }
  getObjectEntityFile(): Promise<never> {
    throw new Error("ObjectStorageService is disabled in local mode (DEV_AUTH=1).");
  }
  normalizeObjectEntityPath(rawPath: string): string {
    return rawPath;
  }
  trySetObjectEntityAclPolicy(rawPath: string): Promise<string> {
    return Promise.resolve(rawPath);
  }
  canAccessObjectEntity(): Promise<boolean> {
    return Promise.resolve(true);
  }
}
