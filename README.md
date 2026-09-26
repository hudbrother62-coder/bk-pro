# Bantu Beres BK Pro

Ruang kerja bimbingan dan konseling sekolah. Dibangun berdasarkan struktur spreadsheet **Bantu Beres Bk pro v3** dan konsep dua alur: perkembangan seluruh siswa serta penanganan kasus.

## Modul yang dapat digunakan

- Pendaftaran email dan kata sandi yang langsung masuk tanpa tautan verifikasi; undangan tim memakai kode acak sekali pakai yang hanya diberikan admin kepada petugas terkait.
- Data siswa 360° dengan filter kelas, status arsip, impor/ekspor CSV, dan riwayat kasus/layanan.
- Kasus dengan ID unik, bidang, urgensi, sumber informasi, status, dan tanggal tindak lanjut.
- Pemetaan kebutuhan; konseling individu dan kelompok; layanan klasikal; RPL; program; agenda; tindak lanjut; kunjungan rumah; rujukan; perencanaan karier; dan register dokumen.
- Analitik bidang kasus dan laporan agregat yang dapat dicetak atau disimpan sebagai PDF melalui browser.
- Tema gelap/terang dan navigasi mobile.

## Menjalankan

Gunakan Node.js 22 atau lebih baru.

```bash
npm ci
npm run dev
```

Jalankan kedua migrasi di `supabase/migrations/` pada proyek Supabase **baru** dan deploy Edge Function `supabase/functions/register/index.ts` dengan pemeriksaan JWT aktif, lalu jalankan `npm run build`. Fungsi pendaftaran menggunakan kunci service role hanya pada runtime Supabase dan membatasi percobaan per IP. Jangan masukkan service role key ke variabel `VITE_`.

Deployment Vercel: framework Vite, build command `npm run build`, output directory `dist`. Kode klien memakai URL dan publishable key proyek BK Pro khusus; publishable key aman berada di browser selama aturan RLS tetap aktif. Kunci rahasia atau service role tidak boleh ditaruh di kode klien.

## Format CSV siswa

Header minimal: `NIS,Nama,Kelas`. Opsional: `JK,Wali,Kontak`. NIS dipakai sebagai kunci unik per sekolah agar impor berulang memperbarui data yang sama. Ekspor mengikuti header yang sama. Arsip tidak menghapus riwayat layanan.

## Akses data

RLS membatasi seluruh data menurut sekolah. Kepala sekolah hanya menerima hitungan agregat melalui fungsi `bk_school_report`; tidak menerima identitas siswa atau isi catatan. Sesi individu dan kunjungan rumah otomatis menjadi rahasia dan hanya bisa dibaca konselor pencatat. Audit perubahan menyimpan metadata tindakan tanpa menyalin isi catatan. Kolom sensitif tidak diekspor ke laporan agregat.

## Batas versi ini

Dokumen dicatat sebagai tautan/metadata, belum mempunyai penyimpanan berkas privat. RPL disimpan sebagai catatan terstruktur, belum menjadi generator format dokumen resmi. AI, notifikasi push, pengingat otomatis, dan migrasi data siswa pribadi dari spreadsheet sumber belum diaktifkan. Kode undangan harus dibagikan langsung melalui kanal tepercaya; email yang belum diverifikasi sendiri tidak boleh dipakai sebagai bukti hak akses.
