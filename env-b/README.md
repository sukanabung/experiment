# Microservices TODO App

## 📋 Daftar Isi

- [Arsitektur](#arsitektur)
- [Prasyarat](#prasyarat)
- [Quick Start](#quick-start-start--testing--stop)
- [Cara Menjalankan](#cara-menjalankan)
- [Testing API](#testing-api)
- [Akses UI](#akses-ui)
- [Menghentikan Layanan](#menghentikan-layanan)
- [Troubleshooting](#troubleshooting)

---

## 🏗️ Arsitektur

### Layanan Microservices

| Layanan                  | Port | Database              | Deskripsi                                        |
| ------------------------ | ---- | --------------------- | ------------------------------------------------ |
| **auth-service**         | 3003 | PostgreSQL (`authdb`) | Registrasi, Login, Verifikasi JWT, Session Redis |
| **todo-service**         | 3001 | PostgreSQL (`tododb`) | CRUD Todo, Auth Middleware, Pub/Sub Redis        |
| **notification-service** | 3002 | -                     | Subscribe Redis `todo.created`, Email Alert      |

### Infrastruktur

| Komponen       | Port | Fungsi                           |
| -------------- | ---- | -------------------------------- |
| **PostgreSQL** | 5432 | Database untuk auth dan todo     |
| **Redis**      | 6379 | Session store dan Pub/Sub events |

### Endpoint API

#### Auth Service (`/auth` dan `/api/auth`)

- `POST /register` - Registrasi user baru
- `POST /login` - Login, dapatkan JWT token
- `POST /verify` - Verifikasi token
- `GET /health` - Health check

#### Todo Service (`/todos` dan `/api/todos`)

- `POST /` - Buat todo baru
- `GET /` - Lihat semua todo
- `GET /:todoId` - Lihat todo spesifik
- `PUT /:todoId` - Edit todo
- `PATCH /:todoId` - Tandai todo selesai
- `DELETE /:todoId` - Hapus todo
- `GET /health` - Health check

#### Notification Service (`/notify`)

- `POST /notify` - Kirim notifikasi
- `GET /health` - Health check

---

## ✅ Prasyarat

Pastikan sudah ter-install:

- **Docker** versi 20.10+
- **Docker Compose** versi 1.29+
- **Git** (untuk clone repo)

### Verifikasi Instalasi

```powershell
docker --version
docker compose --version
```

---

## ⚡ Quick Start: Start → Testing → Stop

Panduan lengkap dari awal hingga akhir dalam 5 langkah mudah.

### 🟢 STEP 1: Mulai Layanan

```powershell
cd d:\Kuliah\Semester 7\Skripsi\Jurnal\microservices
docker compose up -d --build
```

✅ Tunggu 10-15 detik hingga semua container siap.

**Verifikasi:**

```powershell
docker compose ps
```

Pastikan semua container status `Up`.

---

### 🧪 STEP 2: Test Semua Layanan

#### 2a. Registrasi User

```powershell
$regBody = @{
    username = 'Tester'
    email = 'tester@test.com'
    password = 'Test123!@'
} | ConvertTo-Json

Invoke-RestMethod -Uri http://localhost:3003/auth/register `
    -Method Post `
    -ContentType 'application/json' `
    -Body $regBody | ConvertTo-Json
```

**Expected:** `"Registrasi Berhasil! Silakan Login."`

---

#### 2b. Login & Dapatkan Token

```powershell
$loginBody = @{
    email = 'tester@test.com'
    password = 'Test123!@'
} | ConvertTo-Json

$login = Invoke-RestMethod -Uri http://localhost:3003/auth/login `
    -Method Post `
    -ContentType 'application/json' `
    -Body $loginBody

$token = $login.token
Write-Host "✅ Login Berhasil! Token: $token"
```

**Expected:** Token JWT diterima.

---

#### 2c. Buat Todo

```powershell
$todoBody = @{
    title = 'Test Todo'
    description = 'Ini adalah test'
    deadline = '2026-06-15T10:00:00Z'
} | ConvertTo-Json

$todo = Invoke-RestMethod -Uri http://localhost:3001/todos `
    -Method Post `
    -ContentType 'application/json' `
    -Headers @{ Authorization = "Bearer $token" } `
    -Body $todoBody

$todo | ConvertTo-Json
```

**Expected:** Todo berhasil dibuat dengan ID.

---

#### 2d. Lihat Semua Todo

```powershell
Invoke-RestMethod -Uri http://localhost:3001/todos `
    -Method Get `
    -Headers @{ Authorization = "Bearer $token" } | ConvertTo-Json
```

**Expected:** List todo ditampilkan.

---

#### 2e. Lihat Todo Spesifik

```powershell
$todoId = $todo.todo.id

Invoke-RestMethod -Uri "http://localhost:3001/todos/$todoId" `
    -Method Get `
    -Headers @{ Authorization = "Bearer $token" } | ConvertTo-Json
```

**Expected:** Detail todo ditampilkan.

---

#### 2f. Edit Todo

```powershell
$updateBody = @{
    title = 'Test Todo (Updated)'
    description = 'Sudah diupdate'
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3001/todos/$todoId" `
    -Method Put `
    -ContentType 'application/json' `
    -Headers @{ Authorization = "Bearer $token" } `
    -Body $updateBody | ConvertTo-Json
```

**Expected:** Todo berhasil diupdate.

---

#### 2g. Tandai Selesai

```powershell
Invoke-RestMethod -Uri "http://localhost:3001/todos/$todoId" `
    -Method Patch `
    -Headers @{ Authorization = "Bearer $token" } | ConvertTo-Json
```

**Expected:** `isCompleted` menjadi `true`.

---

#### 2h. Hapus Todo

```powershell
Invoke-RestMethod -Uri "http://localhost:3001/todos/$todoId" `
    -Method Delete `
    -Headers @{ Authorization = "Bearer $token" } | ConvertTo-Json
```

**Expected:** Todo berhasil dihapus.

---

### 🌐 STEP 3: Akses UI di Browser

Buka tab browser baru:

```
http://localhost:8080/login.html
```

- Gunakan kredensial dari STEP 2a untuk login
- Atau buat user baru langsung di UI
- Kelola todo melalui interface

---

### 🛑 STEP 4: Hentikan Layanan

#### Opsi A: Hentikan Tanpa Reset Data

```powershell
docker compose down
```

✅ Data terjaga, bisa jalankan `docker compose up -d` lagi nanti.

---

#### Opsi B: Hentikan & Reset Semua

```powershell
docker compose down -v
```

⚠️ Semua data dihapus, database reset.

---

### 🔄 STEP 5: Jalankan Ulang

Jika sudah di-stop di STEP 4:

```powershell
docker compose up -d
```

✅ Layanan hidup kembali dengan data lama (jika tidak reset).

---

## 🚀 Cara Menjalankan

### Opsi 1: Dengan Docker Compose (Recommended) ⭐

#### Step 1: Navigasi ke Root Folder

```powershell
cd d:\Kuliah\Semester 7\Skripsi\Jurnal\microservices
```

#### Step 2: Bersihkan Lingkungan Sebelumnya (Jika Ada)

```powershell
docker compose down -v
```

Perintah ini akan:

- Menghentikan semua container
- Menghapus network
- **Menghapus volume** (untuk reset database)

#### Step 3: Mulai Layanan

```powershell
docker compose up -d --build
```

Opsi:

- `-d` : Jalankan di background (detached mode)
- `--build` : Build/rebuild image

#### Step 4: Tunggu Layanan Siap

Tunggu 10-15 detik agar PostgreSQL, Redis, dan services siap.

#### Step 5: Verifikasi Status Layanan

```powershell
docker compose ps
```

Output yang diharapkan:

```
CONTAINER ID   IMAGE                              STATUS          PORTS
...            microservices-redis                Up 2 seconds    6379/tcp
...            microservices-postgres             Up 2 seconds    5432/tcp
...            auth-service                       Up 1 second     3003/tcp
...            todo-service                       Up 1 second     3001/tcp
...            notification-service               Up 1 second     3002/tcp
```

Jika semua `STATUS` menunjukkan `Up`, berarti layanan siap! ✅

---

### Opsi 2: Jalankan Lokal Tanpa Docker

#### Setup Auth Service

```powershell
cd auth-service
npm install
```

Buat `.env`:

```
DATABASE_URL=postgresql://todouser:todopass@127.0.0.1:5432/authdb
AUTH_PORT=3003
JWT_SECRET=supersecretkey123
JWT_EXPIRY=24h
REDIS_URL=redis://127.0.0.1:6379
```

Jalankan:

```powershell
npm start
```

#### Setup Todo Service

Di terminal baru:

```powershell
cd todo-service
npm install
```

Buat `.env`:

```
DATABASE_URL=postgresql://todouser:todopass@127.0.0.1:5432/tododb
TODO_PORT=3001
AUTH_SERVICE_URL=http://localhost:3003/api/auth
NOTIF_SERVICE_URL=http://localhost:3002/notify
REDIS_URL=redis://127.0.0.1:6379
JWT_SECRET=supersecretkey123
```

Jalankan:

```powershell
npm start
```

#### Setup Notification Service

Di terminal baru:

```powershell
cd notification-service
npm install
```

Buat `.env`:

```
NOTIF_PORT=3002
REDIS_URL=redis://127.0.0.1:6379
```

Jalankan:

```powershell
npm start
```

**Catatan:** Pastikan PostgreSQL dan Redis sudah berjalan di `localhost:5432` dan `localhost:6379`.

---

## 🧪 Testing API

### Test Health Endpoints

```powershell
$endpoints = @(
    'http://localhost:3003/health',
    'http://localhost:3001/health',
    'http://localhost:3002/health'
)

foreach ($url in $endpoints) {
    Write-Host "Testing: $url"
    Invoke-RestMethod -Uri $url | ConvertTo-Json
}
```

### Test Auth Flow

#### 1. Registrasi User

```powershell
$regBody = @{
    username = 'John Doe'
    email = 'john@example.com'
    password = 'Password123!'
} | ConvertTo-Json

Invoke-RestMethod -Uri http://localhost:3003/auth/register `
    -Method Post `
    -ContentType 'application/json' `
    -Body $regBody | ConvertTo-Json
```

**Response:**

```json
{
  "message": "Registrasi Berhasil! Silakan Login."
}
```

#### 2. Login

```powershell
$loginBody = @{
    email = 'john@example.com'
    password = 'Password123!'
} | ConvertTo-Json

$login = Invoke-RestMethod -Uri http://localhost:3003/auth/login `
    -Method Post `
    -ContentType 'application/json' `
    -Body $loginBody

$login | ConvertTo-Json
$token = $login.token
Write-Host "Token: $token"
```

**Response:**

```json
{
  "message": "Login Berhasil",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "username": "John Doe"
  }
}
```

#### 3. Verifikasi Token

```powershell
Invoke-RestMethod -Uri http://localhost:3003/auth/verify `
    -Method Post `
    -ContentType 'application/json' `
    -Body (@{ token = $token } | ConvertTo-Json) | ConvertTo-Json
```

### Test Todo Flow

#### 1. Buat Todo

```powershell
$todoBody = @{
    title = 'Belajar Microservices'
    description = 'Setup Docker Compose dan PostgreSQL'
    deadline = '2026-06-10T12:00:00Z'
} | ConvertTo-Json

$todo = Invoke-RestMethod -Uri http://localhost:3001/todos `
    -Method Post `
    -ContentType 'application/json' `
    -Headers @{ Authorization = "Bearer $token" } `
    -Body $todoBody

$todo | ConvertTo-Json
$todoId = $todo.todo.id
```

#### 2. Lihat Semua Todo

```powershell
Invoke-RestMethod -Uri http://localhost:3001/todos `
    -Method Get `
    -Headers @{ Authorization = "Bearer $token" } | ConvertTo-Json
```

#### 3. Lihat Todo Spesifik

```powershell
Invoke-RestMethod -Uri "http://localhost:3001/todos/$todoId" `
    -Method Get `
    -Headers @{ Authorization = "Bearer $token" } | ConvertTo-Json
```

#### 4. Edit Todo

```powershell
$updateBody = @{
    title = 'Belajar Microservices (Updated)'
    description = 'Setup Docker Compose, PostgreSQL, dan Redis'
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3001/todos/$todoId" `
    -Method Put `
    -ContentType 'application/json' `
    -Headers @{ Authorization = "Bearer $token" } `
    -Body $updateBody | ConvertTo-Json
```

#### 5. Tandai Todo Selesai

```powershell
Invoke-RestMethod -Uri "http://localhost:3001/todos/$todoId" `
    -Method Patch `
    -Headers @{ Authorization = "Bearer $token" } | ConvertTo-Json
```

#### 6. Hapus Todo

```powershell
Invoke-RestMethod -Uri "http://localhost:3001/todos/$todoId" `
    -Method Delete `
    -Headers @{ Authorization = "Bearer $token" } | ConvertTo-Json
```

---

## 🌐 Akses UI

1. Buka browser, akses:

   ```
   http://localhost:8080/login.html
   ```

2. Gunakan kredensial dari testing atau registrasi baru

3. Halaman UI:
   - `login.html` - Login/Register
   - `home.html` - Daftar Todo

---

## 🛑 Menghentikan Layanan

### Jika menggunakan Docker Compose

```powershell
# Hentikan semua container (tetap simpan volume)
docker compose down

# Hentikan dan hapus semua container + volume (reset penuh)
docker compose down -v
```

### Jika menjalankan lokal

Di setiap terminal, tekan `Ctrl + C` untuk menghentikan service.

---

## 🔧 Troubleshooting

### Error: PostgreSQL tidak terhubung

**Penyebab:** PostgreSQL belum sepenuhnya inisialisasi  
**Solusi:**

```powershell
docker compose down -v
docker compose up -d --build
# Tunggu 15 detik, coba lagi
```

### Error: Port sudah terpakai

**Solusi:** Ganti port di `.env` atau `docker-compose.yml`

### Cek Log Layanan

```powershell
# Lihat log auth-service
docker compose logs -f auth-service

# Lihat log todo-service
docker compose logs -f todo-service

# Lihat log notification-service
docker compose logs -f notification-service

# Lihat semua log
docker compose logs -f
```

### Reset Database

```powershell
docker compose down -v
docker compose up -d --build
```

---

## 📝 Catatan Penting

- **UI tidak berubah** - Semua endpoint tetap kompatibel dengan UI lama
- **PostgreSQL** - Database diinisialisasi otomatis saat `docker compose up`
- **Redis** - Session dan event pub/sub dihandle otomatis
- **JWT Token** - Valid selama 24 jam (bisa diubah di `.env`)
- **Security** - Gunakan JWT_SECRET yang kuat di production

---

## 📊 Monitoring (opsional, sesuai modul)

Untuk eksperimen performa, sebuah stack monitoring minimal disediakan di `monitoring/` (Prometheus + Grafana + cAdvisor).

Jalankan stack monitoring:

```powershell
docker compose -f monitoring/docker-compose.yml up -d
```

- Prometheus: http://localhost:9090
- Grafana: http://localhost:3000
  -- cAdvisor UI (container metrics): http://localhost:8081

Konfigurasi Prometheus dasar ada di `monitoring/prometheus.yml` dan sudah men-scrape cAdvisor. Untuk pengumpulan metrik container selama JMeter run, jalankan monitoring sebelum memulai load tests.
