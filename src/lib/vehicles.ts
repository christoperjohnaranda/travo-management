import type { Vehicle } from "@/lib/types";
import { offsetDate } from "@/lib/dates";

const STORAGE_KEY = "travo-demo-vehicles-v1";

export const getDemoVehicles = (): Vehicle[] => [
  {
    id: "demo-1",
    brand: "Mitsubishi",
    model: "Fuso Fighter",
    plateNumber: "B 9123 TRV",
    color: "Putih",
    photoUrl: null,
    annualTaxDue: offsetDate(13),
    stnkFiveYearDue: offsetDate(142),
    kirStatus: "active",
    kirDue: offsetDate(5),
    createdAt: new Date().toISOString(),
  },
  {
    id: "demo-2",
    brand: "Hino",
    model: "Dutro 130 HD",
    plateNumber: "B 8472 TRV",
    color: "Hijau",
    photoUrl: null,
    annualTaxDue: offsetDate(78),
    stnkFiveYearDue: offsetDate(18),
    kirStatus: "active",
    kirDue: offsetDate(42),
    createdAt: new Date().toISOString(),
  },
  {
    id: "demo-3",
    brand: "Isuzu",
    model: "Elf NMR",
    plateNumber: "F 8031 TRV",
    color: "Putih",
    photoUrl: null,
    annualTaxDue: offsetDate(-3),
    stnkFiveYearDue: offsetDate(260),
    kirStatus: "active",
    kirDue: offsetDate(-2),
    createdAt: new Date().toISOString(),
  },
  {
    id: "demo-4",
    brand: "Toyota",
    model: "Dyna 130 HT",
    plateNumber: "B 7605 TRV",
    color: "Biru",
    photoUrl: null,
    annualTaxDue: offsetDate(114),
    stnkFiveYearDue: offsetDate(-9),
    kirStatus: "active",
    kirDue: offsetDate(96),
    createdAt: new Date().toISOString(),
  },
];

export const readDemoVehicles = () => {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      type StoredVehicle = Omit<Vehicle, "kirStatus" | "kirDue"> & { kirStatus?: Vehicle["kirStatus"]; kirDue?: string | null };
      const saved = JSON.parse(raw) as StoredVehicle[];
      return saved.map((vehicle) => ({
        ...vehicle,
        kirStatus: vehicle.kirStatus ?? (vehicle.kirDue ? "active" : "missing"),
        kirDue: vehicle.kirDue ?? null,
      }));
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }
  const initial = getDemoVehicles();
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
  return initial;
};

export const writeDemoVehicles = (vehicles: Vehicle[]) => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(vehicles));
};
