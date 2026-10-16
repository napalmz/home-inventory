# Home Inventory App

[🇮🇹 Italiano](#-italiano) · [🇬🇧 English](#-english)

---

## 🇮🇹 Italiano

Ho creato questa app per tenere un inventario condiviso degli oggetti di casa, ad esempio del contenuto del congelatore in garage o del mobile dei detersivi.

### Avvio

Per avviare il progetto con Docker, clona questo repository ed esegui:

```bash
docker-compose up --build -d
```

- API backend: <http://localhost:3000/api>
- Frontend: <http://localhost:3000>
- Credenziali predefinite: `admin` / `12345`

### Barcode e QR code

- Ogni articolo può avere più codici (EAN/UPC/QR e altri), gestibili dalla schermata di modifica.
- Il pulsante "Scansiona", nelle pagine inventario e checklist, consente di usare la fotocamera (desktop o mobile), un lettore USB/Bluetooth (che funziona come una tastiera) oppure l'inserimento manuale. La fotocamera richiede HTTPS (o localhost).
- Un codice sconosciuto consente di creare un nuovo articolo o associarlo a uno esistente. Ogni codice è univoco all'interno del proprio inventario.
- Ricerca dei dati EAN tramite Open Food Facts, Open Beauty Facts, Open Pet Food Facts e Open Products Facts: gratuita e senza chiave API, con cache locale. Si può disattivare impostando `BARCODE_LOOKUP_ENABLED=false`. Quando è attiva, i codici vengono inviati ai servizi esterni.

### Assegnazioni lista → inventario

- Dalla schermata di un articolo ("📋 Assegna") o da una lista ("📥 Da inventario") è possibile collegare una riga della lista a un articolo dell'inventario e indicare la quantità da prelevare.
- Spuntando la riga, la quantità assegnata viene sottratta dalla giacenza. Se la giacenza non è sufficiente, puoi scegliere se azzerarla o annullare l'operazione.
- Se deselezioni la riga entro 45 secondi, la giacenza viene ripristinata. Dopo 45 secondi, la giacenza non cambia e l'assegnazione torna attiva (utile per gli acquisti ricorrenti). Se riselezioni la riga entro 45 secondi dalla deselezione tardiva, l'operazione viene annullata senza sottrarre nuovamente la giacenza.
- Negli inventari, ogni riga mostra la giacenza lorda e quella netta (giacenza lorda meno le assegnazioni non ancora spuntate).

### Pubblicazione immagini Docker

Le immagini multi-architettura (amd64 e arm64) vengono pubblicate sia su Docker Hub sia su GitHub Container Registry (GHCR).

#### Con GitHub Actions (consigliato)

Il workflow [publish-images.yml](.github/workflows/publish-images.yml) pubblica le immagini in questi casi:

| Evento | Tag pubblicati |
|---|---|
| Push su `main` | `dev` e `<versione>-dev` |
| Push di un tag `v*` | `latest` e `<versione>` |
| Avvio manuale (**Actions → Publish Docker images → Run workflow**) | canale scelto, da qualsiasi branch |

Le versioni sono lette da `API_VERSION` in `backend/.env` e da `version` in `frontend/package.json`.

Configurazione necessaria:

- Secret del repository `DOCKERHUB_USERNAME` e `DOCKERHUB_TOKEN`.
- Per GHCR non serve alcun secret: il workflow usa il `GITHUB_TOKEN` con permesso `packages: write`. Ogni package GHCR deve concedere accesso **Write** al repository: in **Package settings → Manage Actions access** aggiungi `napalmz/home-inventory`.

#### Con lo script locale

Accedi a entrambi i registry:

```bash
docker login
docker login ghcr.io -u napalmz
```

Per GHCR usa un Personal Access Token (classic) di GitHub con permesso `write:packages` al posto della password. Poi esegui `./build_and_push.sh` per la release (tag `latest` e versione) oppure `./build_and_push.sh dev` per il canale di sviluppo (tag `dev` e versione `-dev`). Lo script chiede separatamente se costruire e pubblicare il backend e il frontend.

#### Collegamento al repository e visibilità

Entrambe le immagini includono la label OCI `org.opencontainers.image.source` con l'URL di questo repository. Per i package GHCR già creati, verifica o imposta il collegamento manualmente: nel profilo GitHub apri **Packages**, seleziona ciascun package (`home-inventory-backend` e `home-inventory-frontend`), fai clic su **Connect repository** e scegli `napalmz/home-inventory`.

Per rendere pubbliche le immagini, apri le **Package settings** di ciascun package e modifica la visibilità in **Public**. Il collegamento al repository e la visibilità sono impostazioni separate.

### Autori

- [@napalmz](https://www.github.com/napalmz)

---

## 🇬🇧 English

I built this app to keep a shared inventory of household items, such as the contents of a garage freezer or a cupboard with cleaning supplies.

### Getting started

To run this project with Docker, clone this repository and run:

```bash
docker-compose up --build -d
```

- Backend API: <http://localhost:3000/api>
- Frontend: <http://localhost:3000>
- Default credentials: `admin` / `12345`

### Barcodes and QR codes

- Each item can have multiple barcodes (EAN/UPC/QR and others), managed from the item edit screen.
- The "Scan" button on inventory and checklist pages lets you use a camera (desktop or mobile), a USB/Bluetooth barcode reader (which acts like a keyboard), or manual entry. Camera access requires HTTPS (or localhost).
- An unknown code can be used to create an item or link the code to an existing one. Each code must be unique within its inventory.
- EAN lookup uses Open Food Facts, Open Beauty Facts, Open Pet Food Facts, and Open Products Facts. It is free, requires no API key, and uses a local cache. Disable it by setting `BARCODE_LOOKUP_ENABLED=false`. When enabled, codes are sent to these external services.

### List-to-inventory assignments

- From an inventory item ("📋 Assign") or a shopping list ("📥 From inventory"), you can link a list entry to an inventory item and specify the quantity to take.
- Checking the entry subtracts the assigned quantity from the stock. If there is not enough stock, you can choose to set it to zero or cancel the action.
- Unchecking the entry within 45 seconds restores the stock. After 45 seconds, the stock remains unchanged and the assignment becomes active again (useful for recurring purchases). If you check the entry again within 45 seconds of a late uncheck, the action is cancelled without subtracting stock again.
- Inventory entries show both gross and net stock (gross stock minus assignments that have not yet been checked off).

### Publishing Docker images

Multi-platform images (amd64 and arm64) are published to both Docker Hub and GitHub Container Registry (GHCR).

#### With GitHub Actions (recommended)

The [publish-images.yml](.github/workflows/publish-images.yml) workflow publishes images in these cases:

| Event | Published tags |
|---|---|
| Push to `main` | `dev` and `<version>-dev` |
| Push of a `v*` tag | `latest` and `<version>` |
| Manual run (**Actions → Publish Docker images → Run workflow**) | selected channel, from any branch |

Versions are read from `API_VERSION` in `backend/.env` and `version` in `frontend/package.json`.

Required setup:

- Repository secrets `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN`.
- No secret is needed for GHCR: the workflow uses `GITHUB_TOKEN` with the `packages: write` permission. Each GHCR package must grant the repository **Write** access: under **Package settings → Manage Actions access**, add `napalmz/home-inventory`.

#### With the local script

Log in to both registries:

```bash
docker login
docker login ghcr.io -u napalmz
```

For GHCR, use a GitHub Personal Access Token (classic) with the `write:packages` permission instead of a password. Then run `./build_and_push.sh` for a release (`latest` and version tags), or `./build_and_push.sh dev` for the development channel (`dev` and `-dev` version tags). The script prompts separately whether to build and publish the backend and frontend.

#### Repository link and visibility

Both images include the OCI label `org.opencontainers.image.source` with this repository's URL. For existing GHCR packages, check or set the link manually: open **Packages** on your GitHub profile, select each package (`home-inventory-backend` and `home-inventory-frontend`), click **Connect repository**, and choose `napalmz/home-inventory`.

To make the images public, open **Package settings** for each package and change its visibility to **Public**. Repository linking and visibility are separate settings.

### Authors

- [@napalmz](https://www.github.com/napalmz)
