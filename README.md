# Bantu Beres BK Pro

Ruang kerja bimbingan dan konseling sekolah. Dibangun berdasarkan struktur spreadsheet **Bantu Beres Bk pro v3** dan konsep dua alur: perkembangan seluruh siswa serta penanganan kasus.

## Modul yang dapat digunakan

- Pendaftaran email dan kata sandi yang langsung masuk tanpa tautan verifikasi; akun baru langsung memiliki ruang kerja awal; undangan tim memakai tautan sekali pakai yang dibagikan admin kepada petugas terkait.
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

Jalankan seluruh migrasi berurutan di `supabase/migrations/` pada proyek Supabase **baru** dan deploy Edge Function `supabase/functions/register/index.ts` dengan pemeriksaan JWT aktif, lalu jalankan `npm run build`. Fungsi pendaftaran menggunakan kunci service role hanya pada runtime Supabase dan membatasi percobaan per IP. Jangan masukkan service role key ke variabel `VITE_`.

Deployment Vercel: framework Vite, build command `npm run build`, output directory `dist`. Kode klien memakai URL dan publishable key proyek BK Pro khusus; publishable key aman berada di browser selama aturan RLS tetap aktif. Kunci rahasia atau service role tidak boleh ditaruh di kode klien.

## Format CSV siswa

Header minimal: `NIS,Nama,Kelas`. Opsional: `JK,Wali,Kontak`. NIS dipakai sebagai kunci unik per sekolah. Impor berulang melewati siswa yang sudah ada dan tidak menimpa profil lama. Ekspor mengikuti header yang sama. Arsip tidak menghapus riwayat layanan.

## Akses data

RLS membatasi seluruh data menurut sekolah dan mencabut akses secara langsung saat keanggotaan sekolah dicabut. Kasus hanya dapat dibaca konselor yang ditugaskan atau owner/admin sekolah. Kepala sekolah hanya menerima hitungan agregat melalui fungsi `bk_school_report`; tidak menerima identitas siswa atau isi catatan. Sesi individu dan kunjungan rumah otomatis menjadi rahasia dan hanya bisa dibaca konselor pencatat. Audit perubahan menyimpan metadata tindakan tanpa menyalin isi catatan. Kolom sensitif tidak diekspor ke laporan agregat.

## Batas versi ini

Dokumen dicatat sebagai tautan/metadata, belum mempunyai penyimpanan berkas privat. RPL disimpan sebagai catatan terstruktur, belum menjadi generator format dokumen resmi. AI, notifikasi push, pengingat otomatis, dan migrasi data siswa pribadi dari spreadsheet sumber belum diaktifkan. Tautan undangan harus dibagikan langsung melalui kanal tepercaya; email yang belum diverifikasi sendiri tidak boleh dipakai sebagai bukti hak akses.

## Progres QA (26 September 2026)

- Repository: `hudbrother62-coder/bk-pro`, deploy production `https://bk-pro.vercel.app`.
- Backend khusus: project Supabase `vtcdopzlgitqhvxqmtuy` (Singapura); jangan dicampur dengan One Pro, Disiplin Pro, atau aplikasi Bantu Beres lainnya.
- Pendaftaran langsung memakai Edge Function `register`; penerimaan undangan menggunakan tautan sekali pakai terikat email tujuan tanpa menyalin kode.
- Pembuatan sekolah dan membership owner menggunakan RPC `create_bk_school` dalam satu transaksi.
- Principal hanya meminta `bk_school_report`, tanpa melakukan query data siswa/kasus/rekam konseling.
- Pembacaan kasus/catatan memerlukan keanggotaan sekolah yang masih aktif. Catatan rahasia tetap hanya untuk penanggung jawab.
- Pengubahan profil siswa tidak memindahkan penanggung jawab secara diam-diam. Impor CSV melewati NIS terdaftar; pemuatan data dipaginasi hingga lengkap.
- Seluruh perubahan pada sesi ini tidak menghapus/mengubah record sekolah karena basis data belum berisi akun atau data sekolah.

**QA terverifikasi (27 September 2026):** pendaftaran email tanpa verifikasi langsung berhasil login; RPC pembuatan sekolah membuat owner dan membership; aplikasi kini membuat ruang kerja awal otomatis pada login pertama, siswa, kasus, dan catatan konseling rahasia tersimpan; undangan token sekali pakai diterima kepala sekolah; kepala sekolah tidak dapat membaca baris siswa/kasus/catatan dan memperoleh hitungan agregat yang sesuai. Kebijakan RLS pembuatan sekolah diperbaiki melalui migrasi keempat. Akun dan sekolah uji telah dibersihkan. Antarmuka produksi, mode gelap/terang, dan tata letak ponsel tetap perlu peninjauan visual pada perangkat pengguna.\n
## Alur masuk terbaru

Akun baru masuk langsung ke ruang kerja **Sekolah Baru** setelah daftar/login. Pemilik mengubah nama sekolah dan tahun ajaran melalui Pengaturan → Edit profil sekolah. Jika diundang admin, petugas membuka tautan undangan lalu login/daftar; keanggotaan diterima otomatis tanpa mengetik kode. Tautan bersifat sekali pakai dan hanya cocok dengan email tujuan. Jika tautan tidak berlaku, aplikasi menampilkan kesalahan dan tidak membuat ruang kerja lain secara otomatis.

## Navigasi dan panduan

Navigasi utama diringkas menjadi Beranda, Siswa 360°, Penanganan siswa, Layanan & program, Analitik & laporan, Pengaturan, dan Panduan penggunaan. Kelompok dapat dibuka untuk mengakses seluruh modul lama; tidak ada tabel atau catatan yang dihapus. Panduan di dalam aplikasi menjelaskan alur masuk, pengaturan sekolah, impor siswa, kasus, konseling rahasia, program, tindak lanjut, laporan, dan undangan tim sesuai peran pengguna.
