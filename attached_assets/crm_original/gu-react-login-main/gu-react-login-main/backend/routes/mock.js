// backend/routes/mock.js
import express from "express";
import { authenticate } from "../middleware/auth.js"; // si quieres protegerlos con login
const router = express.Router();

// Datos de ejemplo (ajusta libremente)
const leads = [
  {
    id: 1,
    case_code: "HOU-001",
    address_line: "123 Main St",
    city: "Houston",
    state: "TX",
    zip: "77002",
    lat: 29.7605,
    lng: -95.3698,
    status: "NEW",
    color: "YELLOW",
    created_at: new Date().toISOString(),
    notes: "Needs inspection"
  },
  {
    id: 2,
    case_code: "HOU-002",
    address_line: "456 Oak Ave",
    city: "Houston",
    state: "TX",
    zip: "77005",
    lat: 29.7174,
    lng: -95.4281,
    status: "CONTACTED",
    color: "GREEN",
    created_at: new Date(Date.now() - 86400000).toISOString(),
    notes: "Potential client"
  },
  {
    id: 3,
    case_code: "HOU-003",
    address_line: "789 Pine Rd",
    city: "Houston",
    state: "TX",
    zip: "77007",
    lat: 29.7717,
    lng: -95.4107,
    status: "AWAITING_INSPECTION",
    color: "RED",
    created_at: new Date(Date.now() - 3*86400000).toISOString(),
    notes: "Missing docs"
  }
];

const routes = [
  { id: 1, name: "Route A", scheduled_on: "2025-10-10", created_at: new Date().toISOString() },
  { id: 2, name: "Route B", scheduled_on: "2025-10-11", created_at: new Date().toISOString() },
];

const appointments = [
  { id: 1, lead_id: 2, scheduled_at: "2025-10-12T10:00:00Z", attorney_id: null, notes: "Initial visit" },
];

// ✅ si quieres que requieran login, descomenta la siguiente línea
// router.use(authenticate);

// GET /api/mock/leads?q=&color=&status=&sort=&order=
router.get("/leads", (req, res) => {
  const { q = "", color, status, sort = "created_at", order = "desc" } = req.query;

  let data = [...leads];
  if (q) {
    const s = String(q).toLowerCase();
    data = data.filter(
      (L) =>
        L.address_line.toLowerCase().includes(s) ||
        L.city.toLowerCase().includes(s) ||
        String(L.zip || "").includes(s)
    );
  }
  if (color) data = data.filter((L) => L.color === color);
  if (status) data = data.filter((L) => L.status === status);

  const sortDir = String(order).toLowerCase() === "asc" ? 1 : -1;
  data.sort((a, b) => {
    const col = sort in a ? sort : "created_at";
    return (a[col] > b[col] ? 1 : -1) * sortDir;
  });

  res.json({ data, total: data.length, page: 1, limit: data.length });
});

router.get("/routes", (req, res) => {
  res.json({ data: routes });
});

router.get("/appointments", (req, res) => {
  res.json({ data: appointments });
});

export default router;
