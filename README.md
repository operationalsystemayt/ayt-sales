# AYT Sales CRM

Sistem CRM untuk travel agency. Fitur utama: Dashboard, Leads & Deals, Booking, dengan flow Convert Lead → Booking.

**Stack:** React + Vite (frontend) · Go + Gin (backend) · PostgreSQL

---

## Daftar Isi

- [Jalankan Lokal](#jalankan-lokal)
- [Deploy ke VPS](#deploy-ke-vps)
- [Akun Default](#akun-default)
- [Struktur Proyek](#struktur-proyek)

---

## Jalankan Lokal

### Prasyarat

| Tool | Versi minimum |
|------|--------------|
| Go | 1.21+ |
| Node.js | 18+ |
| PostgreSQL | 14+ |

---

### 1. Clone & masuk ke direktori

```bash
git clone <url-repo>
cd ayt-sales
```

---

### 2. Siapkan Database PostgreSQL

**Opsi A — Docker (direkomendasikan, tidak perlu install PostgreSQL):**

```bash
docker run -d \
  --name ayt-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=ayt_sales \
  -p 5432:5432 \
  postgres:16-alpine
```

**Opsi B — PostgreSQL sudah terinstall lokal:**

```bash
psql -U postgres -c "CREATE DATABASE ayt_sales;"
```

---

### 3. Setup & jalankan Backend

```bash
cd backend

# Salin file konfigurasi
cp .env.example .env
```

Edit `.env` jika perlu (sesuaikan password/port database):

```env
DB_HOST=localhost
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=ayt_sales
DB_PORT=5432
JWT_SECRET=ganti-dengan-string-acak-panjang
PORT=8080
```

Jalankan backend:

```bash
go run ./cmd/server
```

Saat pertama kali jalan, backend otomatis:
- Membuat semua tabel (auto-migrate)
- Mengisi master data (sources, qualities, statuses, dll)
- Membuat akun default admin dan sales

Output yang diharapkan:
```
Database connected successfully
Database migrated successfully
Database seeded successfully
Server running on :8080
```

---

### 4. Setup & jalankan Frontend

Buka terminal baru:

```bash
cd frontend
npm install
npm run dev
```

Output yang diharapkan:
```
VITE v6.x  ready in xxx ms
➜  Local:   http://localhost:5173/
```

---

### 5. Buka di browser

```
http://localhost:5173
```

Login dengan akun default (lihat [Akun Default](#akun-default)).

---

## Akun Default

Akun ini dibuat otomatis saat backend pertama kali dijalankan.

| Role  | Email            | Password   |
|-------|------------------|------------|
| Admin | admin@ayt.com    | admin123   |
| Sales | raya@ayt.com     | sales123   |
| Sales | jean@ayt.com     | sales123   |
| Sales | jevry@ayt.com    | sales123   |

> **Penting:** Ganti password setelah login pertama di environment production.

---

## Deploy ke VPS

Panduan ini menggunakan Ubuntu 22.04. Semua perintah dijalankan sebagai user non-root dengan akses `sudo`.

---

### 1. Siapkan VPS

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential ufw
```

Konfigurasi firewall:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

---

### 2. Install dependensi di VPS

**Go:**

```bash
wget https://go.dev/dl/go1.24.linux-amd64.tar.gz
sudo tar -C /usr/local -xzf go1.24.linux-amd64.tar.gz
echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.bashrc
source ~/.bashrc
go version
```

**Node.js (via nvm):**

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 20
node --version
```

**PostgreSQL:**

```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

**Nginx:**

```bash
sudo apt install -y nginx
sudo systemctl enable nginx
```

---

### 3. Setup database di VPS

```bash
sudo -u postgres psql <<EOF
CREATE USER ayt_user WITH PASSWORD 'ganti-password-kuat';
CREATE DATABASE ayt_sales OWNER ayt_user;
GRANT ALL PRIVILEGES ON DATABASE ayt_sales TO ayt_user;
EOF
```

---

### 4. Deploy kode ke VPS

```bash
# Di VPS
mkdir -p /var/www/ayt-sales
cd /var/www/ayt-sales
git clone <url-repo> .
```

---

### 5. Build & jalankan Backend

```bash
cd /var/www/ayt-sales/backend

# Buat file .env production
cat > .env <<EOF
DB_HOST=localhost
DB_USER=ayt_user
DB_PASSWORD=ganti-password-kuat
DB_NAME=ayt_sales
DB_PORT=5432
JWT_SECRET=$(openssl rand -hex 32)
PORT=8080
EOF

# Build binary
go build -o ayt-backend ./cmd/server
```

Buat systemd service agar backend otomatis restart:

```bash
sudo nano /etc/systemd/system/ayt-backend.service
```

Isi file:

```ini
[Unit]
Description=AYT Sales CRM Backend
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/ayt-sales/backend
ExecStart=/var/www/ayt-sales/backend/ayt-backend
Restart=always
RestartSec=5
Environment=GIN_MODE=release

[Install]
WantedBy=multi-user.target
```

Aktifkan dan jalankan:

```bash
sudo chown -R www-data:www-data /var/www/ayt-sales/backend
sudo systemctl daemon-reload
sudo systemctl enable ayt-backend
sudo systemctl start ayt-backend

# Cek status
sudo systemctl status ayt-backend

# Cek log
sudo journalctl -u ayt-backend -f
```

---

### 6. Build Frontend

```bash
cd /var/www/ayt-sales/frontend
npm install
npm run build
# Hasil build ada di folder dist/
```

---

### 7. Konfigurasi Nginx

```bash
sudo nano /etc/nginx/sites-available/ayt-sales
```

Isi file (ganti `domain.com` dengan domain atau IP VPS Anda):

```nginx
server {
    listen 80;
    server_name domain.com www.domain.com;

    # Frontend (React build)
    root /var/www/ayt-sales/frontend/dist;
    index index.html;

    # Handle React Router (SPA)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API ke Go backend
    location /api/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 60s;
    }
}
```

Aktifkan konfigurasi:

```bash
sudo ln -s /etc/nginx/sites-available/ayt-sales /etc/nginx/sites-enabled/
sudo nginx -t          # pastikan tidak ada error
sudo systemctl reload nginx
```

Buka browser: `http://domain.com` atau `http://IP-VPS`

---

### 8. Setup HTTPS dengan Let's Encrypt (opsional tapi direkomendasikan)

> Hanya bisa dilakukan jika sudah punya domain yang mengarah ke VPS.

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d domain.com -d www.domain.com
sudo systemctl reload nginx
```

Certbot akan otomatis memperbarui sertifikat sebelum expired.

---

### Update Kode (Deployment Ulang)

Setiap kali ada perubahan kode:

```bash
cd /var/www/ayt-sales
git pull

# Rebuild backend
cd backend
go build -o ayt-backend ./cmd/server
sudo systemctl restart ayt-backend

# Rebuild frontend
cd ../frontend
npm install
npm run build
sudo systemctl reload nginx
```

---

## Struktur Proyek

```
ayt-sales/
├── backend/                  # Go backend
│   ├── cmd/server/main.go    # Entry point
│   ├── internal/
│   │   ├── config/           # Konfigurasi env
│   │   ├── database/         # Koneksi DB, migrasi, seed
│   │   ├── handlers/         # Handler HTTP per fitur
│   │   ├── middleware/       # JWT auth middleware
│   │   ├── models/           # Semua model GORM
│   │   └── router/           # Definisi routes
│   ├── .env.example
│   ├── Dockerfile
│   └── go.mod
├── frontend/                 # React + Vite
│   ├── src/
│   │   ├── pages/            # Dashboard, Leads, Booking, Login
│   │   ├── components/       # Layout, UI components
│   │   ├── services/api.ts   # Semua axios API calls
│   │   ├── store/auth.ts     # Zustand auth state
│   │   └── types/            # TypeScript interfaces
│   ├── package.json
│   └── vite.config.ts
├── docker-compose.yml        # Untuk development lokal
└── README.md
```

---

## API Endpoints

| Method | Path | Keterangan |
|--------|------|-----------|
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Info user aktif |
| GET | `/api/leads` | List leads (dengan filter) |
| POST | `/api/leads` | Tambah lead |
| PUT | `/api/leads/:id` | Update lead |
| PUT | `/api/leads/bulk` | Bulk update leads |
| POST | `/api/leads/:id/convert` | Convert lead → booking |
| GET | `/api/bookings` | List bookings |
| POST | `/api/bookings` | Tambah booking |
| PUT | `/api/bookings/:id` | Update booking |
| POST | `/api/bookings/:id/payments` | Tambah pembayaran |
| GET | `/api/dashboard/summary` | KPI summary |
| GET | `/api/dashboard/chart` | Data grafik |
| GET | `/api/dashboard/leaderboard` | Deal maker ranking |
| GET | `/api/dashboard/top-products` | Produk terlaris |
