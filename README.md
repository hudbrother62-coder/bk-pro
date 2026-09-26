# Bantu Beres BK Pro

Ruang kerja bimbingan dan konseling sekolah. Dibangun berdasarkan struktur spreadsheet **Bantu Beres Bk pro v3** dan konsep dua alur: perkembangan seluruh siswa serta penanganan kasus.

## Modul yang dapat digunakan

- Akun guru BK, admin sekolah, dan kepala sekolah; undangan berbasis email.
- Data siswa 360° dengan filter kelas, status arsip, impor/ekspor CSV, dan riwayat kasus/layanan.
- Kasus dengan ID unik, bidang, urgensi, sumber informasi, status, dan tanggal tindak lanjut.
- Pemetaan kebutuhan; konseling individu dan kelompok; layanan klasikal; RPL; program; agenda; tindak lanjut; kunjungan rumah; rujukan; perencanaan karier; dan register dokumen.
- Analitik bidang kasus dan laporan agregat yang dapat dicetak atau disimpan sebagai PDF melalui browser.
- Tema gelap/terang dan navigasi mobile.

## Menjalankan

Gunakan Node.js 22 atau lebih baru.

```bash
npm ci
cp .env.example .env.local
# Isi URL proyek dan publishable key Supabase di .env.local.
npm run dev
```

Jalankan `supabase/migrations/20260926000000_init_bk_pro.sql` pada proyek Supabase **baru**, lalu jalankan `npm run build` untuk memeriksa build produksi. Jangan masukkan service role key ke variabel `VITE_`.

Deployment Vercel: framework Vite, build command `npm run build`, output directory `dist`; tambahkan `VITE_SUPABASE_URL` dan `VITE_SUPABASE_PUBLISHABLE_KEY` untuk Production dan Preview. Tanpa konfigurasi tersebut aplikasi masuk ke pratinjau lokal yang jelas diberi label dan tidak menyimpan data permanen.

## Format CSV siswa

Header minimal: `NIS,Nama,Kelas`. Opsional: `JK,Wali,Kontak`. NIS dipakai sebagai kunci unik per sekolah agar impor berulang memperbarui data yang sama. Ekspor mengikuti header yang sama. Arsip tidak menghapus riwayat layanan.

## Akses data

RLS membatasi seluruh data menurut sekolah. Kepala sekolah hanya menerima hitungan agregat melalui fungsi `bk_school_report`; tidak menerima identitas siswa atau isi catatan. Sesi individu dan kunjungan rumah otomatis menjadi rahasia dan hanya bisa dibaca konselor pencatat. Audit perubahan menyimpan metadata tindakan tanpa menyalin isi catatan. Kolom sensitif tidak diekspor ke laporan agregat.

## Batas versi ini

Dokumen dicatat sebagai tautan/metadata, belum mempunyai penyimpanan berkas privat. RPL disimpan sebagai catatan terstruktur, belum menjadi generator format dokumen resmi. AI, notifikasi push, pengingat otomatis, dan migrasi data siswa pribadi dari spreadsheet sumber belum diaktifkan. Pengujian keamanan peran dan alur undangan perlu dijalankan pada proyek Supabase yang sudah dibuat sebelum digunakan dengan data siswa sebenarnya.
