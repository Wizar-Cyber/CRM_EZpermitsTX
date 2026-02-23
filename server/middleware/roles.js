// middleware/roles.js
export function requireAdmin(req, res, next) {
  const u = req.user;
  if (!u) return res.status(401).json({ error: "Unauthorized" });

  const byRoleFlag = typeof u.role === "string" && u.role.toLowerCase() === "admin";
  const byRoleId = Number(u.role_id) === 1;

  if (byRoleFlag || byRoleId) return next();
  return res.status(403).json({ error: "Admins only" });
}
