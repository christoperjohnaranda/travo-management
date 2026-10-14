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
  const definitions: Array<{ kind: DocumentKind; days: number }> = [
    { kind: "annualTax", days: 30 },
    { kind: "stnkFiveYear", days: 30 },
  ];
  const documentAlerts = definitions
    .map(({ kind, days }) => ({
      vehicle,
      kind,
      status: documentStatus(documentDate(vehicle, kind), days),
      title: documentTitle(kind),
    }));

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

  return [...documentAlerts, kirAlert]
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
