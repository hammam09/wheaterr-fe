# HamWheater ⛅

Aplikasi dashboard cuaca modern, responsif, dan dinamis yang dibangun dengan HTML, CSS (Tailwind CSS), dan JavaScript. Aplikasi ini memberikan informasi cuaca secara real-time, prakiraan 5 hari, dan memungkinkan Anda mengelola kota favorit Anda.

## Demo Website
- URL : https://hamweatherr.netlify.app

## ✨ Fitur

- **Data Cuaca Real-Time**: Dapatkan kondisi cuaca saat ini termasuk suhu, 'feels like', kelembapan, kecepatan angin, tekanan udara, jarak pandang, waktu matahari terbit, dan matahari terbenam.
- **Dukungan Geolocation**: Mengambil cuaca untuk lokasi Anda saat ini secara otomatis.
- **Pencarian Kota**: Cari informasi cuaca di kota manapun secara global.
- **Prakiraan 5 Hari**: Lihat prakiraan cuaca untuk 5 hari ke depan.
- **Manajemen Kota Favorit**: Simpan dan kelola kota-kota favorit Anda untuk akses cepat (disimpan di LocalStorage).
- **Latar Belakang Dinamis**: Latar belakang berubah secara dinamis berdasarkan kondisi cuaca saat ini (Cerah, Berawan, Hujan, Malam, dll).
- **UI Glassmorphism**: Desain glassmorphism yang indah dan modern dengan animasi yang halus.
- **Desain Responsif**: Sangat dioptimalkan untuk tampilan mobile, tablet, dan desktop.

## 🛠️ Teknologi yang Digunakan

- **HTML5**: Struktur aplikasi.
- **CSS3**: Penataan gaya dan tata letak responsif. CSS kustom digunakan untuk efek glassmorphism dan animasi.
- **JavaScript (ES6)**: Logika aplikasi, manipulasi DOM, dan integrasi API.
- **OpenWeatherMap API**: Digunakan untuk mengambil data cuaca real-time, prakiraan, dan parsing geolocation.
- **Font Awesome**: Ikon yang digunakan di seluruh UI.
- **Google Fonts**: Font Inter dan Poppins.

## 🚀 Setup & Instalasi

1. **Clone atau Unduh Repositori:**
   ```bash
   git clone https://github.com/hammam09/wheaterapp-fe.git
   cd wheater-app
   ```

2. **Buka Proyek:**
   Cukup buka file `index.html` di web browser pilihan Anda. Tidak diperlukan server lokal atau alat build untuk setup dasar ini.

   *Opsional: Jika Anda ingin menjalankannya melalui server pengembangan lokal, Anda dapat menggunakan alat seperti VS Code Live Server atau HTTP server bawaan Python.*

3. **Pengaturan API Key (Jika diperlukan):**
   Aplikasi ini menggunakan OpenWeatherMap API key yang terletak di `main.js`. Jika Anda berencana untuk men-deploy ini atau menggunakannya secara ekstensif, Anda mungkin ingin mengganti konstanta `API_KEY` di `main.js` dengan key Anda sendiri dari [OpenWeatherMap](https://openweathermap.org/api).
   ```javascript
   const API_KEY = 'API_KEY_ANDA_SENDIRI';
   ```

## 📱 Penggunaan

- **Get My Location (Lokasi Saya)**: Klik tombol "Get My Location" untuk mengizinkan browser menggunakan koordinat GPS Anda untuk menampilkan cuaca lokal.
- **Search City (Cari Kota)**: Masukkan nama kota di bilah pencarian dan tekan Enter atau klik ikon pencarian.
- **Favorite**: Klik tombol "Favorite" untuk menambahkan atau menghapus kota yang sedang dilihat dari daftar favorit Anda.
- **Bilah Favorit**: Klik pada kota mana saja di bilah favorit untuk melihat cuacanya dengan cepat. Klik tombol 'X' untuk menghapusnya dari favorit.

## 📁 Struktur File

- `index.html`: Tata letak HTML utama.
- `style.css`: Gaya kustom untuk latar belakang, animasi, dan kartu glassmorphism.
- `main.js`: Logika inti untuk panggilan API, manajemen state, dan rendering UI.

## 📄 Lisensi

Proyek ini bersifat open-source dan tersedia di bawah [Lisensi MIT](LICENSE).
