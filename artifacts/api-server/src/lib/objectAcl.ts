// Local (off-Replit) mode: object storage is disabled.
// Scans and fridge items store the resized image as a base64 data URL on
// the row itself. This stub keeps the enum available for any code that
// imports it (currently unused in local mode).

export enum ObjectPermission {
  READ = "read",
  WRITE = "write",
}

export enum ObjectAccessGroupType {}

export interface ObjectAccessGroup {
  type: ObjectAccessGroupType;
  id: string;
}

export interface ObjectAclRule {
  group: ObjectAccessGroup;
  permission: ObjectPermission;
}

export interface ObjectAclPolicy {
  owner: string;
  visibility: "public" | "private";
  aclRules?: ObjectAclRule[];
}

// No-ops in local mode. The scan/fridge routes no longer invoke these.
export async function setObjectAclPolicy(): Promise<void> {
  return;
}

export async function getObjectAclPolicy(): Promise<ObjectAclPolicy | null> {
  return null;
}

export async function canAccessObject({
  userId,
}: {
  userId?: string;
  requestedPermission: ObjectPermission;
}): Promise<boolean> {
  return Boolean(userId);
}
