# Changelog

Tutte le modifiche rilevanti a **MM's PROPERTY Manager (ImmoPlan)** sono documentate in questo file.

## [1.6.1] - 2026-10-27

### ⚙️ Gestione & Personalizzazione
- **Attivazione / Disattivazione Funzionalità & Visualizzazione Radar Tassi:**
  - Aggiunto nel pannello **Admin** (sezione *Scadenziario Canoni & Bot Telegram*) un interruttore master per abilitare o disabilitare l'intera funzionalità e visualizzazione di *"📡 RADAR TASSI BANCHE · ITALIA & MILANO"*.
  - Quando disattivato, tutti i componenti visuali del Radar vengono completamente nascosti nell'applicazione (pulsante in alto *"📡 Radar Tassi & Banche Milano"*, banner riassuntivo del portafoglio e blocco di confronto offerte nella Scheda Economica dei singoli immobili), con sospensione delle scansioni e dei report automatici.
  - Sincronizzazione atomica e istantanea in tempo reale tra la pagina Admin e la scheda Patrimonio.

---

## [1.6.0] - 2026-10-27

### 🚀 Nuove Funzionalità
- **Storico Surroghe & Rinegoziazioni Mutuo Multi-Evento:**
  - Possibilità di registrare una o più surroghe/rinegoziazioni cronologiche per ciascun immobile (data di decorrenza, nuova banca, nuova rata mensile, nuovo TAN %, tasso Fisso/Variabile, nuova durata in anni, capitale residuo e contratto PDF allegato).
  - Risoluzione temporale automatica su *Dashboard Patrimonio*, *Scheda Economica Immobile*, *Registro Affitti*, *Calendario Scadenze* e *Simulatore Previsionale a 10 Anni*: i periodi precedenti alla data di surroga mantengono la rata originaria, mentre i periodi successivi applicano la rata surrogata attiva.
  - Calcolo automatico del risparmio mensile (`€/mese`), annuo (`€/anno`) e complessivo residuo rispetto al mutuo precedente e a quello originario.
- **Radar Tassi Mutui Banche (Italia & Milano) & Notifiche Telegram:**
  - Monitoraggio di **19 offerte di surroga** (Tasso Fisso, Variabile e Mutuo Green Classe A/B) delle principali banche nazionali e della piazza di Milano (*BCC Milano - Gruppo BCC Iccrea*, *Banco BPM Milano*, *Webank Gruppo Banco BPM*, *Intesa Sanpaolo*, *UniCredit*, *Mediobanca Premier*, *Crédit Agricole Italia*, *BPER Banca*, *BNL BNP Paribas*, *FinecoBank*, *ING*, *Credem*, *Banca Sella*).
  - Aggiornamento indici di mercato (**Eurirs 10A/15A/20A/25A/30A**, **Euribor 3M**, **Tasso BCE**) con supporto opzionale a Google Gemini Search Grounding.
  - Confronto automatico con i mutui attivi del portafoglio (calcolo nuova rata alla francese, LTV, delta tasso e risparmio netto) e pulsante **"Usa per Surroga"** per pre-compilare in 1 click la scheda di surroga.
  - **Report Telegram Automatico e Manuale:** invio di report formattati su Telegram quando vengono rilevate offerte vantaggiose oltre le soglie configurate (`€/mese` e riduzione `%` TAN), con job periodico in background e anti-spam cooldown.
  - **Nuovo Sensore Home Assistant:** esposizione di `sensor.immoplan_radar_mutui` con il conteggio delle opportunità di surroga e i dettagli della migliore offerta per ogni immobile.

---

## [1.5.6] - 2026-10-20

### ✨ Miglioramenti
- **Valutazioni Storiche Multi-Ancora nel Motore Previsionale:** interpolazione esponenziale CAGR tra il prezzo di acquisto e tutte le valutazioni manuali registrate nello storico immobile, con proiezione futura a partire dall'ultima perizia reale.
- **Simulazione Estinzione Parziale Mutuo & Scomposizione Rata:**
  - Simulatore di versamento straordinario (abbattimento rata vs riduzione durata) con calcolo degli interessi totali risparmiati.
  - Scomposizione annuale e cumulata tra **Quota Capitale** e **Quota Interessi** nei grafici e nella tabella previsionale a 10 anni.
  - Calcolo proporzionale dei mesi di effettivo possesso e delle rate mutuo pagate nel 1° anno di acquisto.

---

## [1.5.0] - 2026-09-15

### 🚀 Nuove Funzionalità
- **Motore Previsionale Dinamico a 10 Anni (`MarketForecaster`):**
  - Proiezioni multi-anno di Valore Immobile, Debito Mutuo Residuo, Equità Netta e Cashflow Netto con integrazione dati ISTAT/OMI e Direttiva UE "Case Verdi".
  - Benchmark comparativo con **ETF MSCI World** sul capitale proprio investito.
  - Supporto contratti di comodato d'uso / tassazione esente (0%) e regimi Cedolare Secca (21% / 10%) o IRPEF ordinaria.
- **Centro Guide & Manuali Interattivo (`HelpCenter`):** documentazione in-app con ricerca rapida `Cmd+K` e 3 calcolatori finanziari integrati.

---

## [1.4.0] - 2026-09-08

### 🚀 Nuove Funzionalità
- **Archivio Fatture & Detrazioni Fiscali 730 (`InvoiceTaxArchive`):**
  - Tracciamento fatture, bonifici parlanti, codici CRO/TRN, allegati PDF e ripartizione quote tra cointestatari.
  - Selettore dinamico dell'anno fiscale per il calcolo della rata annuale 730 ed export Excel/CSV.
- **Calendario Scadenze Multi-Immobile (`CalendarManager`)** e **Pannello Admin Bento Grid** con anagrafica cointestatari personalizzabile.
