export type Vehicle = {
  id: string;
  brand: string;
  model: string;
  plateNumber: string;
  color: string;
  photoUrl: string | null;
  annualTaxDue: string;
  stnkFiveYearDue: string;
  kirStatus: KirStatus;
  kirDue: string | null;
  createdAt: string;
};

export type VehicleInput = Omit<Vehicle, "createdAt">;

export type KirStatus = "active" | "missing" | "lost";

export type DocumentKind = "annualTax" | "stnkFiveYear" | "kir";

export type DocumentStatus = {
  level: "good" | "soon" | "overdue" | "unknown";
  daysLeft: number;
  label: string;
};

export type AlertItem = {
  vehicle: Vehicle;
  kind: DocumentKind;
  status: DocumentStatus;
  title: string;
};
