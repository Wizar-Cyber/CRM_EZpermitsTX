// middleware/roles.js
export function requireAdmin(req, res, next) {
  const u = req.user;
  if (!u) return res.status(401).json({ error: "Unauthorized" });

  // Verificar role_id === 1 O role === 'admin' O role_name === 'admin'
  const byRoleId = Number(u.role_id) === 1;
  const byRole = typeof u.role === "string" && u.role.toLowerCase() === "admin";
  const byRoleName = typeof u.role_name === "string" && u.role_name.toLowerCase() === "admin";

  if (byRoleId || byRole || byRoleName) {
    return next();
  }
  
  console.warn(`❌ Admin check failed for user ${u.id}: role_id=${u.role_id}, role=${u.role}, role_name=${u.role_name}`);
  return res.status(403).json({ error: "Admins only" });
}
