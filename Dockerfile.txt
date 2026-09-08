# --- Stage 1: Build del Frontend React ---
FROM node:20-alpine AS builder

WORKDIR /app

# Copia i file di configurazione delle dipendenze
COPY package.json ./

# Installa tutte le dipendenze (incluse devDependencies per la build)
RUN npm install

# Copia tutto il codice sorgente
COPY . .

# Compila l'applicazione React (genera la cartella /dist)
RUN npm run build-react

# --- Stage 2: Runtime Server Node.js ---
FROM node:20-alpine

WORKDIR /app

# Imposta l'ambiente in produzione
ENV NODE_ENV=production
ENV PORT=9301

# Copia package.json per installare solo le dipendenze di produzione
COPY package.json ./

# Installa solo le dipendenze necessarie per il server (Express, ecc.)
RUN npm install --production

# Copia lo script del server
COPY server.js ./

# Copia la build di React dallo stage precedente
COPY --from=builder /app/dist ./dist

# Espone la porta usata dal server
EXPOSE 9301

# Home Assistant mappa il volume persistente su /data
# Il server.js è già configurato per usare /data/immoplan_data.json se disponibile
VOLUME ["/data"]

# Avvia il server
CMD ["node", "server.js"]