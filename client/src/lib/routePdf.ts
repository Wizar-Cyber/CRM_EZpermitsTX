import jsPDF from "jspdf";

type RoutePoint = {
  id?: string;
  address?: string;
  incident_address?: string;
  case_number?: string;
  lat?: number | string | null;
  lng?: number | string | null;
};

type RouteLeadLike = {
  case_number?: string;
  current_state?: string | null;
  incident_address?: string | null;
};

type ExportRoutePdfInput = {
  routeName: string;
  scheduledOn?: string;
  points: RoutePoint[];
  leads?: RouteLeadLike[];
  logoUrl?: string;
};

const toNumber = (value?: number | string | null) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const loadImageAsDataUrl = async (url: string): Promise<string | null> => {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

const buildQrImageUrl = (value: string) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=0&data=${encodeURIComponent(value)}`;

const buildGoogleMapsUrl = (points: RoutePoint[]) => {
  const withAddress = points.filter((p) => (p.address || p.incident_address || "").trim().length > 0);
  if (withAddress.length < 2) return null;

  const origin = encodeURIComponent(withAddress[0].address || withAddress[0].incident_address || "");
  const destination = encodeURIComponent(
    withAddress[withAddress.length - 1].address || withAddress[withAddress.length - 1].incident_address || ""
  );
  const waypoints = withAddress
    .slice(1, -1)
    .map((p) => encodeURIComponent(p.address || p.incident_address || ""))
    .join("|");

  let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
  if (waypoints) url += `&waypoints=${waypoints}`;
  return url;
};

export async function exportRoutePdf(input: ExportRoutePdfInput) {
  const {
    routeName,
    scheduledOn,
    points,
    leads = [],
    logoUrl = "/logo.png",
  } = input;

  const pdf = new jsPDF("landscape", undefined, "a4");
  const width = pdf.internal.pageSize.getWidth();
  const height = pdf.internal.pageSize.getHeight();
  const margin = 12;
  let y = margin;

  const logoDataUrl = await loadImageAsDataUrl(logoUrl);
  const mapsUrl = buildGoogleMapsUrl(points);
  const mapsQr = mapsUrl ? await loadImageAsDataUrl(buildQrImageUrl(mapsUrl)) : null;

  if (logoDataUrl) {
    try {
      pdf.addImage(logoDataUrl, "PNG", margin, y, 24, 24);
    } catch {
      // ignore logo rendering errors
    }
  }

  const qrSize = 18;
  const qrX = width - margin - qrSize;

  if (mapsQr) {
    try {
      pdf.addImage(mapsQr, "PNG", qrX, y, qrSize, qrSize);
      pdf.setFontSize(7);
      pdf.text("Google", qrX + 2.5, y + qrSize + 4);
    } catch {
      // ignore QR rendering errors
    }
  }

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.text("Route Report", margin + 30, y + 8);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(11);
  pdf.text(`Route: ${routeName}`, margin + 30, y + 15);
  pdf.text(`Generated: ${new Date().toLocaleString()}`, margin + 30, y + 21);
  y += 30;

  const leadStateMap = new Map<string, string>();
  leads.forEach((lead) => {
    if (lead.case_number) {
      leadStateMap.set(lead.case_number, lead.current_state || "N/A");
    }
  });

  const validCoords = points.filter((p) => toNumber(p.lat) !== null && toNumber(p.lng) !== null);
  pdf.setFillColor(245, 247, 250);
  pdf.roundedRect(margin, y, width - margin * 2, 18, 2, 2, "F");
  pdf.setFontSize(10);
  pdf.text(`Stops: ${points.length}`, margin + 4, y + 6);
  pdf.text(`With coordinates: ${validCoords.length}`, margin + 44, y + 6);
  pdf.text(`Scheduled: ${scheduledOn ? new Date(scheduledOn).toLocaleDateString() : "N/A"}`, margin + 90, y + 6);
  y += 24;

  if (mapsUrl) {
    pdf.setTextColor(30, 64, 175);
    pdf.textWithLink("Open route in Google Maps", margin, y, { url: mapsUrl });
    pdf.setTextColor(0, 0, 0);
    y += 8;
  }

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.text("#", margin, y);
  pdf.text("Address", margin + 12, y);
  pdf.text("State", width - margin - 38, y);
  pdf.line(margin, y + 2, width - margin, y + 2);
  y += 8;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);

  points.forEach((point, idx) => {
    if (y > height - margin) {
      pdf.addPage();
      y = margin;
    }

    const address = point.address || point.incident_address || "N/A";
    const state = point.case_number ? leadStateMap.get(point.case_number) || "N/A" : "N/A";

    pdf.text(String(idx + 1), margin, y);
    pdf.text(address, margin + 12, y, { maxWidth: width - margin * 2 - 56 });
    pdf.text(state, width - margin - 38, y);
    y += 6;
  });

  const safeName = routeName.replace(/[^a-zA-Z0-9-_ ]/g, "").trim() || "route";
  pdf.save(`${safeName}.pdf`);
}
