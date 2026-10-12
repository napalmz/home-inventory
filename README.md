
# Home Inventory App

I needed an app to record inventories in my home, such as what's in the garage freezer or the detergent cabinet, in a shared way with my family.
So I created one!


## Deployment

To deploy this project using Docker, pull this repository and then run:

```bash
  docker-compose up --build -d
```

Backend API: <http://localhost:3000/api>

Frontend: <http://localhost:3000>

Default Login: admin/12345

## Barcode / QR code

- Più barcode (EAN/UPC/QR...) per ogni item, gestibili dalla modifica item.
- Pulsante "Scansiona" nella pagina inventario/checklist: fotocamera (desktop/mobile) oppure lettore USB/Bluetooth (tastiera) o inserimento manuale. La fotocamera richiede HTTPS (o localhost).
- Un codice sconosciuto permette di creare un nuovo item o associarlo a uno esistente; un codice è unico per inventario.
- Anagrafica EAN esterna: Open Food/Beauty/Pet Food/Products Facts (gratuita, senza chiave), con cache locale. Disattivabile con `BARCODE_LOOKUP_ENABLED=false` (i codici vengono inviati a servizi terzi).

## Assegnazioni lista → inventario

- Da un item di inventario ("📋 Assegna") o da una lista ("📥 Da inventario") si collega una riga di lista a un item di inventario, con la quantità da prelevare.
- Spuntando la riga lo stock dell'inventario scende della quantità assegnata. Se lo stock non basta, viene chiesto se azzerarlo o annullare la spunta.
- Togliendo la spunta entro 45 secondi lo stock viene ripristinato; dopo, resta invariato e l'assegnazione torna "in essere" (utile per acquisti ricorrenti).
- Negli inventari la riga mostra stock lordo e netto (lordo meno le assegnazioni non ancora spuntate).

## Authors

- [@napalmz](https://www.github.com/napalmz)