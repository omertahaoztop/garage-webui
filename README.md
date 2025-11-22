# Garage Web UI

[![image](misc/img/garage-webui.png)](misc/img/garage-webui.png)

A simple admin web UI for [Garage](https://garagehq.deuxfleurs.fr/), a self-hosted, S3-compatible, distributed object storage service.

[ [Screenshots](misc/SCREENSHOTS.md) | [Install Garage](https://garagehq.deuxfleurs.fr/documentation/quick-start/) | [Garage Git](https://git.deuxfleurs.fr/Deuxfleurs/garage) ]

## Features

- Garage health status
- Cluster & layout management
- Create, update, or view bucket information
- Integrated objects/bucket browser
- Create & assign access keys

## Installation

The Garage Web UI is available as a single executable binary and docker image. You can install it using the command line or with Docker Compose.

### Docker CLI

```sh
$ docker run -p 3919:3919 -v ./garage.toml:/etc/garage.toml:ro --restart unless-stopped --name garage-webui khairul169/garage-webui:latest
```

### Docker Compose

If you install Garage using Docker, you can install this web UI alongside Garage as follows:

```yml
services:
  garage:
    image: dxflrs/garage:v2.0.0
    container_name: garage
    volumes:
      - ./garage.toml:/etc/garage.toml
      - ./meta:/var/lib/garage/meta
      - ./data:/var/lib/garage/data
    restart: unless-stopped
    ports:
      - 3900:3900
      - 3901:3901
      - 3902:3902
      - 3903:3903

  webui:
    image: khairul169/garage-webui:latest
    container_name: garage-webui
    restart: unless-stopped
    volumes:
      - ./garage.toml:/etc/garage.toml:ro
    ports:
      - 3919:3919
    environment:
      API_BASE_URL: "http://garage:3903"
      S3_ENDPOINT_URL: "http://garage:3900"
```

### Without Docker

Get the latest binary from the [release page](https://github.com/khairul169/garage-webui/releases/latest) according to your OS architecture. For example:

```sh
$ wget -O garage-webui https://github.com/khairul169/garage-webui/releases/download/1.1.0/garage-webui-v1.1.0-linux-amd64
$ chmod +x garage-webui
$ sudo cp garage-webui /usr/local/bin
```

Run the program with specified `garage.toml` config path.

```sh
$ CONFIG_PATH=./garage.toml garage-webui
```

If you want to run the program at startup, you may want to create a systemd service.

```sh
$ sudo nano /etc/systemd/system/garage-webui.service
```

```
[Unit]
Description=Garage Web UI
After=network.target

[Service]
Environment="PORT=3909"
Environment="CONFIG_PATH=/etc/garage/config.toml"
Environment="API_BASE_URL=http://127.0.0.1:3903"
Environment="S3_ENDPOINT_URL=http://127.0.0.1:3900"
Environment="S3_REGION=garage"
Environment="AUTH_USER_PASS=admin:$2a$10$YourBcryptHashHere..."
ExecStart=/usr/local/bin/garage-webui
Restart=always

[Install]
WantedBy=default.target
```

Then reload and start the garage-webui service.

```sh
$ sudo systemctl daemon-reload
$ sudo systemctl enable --now garage-webui
```

### Configuration

The Garage Web UI **automatically reads** values from your Garage configuration file (`config.toml`):
- `rpc_public_addr` - Used to construct API endpoints
- `admin.admin_token` - Admin API authentication
- `admin.api_bind_addr` - Admin API port (default: 3903)
- `s3_api.api_bind_addr` - S3 API port (default: 3900)
- `s3_api.s3_region` - S3 region name

**Example Garage `config.toml`:**

```toml
metadata_dir = "/var/lib/garage/meta"
data_dir = "/var/lib/garage/data"
db_engine = "sqlite"
metadata_auto_snapshot_interval = "6h"

replication_factor = 3
compression_level = 2

rpc_bind_addr = "[::]:3901"
rpc_public_addr = "127.0.0.1:3901" # Required - used for endpoint URLs
rpc_secret = "YOUR_RPC_SECRET_HERE"

[s3_api]
s3_region = "garage"  # Default region name
api_bind_addr = "[::]:3900"
root_domain = ".s3.domain.com"

[s3_web] # Optional
bind_addr = "[::]:3902"
root_domain = ".web.domain.com"
index = "index.html"

[admin] # Required for Web UI
api_bind_addr = "[::]:3903"
admin_token = "YOUR_ADMIN_TOKEN_HERE"
metrics_token = "YOUR_METRICS_TOKEN_HERE"
```

**Manual override:** If auto-detection fails or you need custom endpoints, use environment variables (see below).

### Environment Variables

Configurable envs:

- `CONFIG_PATH`: Path to the Garage `config.toml` file. Defaults to `/etc/garage.toml`.
- `PORT`: Web UI server port. Defaults to `3919`.
- `HOST`: Server host. Defaults to `0.0.0.0`.
- `BASE_PATH`: Base path or prefix for Web UI.
- `API_BASE_URL`: Garage admin API endpoint URL (overrides config file).
- `API_ADMIN_KEY`: Admin API key (overrides config file).
- `S3_REGION`: S3 Region (overrides config file). Defaults to `garage`.
- `S3_ENDPOINT_URL`: S3 Endpoint URL (overrides config file).
- `AUTH_USER_PASS`: Enable authentication. Format: `username:bcrypt_hash`.

### Authentication

Authentication is **disabled by default**. Enable it by setting the `AUTH_USER_PASS` environment variable in the format `username:bcrypt_hash`.

**Generate bcrypt hash:**

**Option 1: Using the included password generator (development only)**
```bash
# Build the tool
make gen-password

# Generate hash
./tools/gen_password admin mypassword123
```

**Option 2: Using htpasswd**
```bash
htpasswd -nbBC 10 "YOUR_USERNAME" "YOUR_PASSWORD"
```

> If `htpasswd` is not found, install `apache2-utils` (Debian/Ubuntu) or `httpd-tools` (RHEL/CentOS) using your package manager.

**Example output:**
```
admin:$2a$10$YourBcryptHashHere...
```

**Docker Compose:**

```yml
webui:
  ....
  environment:
    AUTH_USER_PASS: "admin:$2a$10$YourBcryptHashHere..."
```

**Systemd service:**

Add to the `[Service]` section:
```
Environment="AUTH_USER_PASS=admin:$2a$10$YourBcryptHashHere..."
```

### Running

Once your instance of Garage Web UI is started, you can open the web UI at http://your-ip:3919. You can place it behind a reverse proxy to secure it with SSL.

## Development

This project is bootstrapped using TypeScript & React for the UI, and Go for backend. If you want to build it yourself or add additional features, follow these steps:

### Prerequisites

- **Node.js** (v18+)
- **pnpm** (`npm install -g pnpm`)
- **Go** (v1.21+)
- **Air** (for hot reload): `go install github.com/air-verse/air@latest`

### Setup

```sh
$ git clone https://github.com/khairul169/garage-webui.git
$ cd garage-webui
$ pnpm install
```

### Running Development Server

**Option 1: Start both frontend + backend concurrently**
```sh
$ pnpm run dev
```

**Option 2: Start separately**
```sh
# Terminal 1 - Frontend (Vite dev server on :5173)
$ pnpm run dev:client

# Terminal 2 - Backend (Go server on :3919 with hot reload)
$ cd backend
$ air
```

### Building for Production

**Using Makefile (Recommended):**
```sh
# Build everything (frontend + backend)
$ make build

# Or build separately
$ make build-frontend  # Output: dist/ and backend/ui/dist/
$ make build-backend   # Output: garage-webui

# Clean build artifacts
$ make clean

# See all available commands
$ make help
```

**Manual build:**
```sh
# 1. Build frontend
$ pnpm run build  # Output: dist/

# 2. Copy dist to backend UI directory
$ rm -rf backend/ui/dist
$ cp -r dist backend/ui/dist

# 3. Build backend (with embedded frontend)
$ cd backend
$ go build -tags prod -o ../garage-webui .
```

**Run production binary:**
```sh
$ CONFIG_PATH=./garage.toml ./garage-webui
```

## Troubleshooting

Make sure you are using the latest version of Garage. If the data cannot be loaded, please check whether your instance of Garage has the admin API enabled and the ports are accessible.

If you encounter any problems, please do not hesitate to submit an issue [here](https://github.com/khairul169/garage-webui/issues). You can describe the problem and attach the error logs.
