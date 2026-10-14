# Travo Fleet Dashboard

Dashboard Next.js untuk mencatat armada, foto kendaraan, pajak tahunan, perpanjangan STNK lima tahunan, dan masa berlaku KIR.

## Menjalankan mode demo

```bash
npm install
npm run dev
```

Buka `http://localhost:3000`, lalu pilih **Masuk ke mode demo**. Mode ini menyimpan perubahan di local storage browser dan menyediakan data contoh dengan tanggal yang bergerak relatif terhadap hari ini. Gunakan untuk mencoba alur dashboard; data demo tidak dibagikan ke pengguna lain dan bukan penyimpanan produksi.

## Mengaktifkan login dan database bersama

1. Di [Supabase Dashboard](https://supabase.com/dashboard), buat organisasi dan proyek. Untuk pengguna di Indonesia, pilih region **Southeast Asia (Singapore)** jika tersedia.
2. Dari dialog **Connect** atau **Settings → API Keys**, salin Project URL dan publishable key ke `.env.local` di folder proyek. Gunakan key berawalan `sb_publishable_`; jangan gunakan atau membagikan secret key.
3. Di Supabase Dashboard → **SQL Editor → New Query**, salin seluruh isi `supabase/schema.sql`, lalu klik **Run**. Skrip ini membuat tabel kendaraan, aturan akses untuk pengguna login, dan bucket foto. Jika tabel sudah pernah dibuat, jalankan ulang skrip terbaru ini untuk menerapkan perubahan kolom KIR; data kendaraan yang ada tidak dihapus.
4. Di **Authentication → URL Configuration**, atur **Site URL** ke `http://localhost:3000/login` untuk pengujian lokal. Setelah aplikasi dipasang online, ganti ke alamat HTTPS website Anda dan tambahkan alamat itu ke daftar redirect yang diizinkan.
5. Buat akun pertama dari **Authentication → Users → Add user → Send invitation**. Buka tautan undangan dari perangkat yang dapat mengakses aplikasi; halaman login akan meminta pengguna membuat kata sandi.
6. Jalankan ulang server Next.js. Saat kedua variabel Supabase sudah terisi, aplikasi akan menggunakan login email/kata sandi dan database bersama. Data yang pernah dimasukkan di mode demo tetap berada di browser dan perlu dimasukkan ulang.

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your-key
```

Foto disimpan di bucket publik `vehicle-photos`; jangan unggah foto yang bersifat rahasia. Semua pengguna yang berhasil login saat ini dapat melihat, menambah, memperbarui, dan menghapus seluruh data armada. Pengaturan peran admin/operator dan kanal notifikasi email/WhatsApp dapat ditambahkan sesuai kebutuhan operasional.

Email undangan bawaan Supabase hanya bisa dikirim ke anggota organisasi proyek dan dibatasi hingga 2 email per jam. Sebelum mengundang alamat email staf Travo lainnya, siapkan SMTP khusus di pengaturan Authentication Supabase. Jangan menambahkan staf sebagai anggota organisasi Supabase hanya untuk melewati batas ini, karena itu memberi mereka akses ke dashboard pengelolaan proyek.

## Aturan pengingat

- Pajak tahunan: segera jatuh tempo dalam 30 hari atau kurang; terlambat setelah melewati tanggal.
- STNK lima tahunan: segera jatuh tempo dalam 30 hari atau kurang; terlambat setelah melewati tanggal.
- KIR dengan tanggal diketahui: peringatan 7 hari sebelum jatuh tempo; urgent setelah tanggalnya lewat.
- KIR yang belum dimiliki atau hilang tanpa tanggal yang diketahui: tetap bisa disimpan dan ditandai untuk ditindaklanjuti tanpa dianggap sudah kedaluwarsa.
- Status dihitung berdasarkan tanggal saat ini di zona waktu Asia/Jakarta. Simpan tanggal yang tercantum pada dokumen kendaraan sebagai sumber data.
