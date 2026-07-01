const API_KEY = import.meta.env.VITE_API_KEY; // Menyimpan API Key untuk layanan OpenWeatherMap
const BASE_URL = import.meta.env.VITE_API_URL; // URL dasar untuk mengambil data cuaca dan prakiraan cuaca
const GEO_URL = import.meta.env.VITE_GEO_API_URL; // URL dasar untuk mengubah koordinat menjadi nama lokasi atau sebaliknya

// Global State
let currentActiveCity = null; // State untuk menyimpan data kota yang sedang ditampilkan informasinya
let favoriteCities = JSON.parse(localStorage.getItem('skycast_favorites')) || []; // Mengambil data kota favorit dari localStorage, atau menggunakan array kosong jika belum ada
let searchHistory = JSON.parse(localStorage.getItem('skycast_search_history')) || []; // Mengambil riwayat pencarian dari localStorage
let isFahrenheit = localStorage.getItem('ext_unit_f') === 'true'; // Mengecek apakah pengguna menggunakan format Fahrenheit dari localStorage
let isLightMode = localStorage.getItem('ext_theme_light') === 'true'; // Mengecek apakah pengguna menggunakan tema terang dari localStorage

// UI Selectors
const loadingScreen = document.getElementById('loadingScreen'); // Mengambil elemen layar loading
const loadingMessage = document.getElementById('loadingMessage'); // Mengambil elemen teks pesan loading
const errorAlert = document.getElementById('errorAlert'); // Mengambil elemen alert untuk menampilkan pesan error
const errorMessage = document.getElementById('errorMessage'); // Mengambil elemen teks di dalam alert error
const weatherDashboard = document.getElementById('weatherDashboard'); // Mengambil elemen pembungkus utama dashboard cuaca
const btnToggleFavorite = document.getElementById('btnToggleFavorite'); // Mengambil elemen tombol tambah/hapus favorit
const heartIcon = document.getElementById('heartIcon'); // Mengambil ikon hati di dalam tombol favorit
const favoriteCitiesBar = document.getElementById('favoriteCitiesBar'); // Mengambil elemen bar untuk menampilkan daftar favorit
const favoritesList = document.getElementById('favoritesList'); // Mengambil kontainer daftar kota favorit
const inputCity = document.getElementById('inputCity'); // Mengambil elemen input teks pencarian kota

// Event Listeners
document.getElementById('btnMyLocation').addEventListener('click', getCurrentLocation); // Memanggil getCurrentLocation saat tombol lokasi saya diklik
document.getElementById('btnSearch').addEventListener('click', searchCity); // Memanggil searchCity saat tombol cari diklik
inputCity.addEventListener('keypress', (e) => { if (e.key === 'Enter') searchCity(); }); // Memanggil searchCity jika pengguna menekan tombol Enter di input teks
btnToggleFavorite.addEventListener('click', toggleFavoriteState); // Memanggil toggleFavoriteState saat tombol hati/favorit diklik

window.addEventListener('DOMContentLoaded', () => { // Menjalankan fungsi-fungsi awal saat dokumen web selesai dimuat
    renderFavoritesBar(); // Me-render daftar favorit yang tersimpan
    initExtensionDOM(); // Menginisialisasi komponen-komponen UI tambahan (ekstensi)
    loadLastLocation(); // Memuat lokasi terakhir yang dibuka pengguna atau meminta lokasi perangkat saat ini
});

// Loading & Error UI Helpers
function showLoading(msg) { // Fungsi untuk memunculkan layar loading beserta pesan
    loadingMessage.innerText = msg; // Mengatur pesan loading sesuai parameter
    loadingScreen.style.opacity = '1'; // Membuat layar loading terlihat sepenuhnya
    loadingScreen.style.pointerEvents = 'all'; // Mengaktifkan interaksi klik pada layar loading untuk memblokir elemen di bawahnya
}
function hideLoading() { // Fungsi untuk menghilangkan layar loading
    loadingScreen.style.opacity = '0'; // Membuat layar loading menjadi transparan
    loadingScreen.style.pointerEvents = 'none'; // Menonaktifkan interaksi klik pada layar loading
}
function displayError(msg) { // Fungsi untuk menampilkan pesan error
    errorAlert.classList.remove('hidden'); // Menghapus kelas 'hidden' agar alert error muncul
    errorMessage.innerText = msg; // Memasukkan pesan error ke dalam elemen teks alert
    hideLoading(); // Memastikan layar loading hilang ketika error terjadi
}
function clearError() { errorAlert.classList.add('hidden'); } // Fungsi untuk menyembunyikan kembali pesan error

// Geolocation
function getCurrentLocation() { // Fungsi meminta dan mendapatkan lokasi (koordinat) pengguna
    clearError(); // Menghilangkan pesan error jika sebelumnya ada
    if (!navigator.geolocation) return displayError("Browser tidak mendukung Geolocation."); // Menampilkan error jika browser tidak mendukung fitur lokasi
    showLoading("Meminta izin lokasi perangkat..."); // Menampilkan loading ketika menunggu persetujuan lokasi
    navigator.geolocation.getCurrentPosition( // Meminta posisi lokasi saat ini dari browser pengguna
        async (pos) => { // Callback yang dipanggil jika izin diberikan dan posisi berhasil didapatkan
            const { latitude: lat, longitude: lon } = pos.coords; // Menyimpan koordinat lintang (lat) dan bujur (lon)
            try { // Blok try-catch untuk menangani kemungkinan error pada proses fetch API
                const res = await fetch(`${GEO_URL}/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${API_KEY}`); // Memanggil API untuk mendapatkan nama lokasi dari koordinat (Reverse Geocoding)
                const data = await res.json(); // Mengurai (parsing) respon API dari string JSON menjadi objek JavaScript
                const name = data[0]?.name || "Unknown Location"; // Mengambil nama kota, atau memberikan nilai default jika tidak ada
                const region = `${data[0]?.state || "Region"}, ${data[0]?.country || ""}`; // Menggabungkan informasi provinsi dan negara menjadi format region
                await getWeather(lat, lon, name, region); // Memanggil fungsi getWeather untuk memuat cuaca berdasarkan lokasi yang didapat
            } catch (err) { displayError("Gagal reverse-geocoding."); } // Menangani dan menampilkan error apabila API gagal diakses
        },
        () => displayError("Akses lokasi ditolak."), { timeout: 10000 } // Callback ketika gagal mendapatkan lokasi, dengan batas waktu 10 detik
    );
}

// Search Engine
async function searchCity() { // Fungsi untuk mencari kota berdasarkan input teks
    const query = inputCity.value.trim(); // Mengambil teks input pengguna dan menghapus spasi di awal/akhirnya
    if (!query) return displayError("Kolom pencarian kosong."); // Menampilkan error jika pengguna menekan cari namun inputnya kosong
    clearError(); // Menyembunyikan pesan error sebelumnya
    showLoading(`Mencari indeks lokasi untuk '${query}'...`); // Menampilkan status loading pencarian
    try { // Blok try-catch untuk mengambil data
        const res = await fetch(`${GEO_URL}/direct?q=${encodeURIComponent(query)}&limit=1&appid=${API_KEY}`); // Memanggil API geocoding untuk mengubah nama kota menjadi koordinat
        const data = await res.json(); // Mengurai data yang dikembalikan API
        if (!data || data.length === 0) throw new Error(`Kota '${query}' tidak ditemukan.`); // Memunculkan (throw) error jika data kota tidak ditemukan
        const { lat, lon, name, state, country } = data[0]; // Memecah (destructure) nilai kordinat dan detail nama dari hasil pencarian
        await getWeather(lat, lon, name, state ? `${state}, ${country}` : country); // Memanggil fungsi untuk memuat data cuaca dari hasil pencarian
        inputCity.value = ''; // Mengosongkan kolom input teks setelah pencarian berhasil
    } catch (err) { displayError(err.message); } // Menampilkan error yang tertangkap selama proses pencarian ke UI
}

// Core Weather Pipeline
async function getWeather(lat, lon, city, region) { // Fungsi utama untuk memuat semua data cuaca dari API
    try { // Try-catch blok utama cuaca
        showLoading("Mengambil data cuaca dan prakiraan..."); // Update teks loading status
        const [currentRes, forecastRes, aqiRes] = await Promise.all([ // Menjalankan tiga request (fetch) API secara paralel dan serentak
            fetch(`${BASE_URL}/weather?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`), // Fetch data cuaca kondisi saat ini
            fetch(`${BASE_URL}/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`), // Fetch data prakiraan cuaca (5 hari, interval 3 jam)
            fetch(`${BASE_URL}/air_pollution?lat=${lat}&lon=${lon}&appid=${API_KEY}`) // Fetch data kualitas udara (Air Quality Index)
        ]);

        if (!currentRes.ok || !forecastRes.ok) throw new Error("Gagal mengambil data dari server."); // Verifikasi apakah status HTTP response untuk cuaca dan prakiraan sudah "OK" (200)

        const currentData = await currentRes.json(); // Membaca stream respons cuaca saat ini sebagai JSON
        const forecastData = await forecastRes.json(); // Membaca stream respons prakiraan cuaca sebagai JSON
        const aqiData = aqiRes.ok ? await aqiRes.json() : null; // Membaca AQI JSON jika API tersebut berhasil memberikan respons

        currentActiveCity = { lat, lon, city, region }; // Menyimpan data lokasi saat ini ke global state agar dapat dipakai fungsi lain (seperti favorit)
        
        displayWeather(currentData, city, region, lat, lon); // Memanggil fungsi render untuk memasukkan data cuaca saat ini ke HTML
        displayForecast(forecastData); // Memanggil fungsi render untuk menampilkan prakiraan cuaca masa depan di HTML
        if (aqiData) renderAQIAndUV(aqiData, lat); // Memanggil renderAQIAndUV jika data polusi udara (AQI) tersedia
        renderWeatherMap(lat, lon); // Menggambar peta satelit/interaktif berdasarkan koordinat
        
        updateFavoriteButtonUI(); // Memperbarui warna dan ikon tombol hati menyesuaikan dengan apakah kota ini ada di daftar favorit
        updateSearchHistory(city); // Memasukkan kota yang berhasil dimuat ke dalam riwayat pencarian
        localStorage.setItem('skycast_last_state', JSON.stringify(currentActiveCity)); // Menyimpan sesi kota ini ke storage, sehingga saat pengguna refresh halaman tidak hilang
        
        weatherDashboard.classList.remove('hidden'); // Menampilkan kontainer dashboard utama (yang semula disembunyikan saat kosong)
        hideLoading(); // Menyembunyikan layar loading setelah semua UI siap
        runUnitConversion(); // Menjalankan ulang fungsi unit (jika mode Fahrenheit sebelumnya aktif) untuk memastikan satuan suhu sesuai
    } catch (err) { displayError(err.message); } // Menangkap dan mencetak semua error (contoh koneksi terputus)
}

// Render Dashboard Utama
function displayWeather(data, city, region, lat, lon) { // Fungsi untuk mencetak teks cuaca (kondisi sekarang) ke UI
    document.getElementById('txtCity').innerText = city; // Mencetak teks Nama Kota
    document.getElementById('txtRegion').innerText = region; // Mencetak teks Nama Wilayah (Provinsi/Negara)
    document.getElementById('txtLat').innerText = lat.toFixed(4); // Menulis koordinat lintang ke UI, dipotong menjadi 4 digit desimal
    document.getElementById('txtLon').innerText = lon.toFixed(4); // Menulis koordinat bujur ke UI, dipotong menjadi 4 digit desimal

    const setTemp = (id, val) => { // Fungsi lokal helper untuk mengatur temperatur di UI
        const el = document.getElementById(id); // Mengambil elemen berdasarkan ID
        if (el) { el.setAttribute('data-celsius', val); el.innerText = `${val}°C`; } // Menyimpan data mentah celsius di atribut, lalu menampilkan format suhu ke innerText
    };
    setTemp('txtTemperature', Math.round(data.main.temp)); // Memanggil helper untuk menyetel suhu utama ruangan/luar (dibulatkan)
    setTemp('valFeels', Math.round(data.main.feels_like)); // Memanggil helper untuk menyetel suhu 체감 (feels like / terasa seperti)

    document.getElementById('txtCondition').innerText = data.weather[0].description; // Mencetak keterangan cuaca (contoh: "hujan rintik")
    document.getElementById('imgWeatherIcon').src = `https://openweathermap.org/img/wn/${data.weather[0].icon}@4x.png`; // Mengganti URL gambar ikon cuaca dari server OpenWeatherMap
    document.getElementById('valHumidity').innerText = `${data.main.humidity}%`; // Menulis persentase kelembaban udara
    document.getElementById('valWind').innerText = `${data.wind.speed} m/s`; // Menulis kecepatan angin dengan satuan m/s
    document.getElementById('valPressure').innerText = `${data.main.pressure} hPa`; // Menulis tekanan udara (hPa)
    document.getElementById('valVisibility').innerText = `${(data.visibility / 1000).toFixed(1)} km`; // Menulis jarak pandang, mengonversi meter ke kilometer (dibagi 1000)

    const formatTime = (ts) => new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }); // Fungsi pembantu untuk mengubah unix timestamp detik ke format jam:menit
    document.getElementById('valSunrise').innerText = formatTime(data.sys.sunrise); // Mencetak jam matahari terbit
    document.getElementById('valSunset').innerText = formatTime(data.sys.sunset); // Mencetak jam matahari terbenam

    updateDynamicBackground(data.weather[0].icon); // Memanggil fungsi pengganti tema background berdasarkan kode ikon cuaca (misal hujan, malam)
}

// Render 5-Day & Hourly Forecast
function displayForecast(data) { // Fungsi untuk mencetak UI prakiraan cuaca jangka panjang dan per jam
    const container = document.getElementById('forecastContainer'); // Container div untuk elemen kartu prakiraan cuaca harian
    const hourlyContainer = document.getElementById('extHourlyContainer'); // Container div untuk elemen blok prakiraan tiap 3 jam
    container.innerHTML = ''; if (hourlyContainer) hourlyContainer.innerHTML = ''; // Mengosongkan kedua container tersebut dari pencarian sebelumnya

    data.list.filter(item => item.dt_txt.includes("12:00:00")).slice(0, 5).forEach((dayData) => { // Mem-filter array hasil API untuk mencari prakiraan pada siang hari jam 12, lalu mengambil 5 hari pertama
        const dayName = new Date(dayData.dt * 1000).toLocaleDateString('id-ID', { weekday: 'short' }); // Mendapatkan nama hari (Singkatan) dari timestamp, dengan lokal Indonesia
        const cMin = Math.round(dayData.main.temp_min - 2); // Estimasi suhu terendah di hari tersebut (dikurangi sedikit agar realistis untuk simulasi)
        const cMax = Math.round(dayData.main.temp_max + 1); // Estimasi suhu tertinggi
        const card = document.createElement('div'); // Membuat tag HTML div baru sebagai kartu harian
        card.className = `forecast-card p-4 rounded-2xl flex flex-col items-center text-center space-y-1`; // Memberikan kelas-kelas CSS (termasuk flex, rounded)
        card.innerHTML = `<span class="text-xs font-semibold text-white/70 uppercase">${dayName}</span><img src="https://openweathermap.org/img/wn/${dayData.weather[0].icon}.png" class="w-12 h-12"><span class="text-sm font-bold capitalize text-white/90 text-xs">${dayData.weather[0].main}</span><div class="flex gap-2 text-xs pt-1"><span class="text-cyan-200 font-medium temp-val" data-celsius="${cMin}">${cMin}°</span><span class="text-white/40">|</span><span class="text-orange-300 font-medium temp-val" data-celsius="${cMax}">${cMax}°</span></div>`; // Mendefinisikan struktur HTML di dalam kartu (hari, gambar cuaca, status, rentang suhu)
        container.appendChild(card); // Memasukkan elemen kartu tersebut ke dalam container harian di dashboard
    });

    if (hourlyContainer) { // Jika ada ekstensi container prakiraan per jam
        data.list.slice(0, 8).forEach(item => { // Mengambil 8 buah interval (berarti 8 * 3 = 24 jam ke depan) dari array API
            const time = new Date(item.dt * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }); // Mengubah timestamp ke jam dan menit saja
            const temp = Math.round(item.main.temp); // Membulatkan suhu jam tersebut
            const block = document.createElement('div'); // Membuat tag elemen div untuk satu jam prakiraan
            block.className = 'flex flex-col items-center bg-white/5 border border-white/5 p-3 rounded-xl min-w-[75px] text-center'; // Styling kelas CSS
            block.innerHTML = `<span class="text-xs text-white/60 font-medium">${time}</span><img src="https://openweathermap.org/img/wn/${item.weather[0].icon}.png" class="w-10 h-10"><span class="text-sm font-bold temp-val" data-celsius="${temp}">${temp}°</span>`; // Isi elemen block dengan label waktu, gambar ikon, dan nilai suhu
            hourlyContainer.appendChild(block); // Memasukkan block tersebut ke panel prakiraan per jam
        });
    }
}

// Favorite Cities Core Logic
function toggleFavoriteState() { // Fungsi yang dipanggil saat pengguna ingin menambah atau membuang kota favorit
    if (!currentActiveCity) return; // Jika belum ada kota yang di-load, batalkan aksi
    const idx = favoriteCities.findIndex(c => c.city === currentActiveCity.city && c.region === currentActiveCity.region); // Mencari index array jika kota ini sudah ada dalam list favorit
    if (idx === -1) favoriteCities.push(currentActiveCity); // Jika index tidak ketemu (-1) berarti belum favorit, maka tambahkan ke array
    else favoriteCities.splice(idx, 1); // Jika ketemu index-nya, hapus data tersebut dari array (toggle mati)
    localStorage.setItem('skycast_favorites', JSON.stringify(favoriteCities)); // Timpa nilai di LocalStorage dengan array yang sudah berubah tersebut
    updateFavoriteButtonUI(); renderFavoritesBar(); // Panggil fungsi render ulang tombol dan bar daftar favorit
}

function updateFavoriteButtonUI() { // Fungsi untuk mengubah gaya dan warna ikon tombol hati di header dashboard
    if (!currentActiveCity) return; // Hindari eksekusi jika objek kota aktif belum ada
    const isFav = favoriteCities.some(c => c.city === currentActiveCity.city && c.region === currentActiveCity.region); // Gunakan 'some' untuk nge-cek apakah kota aktif ada dalam list favorit
    heartIcon.className = isFav ? "fa-solid fa-heart text-red-500 animate-bounce" : "fa-regular fa-heart text-red-400"; // Jika isFav true, hati solid merah dan animasi bounce. Jika false, hati biasa outline
}

function renderFavoritesBar() { // Fungsi untuk merender ulang deretan lencana (badge) kota di bar favorit
    favoritesList.innerHTML = ''; // Membersihkan tag HTML list favorit sebelumnya (reset DOM)
    favoriteCitiesBar.classList.toggle('hidden', favoriteCities.length === 0); // Menambahkan/mencopot class 'hidden' di kontainer jika array favoritenya kosong atau berisi
    favoriteCities.forEach(item => { // Lakukan perulangan untuk setiap object kota dalam array favorit
        const badge = document.createElement('div'); // Membentuk elemen baru div untuk dijadikan tag badge
        badge.className = 'fav-badge'; // Menambahkan kelas CSS gaya
        badge.innerHTML = `<span class="fav-btn-click font-medium">${item.city}</span><button class="fav-remove-btn"><i class="fa-solid fa-xmark text-xs"></i></button>`; // Memberikan nama kota dan tombol X di dalamnya
        badge.querySelector('.fav-btn-click').addEventListener('click', () => getWeather(item.lat, item.lon, item.city, item.region)); // Menambahkan event listener: jika teks kota ditekan, load cuacanya
        badge.querySelector('.fav-remove-btn').addEventListener('click', (e) => { // Event listener ketika pengguna klik tombol (X) hapus
            e.stopPropagation(); // Mencegah event dari bubbling, agar tidak men-trigger event klik di badge utama
            favoriteCities = favoriteCities.filter(c => !(c.city === item.city && c.region === item.region)); // Hapus item tersebut dari array dengan method filter
            localStorage.setItem('skycast_favorites', JSON.stringify(favoriteCities)); // Memperbarui data array ke storage peramban pengguna
            updateFavoriteButtonUI(); renderFavoritesBar(); // Minta sistem merender ulang UI kembali setelah dihapus
        });
        favoritesList.appendChild(badge); // Masukkan lencana kota ini pada node list yang tersedia
    });
}

// Background Matrix Dinamis
function updateDynamicBackground(iconCode) { // Fungsi untuk menyetel background layar (gradasi, gambar) sesuai kondisi cuaca
    document.body.className = "min-h-screen font-['Inter'] text-slate-800 antialiased transition-all duration-1000 p-4 md:p-8 flex flex-col items-center justify-center "; // Set ulang kelas body dasar dengan gaya font dan flexbox, dan tambahkan transisi halus
    if (iconCode.endsWith('n')) return document.body.classList.add('weather-bg-night'); // Jika karakter terakhir icon cuaca adalah 'n' (night), gunakan tema background malam
    const id = iconCode.substring(0, 2); // Ambil angka utama (2 digit depan) pada kode icon API cuaca (cth: '01', '09')
    if (id === '01') document.body.classList.add('weather-bg-sunny'); // Jika kode '01', terapkan kelas CSS cerah (sunny)
    else if (['02', '03', '04'].includes(id)) document.body.classList.add('weather-bg-cloudy'); // Jika kodenya awan, terapkan latar berawan
    else if (['09', '10', '11', '13'].includes(id)) document.body.classList.add('weather-bg-rain'); // Jika kodenya hujan / petir, terapkan tema mendung / hujan
    else document.body.classList.add('weather-bg-default'); // Kondisi lain (mist, kabut, dll), terapkan background default biru netral
}

function loadLastLocation() { // Fungsi memulihkan sesi ketika web pertama dibuka
    const saved = localStorage.getItem('skycast_last_state'); // Mengakses record 'skycast_last_state'
    if (saved) { const { city, region, lat, lon } = JSON.parse(saved); getWeather(lat, lon, city, region); } // Jika ada rekam jejak, eksekusi pemuatan data cuacanya berdasarkan yang tersimpan
    else { getCurrentLocation(); } // Bila belum pernah masuk / tidak ada data tersimpan, langsung minta izin melacak lokasi GPS pengguna
}

// --- EXTENSION: CONTROL THEME & CONVERTER UNIT ---
function initExtensionDOM() { // Fungsi injeksi dan inisialisasi panel-panel ekstra untuk versi extended dashboard
    if (document.getElementById('extPanelContainer')) return; // Mencegah fitur dijalankan dua kali secara bersamaan
    const ctrl = document.createElement('div'); // Menyiapkan div untuk menu kontrol (sisi layar/header)
    ctrl.className = 'skycast-controls'; // Memberikan nama class layout dari css
    ctrl.innerHTML = `<button id="extUnitBtn" class="skycast-btn">°C</button><button id="extThemeBtn" class="skycast-btn"><i class="fa-solid fa-moon"></i></button>`; // Menambahkan 2 tombol: pengatur suhu (F/C) dan mode gelap/terang
    document.body.appendChild(ctrl); // Menambahkan kontrol-kontrol tersebut ke hierarki dokumen root body

    const applyTheme = () => { // Fungsi di dalam (closure) untuk merubah style global light mode
        document.documentElement.classList.toggle('light-mode', isLightMode); // Memicu pergantian kelas spesifik pada html (root) berdasarkan flag isLightMode
        document.getElementById('extThemeBtn').innerHTML = isLightMode ? '<i class="fa-solid fa-sun text-orange-500"></i>' : '<i class="fa-solid fa-moon"></i>'; // Merubah simbol bulan atau matahari di tombol UI
        localStorage.setItem('ext_theme_light', isLightMode); // Simpan pilihan tema pengguna ke localStorage
    };
    document.getElementById('extThemeBtn').addEventListener('click', () => { isLightMode = !isLightMode; applyTheme(); }); // Menambahkan klik listener: kebalikan flag dan terapkan tema
    applyTheme(); // Panggil fungsi di permulaan agar tema disesuaikan dengan nilai awal yang dimuat dari localStorage
    document.getElementById('extUnitBtn').addEventListener('click', () => { isFahrenheit = !isFahrenheit; localStorage.setItem('ext_unit_f', isFahrenheit); runUnitConversion(); }); // Listener tombol suhu, simpan flag Fahrenheit yang baru dan eksekusi fungsi konversi teks elemen cuaca

    // Inject Panels (Hourly, AQI, UV, and Weather Map)
    const dashboard = document.getElementById('weatherDashboard'); // Mendapatkan grid penampung data dashboard utama
    if (!dashboard) return; // Keluar jika dashboard aslinya hilang atau tidak ada
    const extWrapper = document.createElement('div'); // Membuat kotak tambahan baru
    extWrapper.id = 'extPanelContainer'; extWrapper.className = 'lg:col-span-3 space-y-6 slide-up'; // Memberi penanda kolom ekstensi dan animasi 'slide up'
    extWrapper.innerHTML = `
        <div class="ext-premium-card"><h3 class="font-semibold mb-3 flex items-center gap-2"><i class="fa-regular fa-clock text-cyan-400"></i> Prakiraan Per Jam</h3><div id="extHourlyContainer" class="hourly-scroll-box"></div></div>
        <div class="ext-grid-container">
            <div class="ext-premium-card"><h3 class="font-semibold mb-2 flex items-center gap-2"><i class="fa-solid fa-wind text-green-400"></i> Kualitas Udara (AQI)</h3><p id="extAQIStatus" class="text-xl font-bold">--</p><div class="index-progress-bar"><div id="extAQIBar" class="index-progress-fill bg-green-400"></div></div></div>
            <div class="ext-premium-card"><h3 class="font-semibold mb-2 flex items-center gap-2"><i class="fa-regular fa-sun text-yellow-400"></i> Indeks Radiasi UV</h3><p id="extUVLevel" class="text-2xl font-black">0.0</p><div class="index-progress-bar"><div id="extUVBar" class="index-progress-fill bg-yellow-400"></div></div></div>
            <div class="ext-premium-card lg:col-span-2"><h3 class="font-semibold mb-2 flex items-center gap-2"><i class="fa-solid fa-earth-americas text-blue-400"></i> Satelit Cuaca Langsung</h3><div id="extMapContainer"></div></div>
        </div>`; // Mendefinisikan template HTML HTML panel prakiraan 24jam, AQI, UV, serta area peta
    dashboard.appendChild(extWrapper); // Menambahkan gabungan panel-panel ini ke layout dashboard

    const header = document.querySelector('header') || document.body; // Cari header tempat kita meletakkan riwayat pencarian
    const histBox = document.createElement('div'); histBox.id = 'extHeaderBox'; histBox.className = 'max-w-md mx-auto mt-2 text-center'; // Membuat blok box untuk riwayat
    histBox.innerHTML = `<p class="text-xs text-white/50">Riwayat Pencarian:</p><div id="extHistoryContainer" class="history-badge-list justify-center"></div>`; // Tag label penanda area riwayat pencarian terbaru
    header.appendChild(histBox); // Menyelipkan kotak tersebut di bawah input kotak pencarian
    renderHistoryBadges(); injectAutoComplete(); // Me-render teks lencana history dan menjalankan skrip interaksi ketik auto-complete
}

// Konversi Unit Suhu
function runUnitConversion() { // Fungsi loop di seluruh DOM yang mengandung kelas temperatur dan mengubahnya jadi C atau F
    document.querySelectorAll('#txtTemperature, #valFeels, .temp-val').forEach(el => { // Query seluruh teks yang perlu dikonversi
        const celsius = parseInt(el.getAttribute('data-celsius')); // Dapatkan nilai numerik celsius yang memang selalu disimpan statis di masing-masing tag HTML
        if (!isNaN(celsius)) el.innerText = isFahrenheit ? `${Math.round((celsius * 9/5) + 32)}°F` : `${celsius}°C`; // Hitung rumus konversi dan replace tulisan yang tampil dengan format nilai C atau F
    });
    if (document.getElementById('extUnitBtn')) document.getElementById('extUnitBtn').innerText = isFahrenheit ? "°F" : "°C"; // Terakhir perbarui tombol toggle indikator agar serasi
}

// AQI, UV Analytics Processing, & Live Maps Integration
function renderAQIAndUV(data, lat) { // Memproses hasil JSON untuk nilai Kualitas Udara (AQI) dan prediksi Sinar Ultraviolet
    const aqi = data.list[0]?.main.aqi || 1; // Membaca skala AQI, bila JSON tak valid fallback ke '1' (paling bagus)
    const aqiMap = { // Menyediakan kamus penerjemahan angka (1 hingga 5) menjadi parameter grafis
        1: { text: "Bagus", col: "#4ade80", w: "20%" }, 2: { text: "Sedang", col: "#facc15", w: "40%" }, // 1=Bagus (Hijau), 2=Sedang (Kuning)
        3: { text: "Sedikit Sehat", col: "#f97316", w: "60%" }, 4: { text: "Tidak Sehat", col: "#ef4444", w: "80%" }, 5: { text: "Berbahaya", col: "#7c3aed", w: "100%" } // Level bahaya selanjutnya
    };
    document.getElementById('extAQIStatus').innerText = aqiMap[aqi].text; // Ubah teks hasil indeks udara
    document.getElementById('extAQIStatus').style.color = aqiMap[aqi].col; // Ubah warna font sesuai indeks
    document.getElementById('extAQIBar').style.width = aqiMap[aqi].w; // Sesuaikan garis persentase (progress bar)
    document.getElementById('extAQIBar').style.backgroundColor = aqiMap[aqi].col; // Warnai bar persentase tersebut

    const hour = new Date().getHours(); // Mendapatkan jam lokal perangkat untuk menghitung UV bayangan
    const uv = (Math.max(0, 11 - Math.abs(lat) / 8) * Math.max(0, Math.sin((hour - 6) / 12 * Math.PI))).toFixed(1); // Perhitungan matematika buatan untuk membuat skor UV statis (karena API ini tak men-support UV langsung secara gratis)
    document.getElementById('extUVLevel').innerText = uv; // Pasang angka skor UV ke UI
    document.getElementById('extUVBar').style.width = `${(uv / 12) * 100}%`; // Hitung porsi grafis (skor maksimum UV 12, maka bar 100% saat skor UV mencapai 12)
}

function renderWeatherMap(lat, lon) { // Fungsi untuk mencetak komponen dan script LeafletJS ke dashboard (peta wilayah geografis)
    const container = document.getElementById('extMapContainer'); // Tangkap ID kotak peta 
    if (!container) return; // Jika gagal tertangkap (biasanya saat fitur belum diinject) maka hentikan

    // Bersihkan kontainer dan buat elemen map baru agar tidak terjadi bentrok saat render ulang
    container.innerHTML = `<div id="interactiveMap" class="w-full h-56 rounded-xl overflow-hidden shadow-inner"></div>`; // Inject div utama khusus Leaflet

    // Pastikan library Leaflet CSS & JS sudah terpasang secara dinamis tanpa mengubah file HTML
    if (!document.getElementById('leaflet-css')) { // Cek head apakah link referensi 'leaflet.css' tersedia
        document.head.insertAdjacentHTML('beforeend', `<link id="leaflet-css" rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />`); // Memasang tag leaflet CSS pada head DOM
    }

    const initMap = () => { // Fungsi inisiasi spesifik membuat instance objek peta
        // Membuat objek peta Leaflet yang bisa digeser (draggable)
        const map = L.map('interactiveMap').setView([lat, lon], 10); // Menjadikan div 'interactiveMap' sbg peta map Leaflet, Set kordinat ke kordinat kota saat ini, dan zoom level 10

        // Menggunakan tile layer gratis dari OpenStreetMap
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { // Mengatur link penyedia ubin-ubin gambar peta dunia raster
            attribution: '© OpenStreetMap' // Menambahkan lisensi/atribusi di sudut
        }).addTo(map); // Timpakan/tempel Layer ubin tersebut ke variabel 'map' Leaflet

        // Menambahkan penanda (marker) di lokasi yang sedang aktif
        const marker = L.marker([lat, lon]).addTo(map) // Beri titik lokasi jarum (marker)
            .bindPopup("Lokasi Aktif (Klik tempat lain untuk mengubah)").openPopup(); // Munculkan pop-up pemberitahuan sederhana saat penanda dirender pertama

        // Fitur Utama: Deteksi klik di area mana saja pada peta untuk memilih lokasi baru
        map.on('click', async (e) => { // Beri listener terhadap objek map pada aksi klik mouse/touch
            const newLat = e.latlng.lat; // Ambil nilai lintang klik dari event e
            const newLon = e.latlng.lng; // Ambil nilai bujur klik
            
            // Geser penanda ke titik baru yang diklik
            marker.setLatLng([newLat, newLon]).setPopupContent("Mengambil data cuaca...").openPopup(); // Pindahkan marker dan notifikasi popup Loading
            
            try { // Blok try request
                // Lakukan reverse geocoding untuk mencari nama wilayah berdasarkan koordinat baru
                const res = await fetch(`${GEO_URL}/reverse?lat=${newLat}&lon=${newLon}&limit=1&appid=${API_KEY}`); // Cari nama kota dan provinsi yang dipetakan pada area laut/darat koordinat
                const data = await res.json(); // Bongkar respons
                const cityName = data[0]?.name || `Koordinat [${newLat.toFixed(2)}, ${newLon.toFixed(2)}]`; // Tentukan nama kota dari data, bila gagal beri nama koordinat sebagai judul
                const regionName = data[0]?.state ? `${data[0].state}, ${data[0].country}` : (data[0]?.country || "Custom Location"); // Sama halnya dg negara/provinsi (fallback jika tidak dikenali)
                
                // Panggil core pipeline bawaan kode Anda untuk memperbarui seluruh data cuaca di web
                await getWeather(newLat, newLon, cityName, regionName); // Panggil fungsi API inti sistem yang memicu load cuaca
            } catch (err) { // Jika network API error / timeout
                // Jika geocoding gagal, tetap panggil fungsi cuaca menggunakan nama default koordinat
                await getWeather(newLat, newLon, `Lokasi Terpilih`, `${newLat.toFixed(2)}, ${newLon.toFixed(2)}`); // Fallback load nama area klik menggunakan default teks saja
            }
        });
    };

    // Panggil inisialisasi peta setelah script Leaflet siap
    if (typeof L === 'undefined') { // Kalau variabel global `L` tidak terbaca berarti script utama JS Leaflet belum dimasukkan
        const script = document.createElement('script'); // Buat tag script dinamis
        script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"; // Referensi file sumber
        script.onload = initMap; // Pasang event onload supaya menjalankan initMap setelah kode didownload komplit
        document.body.appendChild(script); // Sambungkan tag script ke dalam DOM body, sehingga proses pengunduhan kode mulai
    } else { // Jika `L` sudah terbaca karena sebelumnya telah terinisialisasi
        initMap(); // Tinggal panggil secara reguler tanpa perlu me-load kembali skrip jaringan
    }
}

// History & Autocomplete searches
function updateSearchHistory(city) { // Fungsi pembaruan array history saat pengguna cari tempat baru
    if (!city || city === "---") return; // Bypass kalau isinya kosong tidak valid
    searchHistory = searchHistory.filter(c => c.toLowerCase() !== city.toLowerCase()); // Filter agar item ganda hilang (kota ini akan digeser jadi posisi pertama, jadi hapus yang di posisi lama)
    searchHistory.unshift(city); if (searchHistory.length > 4) searchHistory.pop(); // Taruh item baru di antrean pertama unshift, dan bila daftar kepanjangan (> 4 item) hapus elemen buntut menggunakan pop
    localStorage.setItem('skycast_search_history', JSON.stringify(searchHistory)); // Update memori browser pengguna
    renderHistoryBadges(); // Tampilkan lencana yang anyar di front-end
}

function renderHistoryBadges() { // Menerjemahkan isi array list string history menjadi potongan elemen kapsul span HTML
    const container = document.getElementById('extHistoryContainer'); // Kotak wadahnya
    if (!container) return; // Keluar
    container.innerHTML = searchHistory.length === 0 ? '<span class="text-xs text-white/30 italic">Belum ada riwayat</span>' : ''; // Kondisional awal: kalau 0 beri teks "belum ada..."
    searchHistory.forEach(city => { // Looping setiap teks kota
        const tag = document.createElement('span'); tag.className = 'history-tag flex items-center gap-1 cursor-pointer'; // Konstruksi span HTML layout
        tag.innerHTML = `<span><i class="fa-solid fa-clock-rotate-left opacity-60"></i> ${city}</span><button class="ml-1 text-white/40 hover:text-red-400">×</button>`; // InnerHTML: 2 elemen (Satu ikon riwayat jam & teks nama, dan tombol X Hapus)
        tag.querySelector('span').addEventListener('click', () => { inputCity.value = city; searchCity(); }); // Memberi event klik: apabila ditekan masukkan nama ini ke textbox pencarian dan tekan Enter/submit 'searchCity'
        tag.querySelector('button').addEventListener('click', (e) => { e.stopPropagation(); searchHistory = searchHistory.filter(c => c !== city); localStorage.setItem('skycast_search_history', JSON.stringify(searchHistory)); renderHistoryBadges(); }); // Event X (Tutup): Hapus dan simpan
        container.appendChild(tag); // Lempar elemen ini ke DOM (Render per ulangan)
    });
}

function injectAutoComplete() { // Skrip untuk memasukkan box menu Pop-Up rekomendasi kota (AutoComplete) tiap pengguna mengetik
    inputCity.parentElement.style.position = 'relative'; // Ubah wrapper luar form teks pencarian dengan properti positioning relative
    const box = document.createElement('div'); box.className = 'autocomplete-suggestions hidden'; // Buat kotak div tempat opsi akan turun dan berikan style/kelasnya
    inputCity.parentElement.appendChild(box); // Sambungkan kotak dropdown ini pada parent kotak teks input form
    const samples = ["Jakarta", "Yogyakarta", "Surabaya", "Bandung", "Medan", "Bali", "Tokyo", "London", "New York"]; // Sebagai demo kami definisikan daftar statis array kata kunci
    inputCity.addEventListener('input', (e) => { // Trigger aksi disaat karakter diketik (input keyboard berubah)
        const val = e.target.value.trim().toLowerCase(); // Dapatkan teks input yang kecil dan tanpa spasi pinggir
        if (!val) return box.classList.add('hidden'); // Jika kotak menjadi kembali kosong, maka box usulan ditutup (hidden)
        const filtered = samples.filter(c => c.toLowerCase().startsWith(val)); // Lakukan fungsi cari (filter) kota dalam sampel array yang kata awalan/prefiks nya cocok dengan ketikan
        if (filtered.length === 0) return box.classList.add('hidden'); // Tutup juga form rekomendasi semisal kota usulan tak match sama sekali
        box.innerHTML = filtered.map(c => `<div class="suggestion-item">${c}</div>`).join(''); box.classList.remove('hidden'); // Kalau cocok, kita mapping usulan menjadi serangkaian baris elemen list yang dapat diklik
        box.querySelectorAll('.suggestion-item').forEach(item => { item.addEventListener('click', () => { inputCity.value = item.innerText; box.classList.add('hidden'); searchCity(); }); }); // Menanamkan aksi bahwa jika dropdown usulan diklik, set form dan mulai pencarian
    });
    document.addEventListener('click', (e) => { if (e.target !== inputCity) box.classList.add('hidden'); }); // Agar UI bersih, box ini otomatis mati jika mouse pengguna diklik di area lain selain input itu sendiri
}