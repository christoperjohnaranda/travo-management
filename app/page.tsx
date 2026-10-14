"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { documentDate, documentStatus, formatDate, getVehicleAlerts } from "@/lib/dates";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { readDemoVehicles, writeDemoVehicles } from "@/lib/vehicles";
import type { AnnualTaxStatus, DocumentKind, KirStatus, StnkStatus, Vehicle, VehicleInput } from "@/lib/types";

type DbVehicle = {
  id: string;
  brand: string;
  model: string;
  plate_number: string;
  color: string;
  photo_url: string | null;
  annual_tax_due: string | null;
  annual_tax_status: AnnualTaxStatus;
  stnk_five_year_due: string | null;
  stnk_status: StnkStatus;
  kir_status: KirStatus;
  kir_due: string | null;
  created_at: string;
};

const fromDb = (row: DbVehicle): Vehicle => ({
  id: row.id,
  brand: row.brand,
  model: row.model,
  plateNumber: row.plate_number,
  color: row.color,
  photoUrl: row.photo_url,
  annualTaxDue: row.annual_tax_due,
  annualTaxStatus: row.annual_tax_status ?? (row.annual_tax_due ? "known" : "unknown"),
  stnkFiveYearDue: row.stnk_five_year_due,
  stnkStatus: row.stnk_status ?? (row.stnk_five_year_due ? "active" : "missing"),
  kirStatus: row.kir_status,
  kirDue: row.kir_due,
  createdAt: row.created_at,
});

const toDb = (vehicle: Vehicle) => ({
  id: vehicle.id,
  brand: vehicle.brand,
  model: vehicle.model,
  plate_number: vehicle.plateNumber,
  color: vehicle.color,
  photo_url: vehicle.photoUrl,
  annual_tax_due: vehicle.annualTaxDue,
  annual_tax_status: vehicle.annualTaxStatus,
  stnk_five_year_due: vehicle.stnkFiveYearDue,
  stnk_status: vehicle.stnkStatus,
  kir_status: vehicle.kirStatus,
  kir_due: vehicle.kirDue,
});

const initials = (name: string) => name.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

function BrandMark() {
  return <Image src="/logogram.png" alt="" width={52} height={52} className="brand-logo" priority/>;
}

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true as const };
  const paths: Record<string, ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    truck: <><path d="M3 6h11v11H3z"/><path d="M14 10h4l3 3v4h-7z"/><circle cx="7.5" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></>,
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8"/></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    check: <><path d="m5 12 4 4L19 6"/></>,
    more: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
    close: <><path d="m18 6-12 12M6 6l12 12"/></>,
    upload: <><path d="M12 16V4m-4 4 4-4 4 4"/><path d="M20 16.5v2A1.5 1.5 0 0 1 18.5 20h-13A1.5 1.5 0 0 1 4 18.5v-2"/></>,
    logout: <><path d="M10 17l5-5-5-5M15 12H3"/><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6"/></>,
    edit: <><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/></>,
    trash: <><path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6"/></>,
    shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
  };
  return <svg {...common}>{paths[name] ?? paths.grid}</svg>;
}

function StatusPill({ date, warningDays, kind, annualTaxStatus, kirStatus, stnkStatus }: { date: string | null; warningDays: number; kind: DocumentKind; annualTaxStatus?: AnnualTaxStatus; kirStatus?: KirStatus; stnkStatus?: StnkStatus }) {
  const status = kind === "annualTax" && annualTaxStatus === "unknown"
    ? { level: "unknown" as const, daysLeft: Number.POSITIVE_INFINITY, label: "Tanggal pajak belum diketahui" }
    : kind === "kir" && kirStatus && kirStatus !== "active"
    ? { level: "unknown" as const, daysLeft: Number.POSITIVE_INFINITY, label: kirStatus === "missing" ? "Belum memiliki KIR" : "Tanggal tidak diketahui" }
    : kind === "stnkFiveYear" && stnkStatus && stnkStatus !== "active"
      ? { level: "unknown" as const, daysLeft: Number.POSITIVE_INFINITY, label: stnkStatus === "lost" ? "STNK hilang" : "STNK belum ada" }
    : documentStatus(date, warningDays);
  const icon = status.level === "good" ? "check" : status.level === "soon" ? "clock" : "bell";
  const label = kind === "kir" && status.level === "overdue" ? `URGENT · ${Math.abs(status.daysLeft)} hari` : status.label;
  return <span className={`status-pill status-${status.level}`}><Icon name={icon} size={14}/>{label}</span>;
}

function VehicleForm({ vehicle, onClose, onSave }: { vehicle: Vehicle | null; onClose: () => void; onSave: (data: VehicleInput, file: File | null) => Promise<void> }) {
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [preview, setPreview] = useState(vehicle?.photoUrl ?? "");
  const [clearPhoto, setClearPhoto] = useState(false);
  const [annualTaxStatus, setAnnualTaxStatus] = useState<AnnualTaxStatus>(vehicle ? vehicle.annualTaxStatus ?? (vehicle.annualTaxDue ? "known" : "unknown") : "known");
  const [annualTaxDue, setAnnualTaxDue] = useState(vehicle?.annualTaxDue ?? "");
  const [stnkStatus, setStnkStatus] = useState<StnkStatus>(vehicle ? vehicle.stnkStatus ?? (vehicle.stnkFiveYearDue ? "active" : "missing") : "active");
  const [stnkDue, setStnkDue] = useState(vehicle?.stnkFiveYearDue ?? "");
  const [kirStatus, setKirStatus] = useState<KirStatus>(vehicle?.kirStatus ?? (vehicle?.kirDue ? "active" : "missing"));
  const [kirDue, setKirDue] = useState(vehicle?.kirDue ?? "");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");
    setSaving(true);
    const form = new FormData(event.currentTarget);
    const file = (form.get("photo") as File | null) ?? null;
    try {
      await onSave({
        id: vehicle?.id ?? crypto.randomUUID(),
        brand: String(form.get("brand") ?? "").trim(),
        model: String(form.get("model") ?? "").trim(),
        plateNumber: String(form.get("plateNumber") ?? "").trim().toUpperCase(),
        color: String(form.get("color") ?? "").trim(),
        photoUrl: clearPhoto ? null : vehicle?.photoUrl ?? null,
        annualTaxDue: annualTaxStatus === "known" ? annualTaxDue : null,
        annualTaxStatus,
        stnkFiveYearDue: stnkStatus === "active" ? stnkDue : null,
        stnkStatus,
        kirStatus,
        kirDue: kirStatus === "active" ? kirDue : null,
      }, file && file.size > 0 ? file : null);
      onClose();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Data kendaraan gagal disimpan.");
    } finally {
      setSaving(false);
    }
  };

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="vehicle-modal" role="dialog" aria-modal="true" aria-labelledby="vehicle-form-title">
      <div className="modal-heading">
        <div><span className="eyebrow">DATA ARMADA</span><h2 id="vehicle-form-title">{vehicle ? "Perbarui kendaraan" : "Tambah kendaraan"}</h2><p>Lengkapi data kendaraan dan tanggal dokumennya.</p></div>
        <button className="icon-button" type="button" onClick={onClose} aria-label="Tutup"><Icon name="close"/></button>
      </div>
      <form onSubmit={submit}>
        <div className="form-section-label">Informasi kendaraan</div>
        <div className="form-grid">
          <label className="field"><span>Merk kendaraan <b>*</b></span><input name="brand" defaultValue={vehicle?.brand} required placeholder="Contoh: UD Truck"/><small>Bisa ketik merek baru secara manual.</small></label>
          <label className="field"><span>Tipe / model <b>*</b></span><input name="model" defaultValue={vehicle?.model} required placeholder="Contoh: Fuso Fighter"/></label>
          <label className="field"><span>Nomor polisi <b>*</b></span><input name="plateNumber" defaultValue={vehicle?.plateNumber} required placeholder="B 1234 TRV"/></label>
          <label className="field"><span>Warna <b>*</b></span><input name="color" defaultValue={vehicle?.color} required placeholder="Contoh: Putih"/></label>
        </div>
        <div className="photo-field">
          <div className="photo-preview">{preview && !clearPhoto ? <img src={preview} alt="Pratinjau foto kendaraan"/> : <Icon name="truck" size={25}/>}</div>
          <div className="photo-copy"><strong>Foto kendaraan <span>(opsional)</span></strong><small>JPG, PNG, atau WebP. {supabaseConfigured ? "Maksimal 5 MB." : "Mode demo maksimal 500 KB."}</small>
            <div className="photo-actions"><label className="upload-button"><Icon name="upload" size={16}/> Pilih foto<input name="photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; const limit = supabaseConfigured ? 5 * 1024 * 1024 : 500 * 1024; if (file.size > limit) { setFormError(`Ukuran foto maksimal ${supabaseConfigured ? "5 MB" : "500 KB"}.`); event.target.value = ""; return; } setFormError(""); setClearPhoto(false); setPreview(URL.createObjectURL(file)); }}/></label>{vehicle?.photoUrl && <button type="button" className="text-button" onClick={() => { setClearPhoto(true); setPreview(""); }}>Hapus foto</button>}</div>
          </div>
        </div>
        <div className="form-section-label document-section-label">Jadwal dokumen</div>
        <div className="form-grid date-grid">
          <label className="field"><span>Status tanggal pajak tahunan <b>*</b></span><select name="annualTaxStatus" value={annualTaxStatus} onChange={(event) => setAnnualTaxStatus(event.target.value as AnnualTaxStatus)}><option value="known">Tanggal diketahui</option><option value="unknown">Tanggal belum diketahui</option></select><small>Pilih belum diketahui jika dokumen pajak tidak tersedia.</small></label>
          {annualTaxStatus === "known" ? <label className="field"><span>Pajak tahunan berikutnya <b>*</b></span><input name="annualTaxDue" type="date" value={annualTaxDue} onChange={(event) => setAnnualTaxDue(event.target.value)} required/><small>Peringatan otomatis 30 hari sebelumnya.</small></label> : <div className="document-note"><strong>Tanggal pajak tahunan belum diketahui</strong><small>Kendaraan tetap bisa disimpan dan akan muncul sebagai pengingat untuk memeriksa tanggal pajaknya.</small></div>}
          <label className="field"><span>Status STNK 5 tahunan <b>*</b></span><select name="stnkStatus" value={stnkStatus} onChange={(event) => { const nextStatus = event.target.value as StnkStatus; setStnkStatus(nextStatus); if (nextStatus !== "active" && !annualTaxDue) setAnnualTaxStatus("unknown"); }}><option value="active">STNK tersedia dan tanggal diketahui</option><option value="lost">STNK hilang</option><option value="missing">STNK belum ada</option></select><small>Pilih kondisi dokumen STNK kendaraan.</small></label>
          {stnkStatus === "active" ? <label className="field"><span>Perpanjangan STNK 5 tahunan <b>*</b></span><input name="stnkFiveYearDue" type="date" value={stnkDue} onChange={(event) => setStnkDue(event.target.value)} required/><small>Termasuk penggantian pelat nomor.</small></label> : <div className="document-note"><strong>{stnkStatus === "lost" ? "STNK hilang perlu ditindaklanjuti" : "STNK belum ada"}</strong><small>{stnkStatus === "lost" ? "Data kendaraan tetap bisa disimpan. Tanggal tidak dihitung sampai STNK ditemukan atau jadwal diperbarui." : "Data kendaraan tetap bisa disimpan dan status ini akan muncul sebagai pengingat."}</small></div>}
          <label className="field"><span>Status KIR <b>*</b></span><select name="kirStatus" value={kirStatus} onChange={(event) => setKirStatus(event.target.value as KirStatus)}><option value="active">Ada KIR dan tanggal diketahui</option><option value="missing">Belum memiliki KIR</option><option value="lost">KIR hilang, tanggal tidak diketahui</option></select><small>Pilih sesuai kondisi dokumen kendaraan.</small></label>
          {kirStatus === "active" ? <label className="field"><span>Jatuh tempo KIR berikutnya <b>*</b></span><input name="kirDue" type="date" value={kirDue} onChange={(event) => setKirDue(event.target.value)} required/><small>Peringatan otomatis 7 hari sebelumnya.</small></label> : <div className="document-note"><strong>{kirStatus === "missing" ? "KIR perlu diurus" : "Tanggal KIR perlu diverifikasi"}</strong><small>{kirStatus === "missing" ? "Data kendaraan tetap bisa disimpan tanpa tanggal KIR." : "Jadwal KIR tidak diketahui, jadi sistem tidak akan menganggapnya sudah kedaluwarsa."}</small></div>}
        </div>
        {formError && <div className="form-error">{formError}</div>}
        <div className="modal-actions"><button type="button" className="button button-muted" onClick={onClose}>Batal</button><button type="submit" className="button button-primary" disabled={saving}>{saving ? "Menyimpan…" : vehicle ? "Simpan perubahan" : "Simpan kendaraan"}</button></div>
      </form>
    </section>
  </div>;
}

export default function Dashboard() {
  const router = useRouter();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLabel, setUserLabel] = useState("Operator Travo");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "attention">("all");
  const [brandFilter, setBrandFilter] = useState("all");
  const [error, setError] = useState("");

  const loadVehicles = useCallback(async () => {
    setError("");
    if (supabase) {
      const { data, error: queryError } = await supabase.from("vehicles").select("*").order("created_at", { ascending: false });
      if (queryError) throw new Error(queryError.message.includes("vehicles") ? "Tabel armada belum tersedia. Jalankan supabase/schema.sql di SQL Editor Supabase." : queryError.message);
      setVehicles((data as DbVehicle[]).map(fromDb));
      setError("");
    } else {
      setVehicles(readDemoVehicles());
    }
  }, []);

  useEffect(() => {
    let active = true;
    const init = async () => {
      if (supabase) {
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const searchParams = new URLSearchParams(window.location.search);
        const callbackType = hashParams.get("type") ?? searchParams.get("type");
        const callbackError = hashParams.get("error_code") ?? searchParams.get("error_code");
        if (callbackType === "invite" || callbackType === "recovery" || callbackError || hashParams.has("access_token")) {
          router.replace(`/login${window.location.search}${window.location.hash}`);
          return;
        }
        const { data: { session } } = await supabase.auth.getSession();
        if (!active) return;
        if (!session) { router.replace("/login"); return; }
        setUserLabel(session.user.email ?? "Pengguna Travo");
        try { await loadVehicles(); } catch (loadError) { if (active) setError(loadError instanceof Error ? loadError.message : "Gagal memuat armada."); }
        if (active) setLoading(false);
        return;
      }
      if (!window.localStorage.getItem("travo-demo-session")) { router.replace("/login"); return; }
      setUserLabel("Mode demo");
      try { await loadVehicles(); } catch (loadError) { if (active) setError(loadError instanceof Error ? loadError.message : "Gagal memuat armada."); }
      if (active) setLoading(false);
    };
    const initTimeout = window.setTimeout(() => {
      if (active) {
        setError("Dashboard terlalu lama memuat data dari Supabase. Periksa koneksi internet dan status project Supabase, lalu coba muat ulang.");
        setLoading(false);
      }
    }, 15_000);
    void init().catch((initError) => {
      if (!active) return;
      setError(initError instanceof Error ? initError.message : "Dashboard gagal dimuat. Coba muat ulang halaman.");
      setLoading(false);
    }).finally(() => window.clearTimeout(initTimeout));
    const subscription = supabase?.auth.onAuthStateChange((event) => { if (event === "SIGNED_OUT") router.replace("/login"); }).data.subscription;
    return () => { active = false; window.clearTimeout(initTimeout); subscription?.unsubscribe(); };
  }, [loadVehicles, router]);

  const alerts = useMemo(() => vehicles.flatMap(getVehicleAlerts).sort((a, b) => a.status.daysLeft - b.status.daysLeft), [vehicles]);
  const overdueCount = alerts.filter((item) => item.status.level === "overdue").length;
  const attentionCount = alerts.filter((item) => item.status.level === "soon" || item.status.level === "unknown").length;
  const brandOptions = useMemo(() => {
    const options = new Map<string, string>();
    for (const vehicle of vehicles) {
      const label = vehicle.brand.trim();
      const value = label.toLocaleLowerCase("id-ID");
      if (value && !options.has(value)) options.set(value, label);
    }
    return Array.from(options, ([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "id-ID"));
  }, [vehicles]);
  useEffect(() => {
    if (brandFilter !== "all" && !brandOptions.some((brand) => brand.value === brandFilter)) setBrandFilter("all");
  }, [brandFilter, brandOptions]);
  const brandVehicles = useMemo(() => vehicles.filter((vehicle) =>
    brandFilter === "all" || vehicle.brand.trim().toLocaleLowerCase("id-ID") === brandFilter
  ), [vehicles, brandFilter]);
  const attentionByBrand = brandVehicles.filter((vehicle) => getVehicleAlerts(vehicle).length > 0).length;
  const filteredVehicles = useMemo(() => brandVehicles.filter((vehicle) => {
    const matchesSearch = `${vehicle.brand} ${vehicle.model} ${vehicle.plateNumber}`.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === "all" || getVehicleAlerts(vehicle).length > 0;
    return matchesSearch && matchesFilter;
  }), [brandVehicles, search, filter]);

  const saveVehicle = async (input: VehicleInput, file: File | null) => {
    let photoUrl = input.photoUrl;
    if (file) {
      if (supabase) {
        const { error: uploadError } = await supabase.storage.from("vehicle-photos").upload(`${input.id}/photo`, file, { upsert: true, contentType: file.type });
        if (uploadError) throw new Error(`Foto gagal diunggah: ${uploadError.message}`);
        photoUrl = supabase.storage.from("vehicle-photos").getPublicUrl(`${input.id}/photo`).data.publicUrl;
      } else {
        photoUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error("Foto gagal dibaca."));
          reader.readAsDataURL(file);
        });
      }
    }
    const saved: Vehicle = { ...input, photoUrl, createdAt: editing?.createdAt ?? new Date().toISOString() };
    if (supabase) {
      const { error: saveError } = await supabase.from("vehicles").upsert(toDb(saved));
      if (saveError) throw new Error(`Data gagal disimpan: ${saveError.message}`);
      await loadVehicles();
    } else {
      const next = editing ? vehicles.map((item) => item.id === saved.id ? saved : item) : [saved, ...vehicles];
      setVehicles(next);
      writeDemoVehicles(next);
    }
    setModalOpen(false);
    setEditing(null);
  };

  const deleteVehicle = async (vehicle: Vehicle) => {
    if (!window.confirm(`Hapus ${vehicle.plateNumber} dari daftar armada?`)) return;
    if (supabase) {
      const { error: deleteError } = await supabase.from("vehicles").delete().eq("id", vehicle.id);
      if (deleteError) { setError(`Kendaraan gagal dihapus: ${deleteError.message}`); return; }
      await supabase.storage.from("vehicle-photos").remove([`${vehicle.id}/photo`]);
      await loadVehicles();
    } else {
      const next = vehicles.filter((item) => item.id !== vehicle.id);
      setVehicles(next);
      writeDemoVehicles(next);
    }
  };

  const signOut = async () => {
    if (supabase) await supabase.auth.signOut();
    else window.localStorage.removeItem("travo-demo-session");
    router.replace("/login");
  };

  if (loading) return <main className="loading-screen"><BrandMark/><span>Menyiapkan dashboard…</span></main>;

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand-lockup" href="#overview"><BrandMark/><span className="brand-name">travo<span>LOGISTICS</span></span></a>
      <div className="workspace-switch"><span className="workspace-icon">TL</span><span><strong>Travo Logistics</strong><small>Fleet workspace</small></span><span className="switch-chevron">⌄</span></div>
      <div className="side-label">MENU UTAMA</div>
      <nav className="side-nav" aria-label="Menu utama">
        <a className="nav-link active" href="#overview"><Icon name="grid"/><span>Ringkasan</span></a>
        <a className="nav-link" href="#fleet"><Icon name="truck"/><span>Daftar armada</span><span className="nav-count">{vehicles.length}</span></a>
        <a className="nav-link" href="#alerts"><Icon name="file"/><span>Dokumen & jadwal</span>{alerts.length > 0 && <span className="nav-alert-count">{alerts.length}</span>}</a>
      </nav>
      <div className="sidebar-bottom"><div className="support-card"><div className="support-icon"><Icon name="shield" size={18}/></div><strong>Dokumen lebih teratur</strong><p>Pantau masa berlaku dokumen armada dari satu tempat.</p><a href="#alerts">Lihat pengingat <Icon name="arrow" size={14}/></a></div><div className="sidebar-foot"><span className="online-dot"/> Semua sistem berjalan</div></div>
    </aside>

    <main className="main-content" id="overview">
      <header className="topbar"><div className="breadcrumb"><span>Workspace</span><b>/</b><strong>Ringkasan</strong></div><div className="topbar-actions"><span className="today-label"><Icon name="calendar" size={16}/>{new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: "Asia/Jakarta" }).format(new Date())}</span><span className="topbar-divider"/><button className="notification-button" type="button" onClick={() => document.getElementById("alerts")?.scrollIntoView({ behavior: "smooth" })} aria-label={`${alerts.length} pengingat`}><Icon name="bell"/>{alerts.length > 0 && <i/>}</button><div className="profile"><span className="profile-avatar">{initials(userLabel)}</span><span className="profile-copy"><strong>{userLabel === "Mode demo" ? "Mode demo" : userLabel.split("@")[0]}</strong><small>{supabase ? "Pengguna Travo" : "Data tersimpan lokal"}</small></span><button className="icon-button sign-out" type="button" title="Keluar" onClick={signOut}><Icon name="logout" size={17}/></button></div></div></header>

      <div className="page-wrap">
        {!supabaseConfigured && <div className="demo-banner"><span className="demo-dot"/><span><strong>Mode demo aktif.</strong> Data tersimpan di browser ini. Hubungkan Supabase untuk login dan penyimpanan bersama.</span><span className="demo-banner-hint">Petunjuk: README.md</span></div>}
        <section className="welcome-row"><div><span className="eyebrow">TRAVO FLEET MANAGEMENT</span><h1>Selamat datang kembali<span className="greeting-dot">.</span></h1><p>Pantau kondisi armada dan jadwal dokumen kendaraan Anda.</p></div><button className="button button-primary add-button" onClick={() => { setEditing(null); setModalOpen(true); }}><Icon name="plus" size={18}/> Tambah kendaraan</button></section>

        {error && <div className="error-banner"><span>{error}</span><button type="button" className="text-button" onClick={() => void loadVehicles()}>Coba lagi</button></div>}

        <section className="stats-grid" aria-label="Ringkasan armada">
          <article className="stat-card"><div className="stat-top"><span className="stat-icon stat-icon-blue"><Icon name="truck"/></span><span className="stat-caption">TOTAL TERDAFTAR</span></div><div className="stat-value-row"><strong>{vehicles.length.toString().padStart(2, "0")}</strong><span className="stat-context">unit kendaraan</span></div><div className="stat-foot"><span className="stat-foot-dot blue-dot"/> Armada aktif dalam pengelolaan</div></article>
          <article className="stat-card"><div className="stat-top"><span className="stat-icon stat-icon-amber"><Icon name="clock"/></span><span className="stat-caption">PERLU DITINDAKLANJUTI</span></div><div className="stat-value-row"><strong>{attentionCount.toString().padStart(2, "0")}</strong><span className="stat-context">dokumen perlu diperhatikan</span></div><div className="stat-foot"><span className="stat-foot-dot amber-dot"/> Jatuh tempo dekat atau tanggal/status dokumen belum lengkap</div></article>
          <article className="stat-card"><div className="stat-top"><span className="stat-icon stat-icon-red"><Icon name="bell"/></span><span className="stat-caption">SUDAH TERLAMBAT</span></div><div className="stat-value-row"><strong>{overdueCount.toString().padStart(2, "0")}</strong><span className="stat-context">dokumen kedaluwarsa</span></div><div className="stat-foot"><span className="stat-foot-dot red-dot"/> Perlu tindak lanjut segera</div></article>
        </section>

        <section className="content-grid">
          <div className="fleet-panel panel" id="fleet">
            <div className="panel-heading fleet-heading"><div><h2>Daftar armada</h2><p>Data kendaraan dan masa berlaku dokumen</p></div><button className="button button-outline compact-add" onClick={() => { setEditing(null); setModalOpen(true); }}><Icon name="plus" size={16}/> Kendaraan</button></div>
            <div className="table-toolbar">
              <div className="search-box"><Icon name="search" size={18}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nomor polisi atau kendaraan…" aria-label="Cari kendaraan"/><kbd>⌘ K</kbd></div>
              <div className="table-controls">
                <label className="brand-filter"><span>Merek</span><select aria-label="Filter berdasarkan merek" value={brandFilter} onChange={(event) => setBrandFilter(event.target.value)}><option value="all">Semua merek</option>{brandOptions.map((brand) => <option key={brand.value} value={brand.value}>{brand.label}</option>)}</select></label>
                <div className="filter-tabs"><button className={filter === "all" ? "filter-tab selected" : "filter-tab"} onClick={() => setFilter("all")}>Semua <span>{brandVehicles.length}</span></button><button className={filter === "attention" ? "filter-tab selected" : "filter-tab"} onClick={() => setFilter("attention")}>Perlu perhatian <span>{attentionByBrand}</span></button></div>
              </div>
            </div>
            <div className="table-scroll"><table><thead><tr><th>KENDARAAN</th><th>PAJAK TAHUNAN</th><th>STNK 5 TAHUNAN</th><th>KIR</th><th aria-label="Aksi"/></tr></thead><tbody>
              {filteredVehicles.map((vehicle) => <tr key={vehicle.id}>
                <td><div className="vehicle-cell"><div className="vehicle-thumb">{vehicle.photoUrl ? <img src={vehicle.photoUrl} alt=""/> : <Icon name="truck" size={20}/>}</div><div><strong>{vehicle.brand} {vehicle.model}</strong><span>{vehicle.plateNumber} <i/> {vehicle.color}</span></div></div></td>
                <td><div className="date-cell"><strong>{formatDate(vehicle.annualTaxDue)}</strong><StatusPill date={vehicle.annualTaxDue} warningDays={30} kind="annualTax" annualTaxStatus={vehicle.annualTaxStatus}/></div></td>
                <td><div className="date-cell"><strong>{formatDate(vehicle.stnkFiveYearDue)}</strong><StatusPill date={vehicle.stnkFiveYearDue} warningDays={30} kind="stnkFiveYear" stnkStatus={vehicle.stnkStatus}/></div></td>
                <td><div className="date-cell"><strong>{formatDate(vehicle.kirDue)}</strong><StatusPill date={vehicle.kirDue} warningDays={7} kind="kir" kirStatus={vehicle.kirStatus}/></div></td>
                <td><div className="row-actions"><button type="button" className="icon-button" aria-label={`Edit ${vehicle.plateNumber}`} onClick={() => { setEditing(vehicle); setModalOpen(true); }}><Icon name="edit" size={17}/></button><button type="button" className="icon-button danger-hover" aria-label={`Hapus ${vehicle.plateNumber}`} onClick={() => void deleteVehicle(vehicle)}><Icon name="trash" size={17}/></button></div></td>
              </tr>)}
              {filteredVehicles.length === 0 && <tr><td colSpan={5}><div className="empty-state"><span className="empty-icon"><Icon name="truck" size={24}/></span><strong>{search || filter === "attention" ? "Kendaraan tidak ditemukan" : "Belum ada data kendaraan"}</strong><p>{search || filter === "attention" ? "Coba ubah kata kunci atau filter pencarian." : "Mulai dengan menambahkan kendaraan pertama ke armada."}</p>{!search && filter === "all" && <button className="button button-primary" onClick={() => setModalOpen(true)}><Icon name="plus" size={17}/> Tambah kendaraan</button>}</div></td></tr>}
            </tbody></table></div>
            <div className="table-footer"><span>Menampilkan <strong>{filteredVehicles.length}</strong> dari <strong>{brandVehicles.length}</strong> kendaraan</span><span>Data diperbarui otomatis berdasarkan tanggal dokumen</span></div>
          </div>

          <aside className="alerts-panel panel" id="alerts"><div className="panel-heading alerts-heading"><div><div className="alert-heading-title"><h2>Perlu perhatian</h2><span className="alert-total">{alerts.length}</span></div><p>Pengingat dokumen armada</p></div><span className="alert-heading-icon"><Icon name="bell" size={18}/></span></div>
            <div className="alert-list">{alerts.slice(0, 6).map((item, index) => <AlertRow key={`${item.vehicle.id}-${item.kind}`} item={item} index={index} onClick={() => { setEditing(item.vehicle); setModalOpen(true); }}/>)}</div>
            {alerts.length > 6 && <button className="view-all-button" onClick={() => { setFilter("attention"); document.getElementById("fleet")?.scrollIntoView({ behavior: "smooth" }); }}>Lihat semua {alerts.length} pengingat <Icon name="arrow" size={15}/></button>}
            {alerts.length === 0 && <div className="all-clear"><span><Icon name="check" size={19}/></span><strong>Semua dokumen aman</strong><p>Belum ada jadwal yang mendekati jatuh tempo.</p></div>}
            <div className="alert-legend"><span><i className="legend-dot soon-dot"/> Segera jatuh tempo</span><span><i className="legend-dot unknown-dot"/> Status perlu ditindaklanjuti</span><span><i className="legend-dot expired-dot"/> Terlambat</span></div>
          </aside>
        </section>

        <footer className="page-footer"><span>© {new Date().getFullYear()} Travo Logistics Management</span><span><span className="online-dot"/> Status dokumen dihitung otomatis setiap hari</span></footer>
      </div>
    </main>
    {modalOpen && <VehicleForm key={editing?.id ?? "new"} vehicle={editing} onClose={() => { setModalOpen(false); setEditing(null); }} onSave={saveVehicle}/>}
  </div>;
}

function AlertRow({ item, index, onClick }: { item: ReturnType<typeof getVehicleAlerts>[number]; index: number; onClick: () => void }) {
  const tone = item.status.level === "overdue" ? "alert-red" : "alert-amber";
  const icon = item.kind === "kir" ? "file" : "calendar";
  const unknownAction = item.kind === "annualTax"
    ? "Cek tanggal"
    : item.kind === "kir"
      ? item.vehicle.kirStatus === "missing" ? "Urus KIR" : "Verifikasi"
      : item.vehicle.stnkStatus === "missing" ? "Urus STNK" : "Tindak lanjut";
  const timing = item.status.level === "overdue" ? item.kind === "kir" ? `URGENT · ${Math.abs(item.status.daysLeft)} hari` : `Terlambat ${Math.abs(item.status.daysLeft)} hari` : item.status.level === "unknown" ? unknownAction : item.status.daysLeft === 0 ? "Hari ini" : `${item.status.daysLeft} hari`;
  const detail = item.status.level === "unknown" ? item.title : `${item.title} · ${formatDate(documentDate(item.vehicle, item.kind))}`;
  return <button type="button" className={`alert-row ${tone}`} style={{ animationDelay: `${index * 55}ms` }} onClick={onClick}><span className="alert-row-icon"><Icon name={icon} size={17}/></span><span className="alert-row-copy"><strong>{item.vehicle.plateNumber}</strong><small>{detail}</small></span><span className="alert-row-status">{timing}</span><Icon name="arrow" size={15}/></button>;
}
