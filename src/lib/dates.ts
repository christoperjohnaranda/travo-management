import type { AlertItem, DocumentKind, DocumentStatus, Vehicle } from "@/lib/types";

export const todayInJakarta = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
};

export const daysUntil = (date: string | null) => {
  if (!date) return Number.POSITIVE_INFINITY;
  const due = Date.parse(`${date}T00:00:00Z`);
  const today = Date.parse(`${todayInJakarta()}T00:00:00Z`);
  return Math.round((due - today) / 86_400_000);
};

export const documentStatus = (date: string | null, warningDays: number): DocumentStatus => {
  if (!date) return { level: "unknown", daysLeft: Number.POSITIVE_INFINITY, label: "Tanggal belum diketahui" };
  const daysLeft = daysUntil(date);
  if (daysLeft < 0) {
    const late = Math.abs(daysLeft);
    return { level: "overdue", daysLeft, label: `Terlambat ${late} hari` };
  }
  if (daysLeft === 0) return { level: "soon", daysLeft, label: "Jatuh tempo hari ini" };
  if (daysLeft <= warningDays) {
    return { level: "soon", daysLeft, label: `Dalam ${daysLeft} hari` };
  }
  return { level: "good", daysLeft, label: "Aman" };
};

export const documentDate = (vehicle: Vehicle, kind: DocumentKind) => {
  if (kind === "annualTax") return vehicle.annualTaxDue;
  if (kind === "stnkFiveYear") return vehicle.stnkFiveYearDue;
  return vehicle.kirDue;
};

export const documentTitle = (kind: DocumentKind) => {
  if (kind === "annualTax") return "Pajak tahunan";
  if (kind === "stnkFiveYear") return "STNK 5 tahunan";
  return "KIR";
};

export const getVehicleAlerts = (vehicle: Vehicle): AlertItem[] => {
  const annualTaxKnown = vehicle.annualTaxStatus === "known" && Boolean(vehicle.annualTaxDue);
  const annualTaxAlert: AlertItem = {
    vehicle,
    kind: "annualTax",
    status: annualTaxKnown
      ? documentStatus(vehicle.annualTaxDue, 30)
      : {
          level: "unknown",
          daysLeft: Number.POSITIVE_INFINITY,
          label: "Tanggal pajak belum diketahui",
        },
    title: annualTaxKnown
      ? documentTitle("annualTax")
      : "Pajak tahunan · tanggal belum diketahui",
  };

  const stnkKnown = vehicle.stnkStatus === "active" && Boolean(vehicle.stnkFiveYearDue);
  const stnkAlert: AlertItem = {
    vehicle,
    kind: "stnkFiveYear",
    status: stnkKnown
      ? documentStatus(vehicle.stnkFiveYearDue, 30)
      : {
          level: "unknown",
          daysLeft: Number.POSITIVE_INFINITY,
          label: vehicle.stnkStatus === "lost" ? "STNK hilang" : "STNK belum ada",
        },
    title: stnkKnown
      ? documentTitle("stnkFiveYear")
      : vehicle.stnkStatus === "lost" ? "STNK hilang · perlu ditindaklanjuti" : "STNK belum ada · perlu diurus",
  };

  const kirKnown = vehicle.kirStatus === "active" && Boolean(vehicle.kirDue);
  const kirAlert: AlertItem = {
    vehicle,
    kind: "kir",
    status: kirKnown
      ? documentStatus(vehicle.kirDue, 7)
      : {
          level: "unknown",
          daysLeft: Number.POSITIVE_INFINITY,
          label: vehicle.kirStatus === "missing" ? "Belum memiliki KIR" : "Tanggal KIR tidak diketahui",
        },
    title: kirKnown
      ? documentTitle("kir")
      : vehicle.kirStatus === "missing" ? "KIR belum dimiliki" : "KIR hilang · verifikasi tanggal",
  };

  return [annualTaxAlert, stnkAlert, kirAlert]
    .filter((item) => item.status.level !== "good")
    .sort((a, b) => a.status.daysLeft - b.status.daysLeft);
};

export const formatDate = (date: string | null) => {
  if (!date) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
};

export const offsetDate = (offset: number) => {
  const base = new Date(`${todayInJakarta()}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() + offset);
  return base.toISOString().slice(0, 10);
};
