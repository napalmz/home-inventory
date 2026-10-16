
# Home Inventory App / Inventario domestico

**IT** — Ho creato questa app per tenere un inventario condiviso degli oggetti di casa, ad esempio del contenuto del congelatore in garage o del mobile dei detersivi.

**EN** — I built this app to keep a shared inventory of household items, such as the contents of a garage freezer or a cupboard with cleaning supplies.

## Avvio / Getting started

**IT** — Per avviare il progetto con Docker, clona questo repository ed esegui:

**EN** — To run this project with Docker, clone this repository and run:

```bash
docker-compose up --build -d
```

**IT** — API backend: <http://localhost:3000/api>

**EN** — Backend API: <http://localhost:3000/api>

**IT** — Frontend: <http://localhost:3000>

**EN** — Frontend: <http://localhost:3000>

**IT** — Credenziali predefinite: `admin` / `12345`

**EN** — Default credentials: `admin` / `12345`

### Pubblicazione immagini Docker / Publishing Docker images

**IT** — Lo script `build_and_push.sh` pubblica le immagini multi-architettura (amd64 e arm64) sia su Docker Hub sia su GitHub Container Registry (GHCR). Prima di eseguirlo, accedi a entrambi i registry:

**EN** — The `build_and_push.sh` script publishes multi-platform images (amd64 and arm64) to both Docker Hub and GitHub Container Registry (GHCR). Before running it, log in to both registries:

```bash
docker login
docker login ghcr.io -u napalmz
```

**IT** — Per GHCR, usa un Personal Access Token di GitHub con permesso `write:packages` al posto della password. Esegui `./build_and_push.sh` per la release (tag `latest` e versione) oppure `./build_and_push.sh dev` per il canale di sviluppo (tag `dev` e versione `-dev`). Lo script chiede separatamente se costruire e pubblicare il backend e il frontend.

**EN** — For GHCR, use a GitHub Personal Access Token with the `write:packages` permission instead of a password. Run `./build_and_push.sh` for a release (`latest` and version tags), or `./build_and_push.sh dev` for the development channel (`dev` and `-dev` version tags). The script prompts separately whether to build and publish the backend and frontend.

**IT** — Entrambe le immagini includono la label OCI `org.opencontainers.image.source` con l'URL di questo repository. Per i package GHCR già creati, verifica o imposta il collegamento manualmente: nel profilo GitHub apri **Packages**, seleziona ciascun package (`home-inventory-backend` e `home-inventory-frontend`), fai clic su **Connect repository** e scegli `napalmz/home-inventory`. La label non cambia la visibilità del package.

**EN** — Both images include the OCI label `org.opencontainers.image.source` with this repository's URL. For existing GHCR packages, check or set the link manually: open **Packages** on your GitHub profile, select each package (`home-inventory-backend` and `home-inventory-frontend`), click **Connect repository**, and choose `napalmz/home-inventory`. The label does not change package visibility.

**IT** — Per rendere pubbliche le immagini GHCR, apri le **Package settings** di ciascun package e modifica la visibilità in **Public**. Il collegamento al repository e la visibilità sono impostazioni separate: ripeti entrambe le operazioni per backend e frontend.

**EN** — To make the GHCR images public, open **Package settings** for each package and change its visibility to **Public**. Repository linking and visibility are separate settings; repeat both steps for the backend and frontend packages.

## Barcode e QR code / Barcodes and QR codes

**IT**

- Ogni articolo può avere più codici (EAN/UPC/QR e altri), gestibili dalla schermata di modifica.
- Il pulsante "Scansiona", nelle pagine inventario e checklist, consente di usare la fotocamera (desktop o mobile), un lettore USB/Bluetooth (che funziona come una tastiera) oppure l'inserimento manuale. La fotocamera richiede HTTPS (o localhost).
- Un codice sconosciuto consente di creare un nuovo articolo o associarlo a uno esistente. Ogni codice è univoco all'interno del proprio inventario.
- Ricerca dei dati EAN tramite Open Food Facts, Open Beauty Facts, Open Pet Food Facts e Open Products Facts: gratuita e senza chiave API, con cache locale. Si può disattivare impostando `BARCODE_LOOKUP_ENABLED=false`. Quando è attiva, i codici vengono inviati ai servizi esterni.

**EN**

- Each item can have multiple barcodes (EAN/UPC/QR and others), managed from the item edit screen.
- The "Scan" button on inventory and checklist pages lets you use a camera (desktop or mobile), a USB/Bluetooth barcode reader (which acts like a keyboard), or manual entry. Camera access requires HTTPS (or localhost).
- An unknown code can be used to create an item or link the code to an existing one. Each code must be unique within its inventory.
- EAN lookup uses Open Food Facts, Open Beauty Facts, Open Pet Food Facts, and Open Products Facts. It is free, requires no API key, and uses a local cache. Disable it by setting `BARCODE_LOOKUP_ENABLED=false`. When enabled, codes are sent to these external services.

## Assegnazioni lista → inventario / List-to-inventory assignments

**IT**

- Dalla schermata di un articolo ("📋 Assegna") o da una lista ("📥 Da inventario") è possibile collegare una riga della lista a un articolo dell'inventario e indicare la quantità da prelevare.
- Spuntando la riga, la quantità assegnata viene sottratta dalla giacenza. Se la giacenza non è sufficiente, puoi scegliere se azzerarla o annullare l'operazione.
- Se deselezioni la riga entro 45 secondi, la giacenza viene ripristinata. Dopo 45 secondi, la giacenza non cambia e l'assegnazione torna attiva (utile per gli acquisti ricorrenti). Se riselezioni la riga entro 45 secondi dalla deselezione tardiva, l'operazione viene annullata senza sottrarre nuovamente la giacenza.
- Negli inventari, ogni riga mostra la giacenza lorda e quella netta (giacenza lorda meno le assegnazioni non ancora spuntate).

**EN**

- From an inventory item ("📋 Assign") or a shopping list ("📥 From inventory"), you can link a list entry to an inventory item and specify the quantity to take.
- Checking the entry subtracts the assigned quantity from the stock. If there is not enough stock, you can choose to set it to zero or cancel the action.
- Unchecking the entry within 45 seconds restores the stock. After 45 seconds, the stock remains unchanged and the assignment becomes active again (useful for recurring purchases). If you check the entry again within 45 seconds of a late uncheck, the action is cancelled without subtracting stock again.
- Inventory entries show both gross and net stock (gross stock minus assignments that have not yet been checked off).

## Autori / Authors

- [@napalmz](https://www.github.com/napalmz)