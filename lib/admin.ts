export function isAdminFid(fid: number) {
  const adminFid = Number(process.env.ADMIN_FID || "0");
  return fid === adminFid;
}

export function isAdmin(fid: number) {
  return isAdminFid(fid);
}

export function requireAdmin(fid: number) {
  if (!isAdminFid(fid)) {
    throw new Error("Forbidden");
  }
}
