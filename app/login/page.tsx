"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase, supabaseConfigured } from "@/lib/supabase";

function BrandMark() { return <Image src="/logogram.png" alt="" width={52} height={52} className="brand-logo" priority/>; }

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [passwordSetup, setPasswordSetup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!supabase) {
      if (window.localStorage.getItem("travo-demo-session")) router.replace("/");
      return;
    }

    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const searchParams = new URLSearchParams(window.location.search);
    const callbackError = hashParams.get("error_code") ?? searchParams.get("error_code");
    if (callbackError === "otp_expired" || callbackError === "invite_not_found") {
      setError("Undangan sudah kedaluwarsa atau pernah digunakan. Minta admin Travo mengirim undangan baru.");
    } else if (callbackError) {
      setError("Tautan undangan tidak dapat digunakan. Minta admin Travo mengirim undangan baru.");
    }
    const isPasswordSetupLink = [hashParams.get("type"), searchParams.get("type")]
      .some((type) => type === "invite" || type === "recovery")
      || (hashParams.has("access_token") && hashParams.has("refresh_token"));

    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && isPasswordSetupLink)) setPasswordSetup(true);
    });

    void supabase.auth.getSession().then(({ data }) => {
      if (data.session && isPasswordSetupLink) setPasswordSetup(true);
      else if (data.session && !callbackError) router.replace("/");
      else if (isPasswordSetupLink && !callbackError) setError("Tautan undangan tidak dapat digunakan. Minta admin mengirim undangan baru.");
    });

    return () => authListener.subscription.unsubscribe();
  }, [router]);

  const signIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setBusy(true);

    if (passwordSetup && supabase) {
      if (password !== passwordConfirmation) {
        setError("Konfirmasi kata sandi belum sama.");
        setBusy(false);
        return;
      }
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
        setBusy(false);
        return;
      }
      router.replace("/");
      return;
    }

    if (!supabase) {
      window.localStorage.setItem("travo-demo-session", "demo");
      router.replace("/");
      return;
    }
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setError(authError.message.toLowerCase().includes("invalid") ? "Email atau kata sandi belum sesuai." : authError.message);
      setBusy(false);
      return;
    }
    router.replace("/");
  };

  return <main className="login-page">
    <div className="login-art"><div className="login-art-grid"/><div className="login-art-content"><a className="brand-lockup login-brand" href="/"><BrandMark/><span className="brand-name">travo<span>LOGISTICS</span></span></a><div className="login-illustration"><div className="illustration-orbit orbit-one"/><div className="illustration-orbit orbit-two"/><div className="illustration-card card-back"><span className="mini-card-line"/><span className="mini-card-line short"/><span className="mini-card-pill"/></div><div className="illustration-card card-front"><div className="mini-truck"><span/><i/><b/></div><span className="mini-card-label">FLEET STATUS</span><span className="mini-card-main">Armada terpantau</span><div className="mini-card-progress"><i/></div><div className="mini-card-bottom"><span>Dokumen aktif</span><strong>98%</strong></div></div><div className="illustration-pin"><span/></div></div><div className="login-art-copy"><span className="eyebrow">SATU DASHBOARD, LEBIH TERKENDALI</span><h1>Setiap perjalanan<br/>dimulai dari armada<br/><em>yang siap.</em></h1><p>Kelola kendaraan, dokumen, dan jadwal operasional Travo dalam satu ruang.</p></div><div className="login-art-footer"><span>TRAVO LOGISTICS MANAGEMENT</span><span>01 / 01</span></div></div></div>
    <section className="login-side"><div className="login-form-wrap"><div className="mobile-login-brand"><a className="brand-lockup" href="/"><BrandMark/><span className="brand-name">travo<span>LOGISTICS</span></span></a></div><div className="login-heading"><span className="eyebrow">{passwordSetup ? "PENGATURAN AKUN" : "SELAMAT DATANG"}</span><h2>{passwordSetup ? "Buat kata sandi" : "Masuk ke dashboard"}</h2><p>{passwordSetup ? "Buat kata sandi untuk menyelesaikan aktivasi akun Travo Anda." : "Gunakan akun Travo Anda untuk melanjutkan."}</p></div>
      <form className="login-form" onSubmit={signIn}>{supabaseConfigured && (passwordSetup ? <><label className="field"><span>Kata sandi baru</span><input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Minimal 8 karakter"/></label><label className="field"><span>Ulangi kata sandi</span><input type="password" autoComplete="new-password" minLength={8} required value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} placeholder="Masukkan kembali kata sandi"/></label></> : <><label className="field"><span>Email</span><input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nama@travo.co.id"/></label><label className="field"><span>Kata sandi</span><input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Masukkan kata sandi"/></label></>)}
        {error && <div className="form-error">{error}</div>}
        <button className="button button-primary login-submit" disabled={busy}>{busy ? "Memproses…" : passwordSetup ? "Simpan kata sandi" : supabaseConfigured ? "Masuk" : "Masuk ke mode demo"}<span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span></button>
      </form>
      <div className="login-help">{passwordSetup ? <><span className="secure-icon">⌑</span> Tautan ini aman digunakan satu kali untuk mengaktifkan akun.</> : supabaseConfigured ? <><span className="secure-icon">⌑</span> Akun dibuat oleh admin Travo.</> : <><span className="demo-info-icon">i</span> Mode demo memakai data contoh yang tersimpan di browser ini.</>}</div>
      <div className="login-bottom"><span>© {new Date().getFullYear()} Travo Logistics</span><span>Butuh bantuan? <a href="mailto:it@travo.co.id">Hubungi admin</a></span></div>
    </div></section>
  </main>;
}
