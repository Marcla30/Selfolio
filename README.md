# Portfolio Tracker

Full-stack investment tracking application inspired by Delta. Self-hosted, no subscription, no third-party account required.

## Fonctionnalités

### Actifs supportés

| Type | Exemples | Mise à jour des prix |
|---|---|---|
| **Cryptomonnaies** | BTC, ETH, SOL… | CoinGecko (batch, toutes les 30 min) |
| **Actions** | AAPL, AI.PA, LVMH… | Yahoo Finance (toutes les 30 min) |
| **ETF** | CW8, IWDA… | Yahoo Finance (toutes les 30 min) |
| **Métaux précieux** | XAU (or), XAG (argent) | Yahoo Finance via contrats futures GC=F / SI=F |
| **Devises / Cash** | USD, GBP, CHF… | Frankfurter (cours du jour) |
| **Skins CS2** | AK-47 Redline, Karambit… | market.csgo.com (bulk, toutes les 35 min) |
| **Autre** | Actif personnalisé | Prix manuel uniquement |

### Gestion du portefeuille

- Multi-portefeuille avec types (Crypto, Actions, ETF, Métaux, Mixte)
- Transactions : achat, vente, swap, transfert
- Historique des transactions par actif
- Calcul du prix de revient moyen pondéré (PAMP)
- P&L en valeur absolue et en pourcentage par position
- Export CSV des transactions
- Import CSV / Excel (format Bourse Direct supporté)
- Filtre par portefeuille et par type d'actif sur la page des positions

### Dashboard

- Valeur totale du portefeuille, coût total, P&L global
- Variation 24h
- Courbe de performance (24h, 7j, 30j, 1 an, tout)
- Répartition par categorie (allocation)
- Actualisation automatique toutes les 5 minutes

### Skins CS2 — mécanisme d'import

1. **Import initial** : saisir l'URL de profil Steam ou le SteamID64. L'application récupère l'inventaire CS2 complet (jusqu'à 3 000 items, paginé par 200 avec pause entre les pages pour éviter le rate-limit Steam). Chaque skin est créé comme un actif et une transaction d'achat est enregistrée au prix de marché actuel.
2. **Filtre minValue** : les skins dont `prix × quantité < minValue` sont ignorés à l'import (valeur par défaut : 1 €). Évite d'importer des centaines de stickers sans valeur.
3. **Re-sync delta** : après l'import initial, le bouton Re-sync compare l'inventaire Steam actuel avec les quantités déjà en portefeuille. Seuls les nouveaux skins ou les quantités supplémentaires sont importés. Les skins vendus ne sont pas touchés (la vente reste manuelle).
4. **Profils liés** : les paramètres d'import (portfolio cible, devise, minValue) sont mémorisés par profil Steam pour faciliter les re-syncs futurs.

### Surveillance de wallets

- Surveillance Bitcoin (blockchain.info) et Ethereum (Blockchair)
- Détection automatique des nouvelles transactions toutes les heures
- Notification push web (Web Push / VAPID) envoyée à la réception d'une nouvelle transaction
- La création de transaction en portefeuille reste manuelle (la surveillance est informative)

### Autres fonctionnalités

- **Mode confidentialité** : bouton dans la navbar pour flouter tous les montants (CSS blur), persiste entre les sessions
- **Snapshots de prix** : les prix sont enregistrés en base toutes les 30 minutes, utilisés pour reconstruire l'historique du graphique
- **Authentification** : sessions 30 jours + JWT pour usage mobile. Enregistrement désactivable via `REGISTRATION_ENABLED=false`
- **Thème sombre** (par défaut)

---

## APIs utilisées

### CoinGecko — Prix des cryptomonnaies
- **Endpoint :** `https://api.coingecko.com/api/v3/simple/price`
- **Pourquoi :** API publique gratuite, sans clé, avec support de plusieurs devises cibles et des prix en temps réel pour la quasi-totalité des cryptos.
- **Stratégie :** toutes les cryptos du portefeuille sont récupérées en un seul appel (batch par IDs séparés par virgule) pour minimiser le nombre de requêtes.
- **Limites :** tier gratuit non authentifié, environ 30 requêtes/minute. En cas de HTTP 429, l'application retombe sur le cache en mémoire (valeur expirée mais disponible).

### Yahoo Finance — Actions, ETF, Métaux
- **Endpoint :** `https://query1.finance.yahoo.com/v8/finance/chart/{symbol}`
- **Pourquoi :** accès gratuit et sans clé à la quasi-totalité des actions mondiales, ETF et contrats futures (or `GC=F`, argent `SI=F`). Détecte automatiquement la devise de cotation.
- **Limites :** endpoint non officiel, sans garantie de disponibilité. Pas de gestion de rate-limit explicite dans l'application. Peut être instable lors de pics de trafic Yahoo.

### CryptoCompare — Prix historiques crypto
- **Endpoint :** `https://min-api.cryptocompare.com/data/v2/histohour`
- **Pourquoi :** utilisé pour récupérer les prix historiques (graphique de performance) quand aucune valeur n'est disponible dans le cache local.
- **Limites :** tier gratuit non authentifié, 100 000 appels/mois. Données horaires uniquement.

### Frankfurter — Taux de change
- **Endpoint :** `https://api.frankfurter.app/latest?from={FROM}&to={TO}`
- **Pourquoi :** API gratuite basée sur les taux BCE (Banque Centrale Européenne), sans clé, utilisée pour convertir tous les prix vers la devise cible de l'utilisateur (USD → EUR pour les skins CS2, GBP → EUR pour les actions londoniennes, etc.).
- **Limites :** mise à jour une fois par jour (taux journaliers). Cache en mémoire de 30 minutes. Aucune limite de requêtes documentée.

### market.csgo.com — Prix des skins CS2
- **Endpoint :** `https://market.csgo.com/api/v2/prices/USD.json`
- **Pourquoi :** un seul appel récupère les prix en USD de ~24 000 items CS2 d'un coup, sans clé API. Très efficace pour un inventaire complet.
- **Limites :** données en USD uniquement (conversion via Frankfurter). Mis à jour fréquemment par la plateforme mais sans garantie de fraîcheur. Cache local de 35 minutes.

### Steam / Valve — Inventaire CS2, profil
- **Inventaire :** `https://steamcommunity.com/inventory/{steamId64}/730/2`
  - Paginé par 200 items, jusqu'à 15 pages (3 000 items max).
  - Pause de 1 500 ms entre chaque page pour éviter le rate-limit Steam.
  - **Limites :** HTTP 429 si trop de requêtes rapides. L'inventaire doit être **public** (paramètre de confidentialité Steam). Pas de clé API requise.
- **Résolution vanity URL :** `steamcommunity.com/id/{name}/?xml=1` (sans clé) ou API officielle `ResolveVanityURL` (avec `STEAM_API_KEY` optionnelle).
- **Nom de profil :** `https://steamcommunity.com/profiles/{steamId64}/?xml=1` — parsé à chaque import/re-sync.

### Blockchair — Surveillance Ethereum
- **Endpoint :** `https://api.blockchair.com/ethereum/dashboards/address/{address}`
- **Pourquoi :** API publique gratuite pour récupérer les transactions d'une adresse Ethereum.
- **Limites :** tier gratuit sans clé, ~1 500 requêtes/jour. Les erreurs sont silencieuses (retourne un tableau vide).

### blockchain.info — Surveillance Bitcoin
- **Endpoint :** `https://blockchain.info/rawaddr/{address}`
- **Pourquoi :** API publique gratuite pour les transactions Bitcoin.
- **Limites :** pas de limite documentée dans le code. Les erreurs sont silencieuses.

---

## Déploiement (serveur)

### Prérequis

- [Docker](https://docs.docker.com/engine/install/) et [Docker Compose](https://docs.docker.com/compose/install/)

### Étapes

**1. Cloner le dépôt**
```bash
git clone https://github.com/Marcla30/portfolio-tracker.git
cd portfolio-tracker
```

**2. Configurer l'environnement**
```bash
cp .env.example .env
```

Éditer `.env` et définir au minimum :
```env
POSTGRES_USER=portfolio
POSTGRES_PASSWORD=un_mot_de_passe_fort   # ← changer absolument
POSTGRES_DB=portfolio_tracker
DATABASE_URL=postgresql://portfolio:un_mot_de_passe_fort@db:5432/portfolio_tracker

# Générer avec : openssl rand -base64 32
SESSION_SECRET=
JWT_SECRET=
```

**3. Démarrer**
```bash
docker compose up -d
```

Le schéma de base de données est appliqué automatiquement au premier démarrage.

**4. Accéder à l'application**

Ouvrir `http://ip-du-serveur:3000` (ou le port `APP_PORT` configuré dans `.env`).

Créer un compte sur la page d'inscription. Désactiver l'inscription ensuite via `REGISTRATION_ENABLED=false` dans `.env` puis redémarrer.

### Mise à jour

```bash
git pull
docker compose up -d --build
```

### Commandes utiles

```bash
# Voir les logs
docker compose logs -f app

# Arrêter
docker compose down

# Arrêter et supprimer toutes les données (irréversible)
docker compose down -v
```

---

## Développement local

```bash
npm install
cp .env.example .env
# Éditer .env avec DATABASE_URL pointant vers une instance Postgres locale
npx prisma migrate dev
npm run dev
```

Avec Docker et rechargement à chaud :
```bash
cat > docker-compose.override.yml <<EOF
services:
  app:
    volumes:
      - ./src:/app/src
      - ./public:/app/public
EOF
docker compose up -d
```

---

## Stack technique

- **Backend :** Node.js, Express, Prisma ORM, PostgreSQL
- **Frontend :** Vanilla JS, Chart.js
- **Déploiement :** Docker, Docker Compose

## Architecture

```
/src
  /routes       - Gestionnaires de routes API
  /services     - Logique métier (prix, wallets, CS2…)
  /middleware   - Authentification
  /jobs         - Cron jobs (snapshots de prix, sync wallets)
/public
  /controllers  - Contrôleurs frontend (SPA)
  /services     - Client API frontend
  /styles       - CSS
/prisma
  schema.prisma - Schéma de base de données
```
