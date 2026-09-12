import { HelpArticle, FaqItem, HelpCategoryInfo, HelpCategory } from '../types';

export const HELP_CATEGORIES: HelpCategoryInfo[] = [
  {
    id: 'GETTING_STARTED',
    label: 'Primi Passi & Panoramica',
    icon: '🚀',
    description: 'Architettura dell\'app, flussi operativi e configurazione iniziale multi-utente.',
    badgeColor: 'from-blue-500 to-indigo-600'
  },
  {
    id: 'FORECASTER',
    label: 'Motore Previsionale & Trend 10 Anni',
    icon: '📈',
    description: 'Algoritmi di mercato, Direttiva Case Verdi UE, ammortamento mutuo, ROE e benchmark ETF.',
    badgeColor: 'from-emerald-500 to-teal-600'
  },
  {
    id: 'PROPERTY_MGMT',
    label: 'Gestione Immobili, Contratti & Affitti',
    icon: '🏢',
    description: 'Dati catastali, registro locazioni, contratti 4+4 / 3+2, ripartizione spese e solleciti.',
    badgeColor: 'from-amber-500 to-orange-600'
  },
  {
    id: 'TAXES_BONUS',
    label: 'Fisco, Cedolare Secca & Detrazioni 730',
    icon: '🧾',
    description: 'Regimi fiscali, Bonus 50%, Ecobonus 65%, bonifico parlante e detrazioni prima casa.',
    badgeColor: 'from-purple-500 to-pink-600'
  },
  {
    id: 'HOME_ASSISTANT',
    label: 'Home Assistant, Sensori & Webhook',
    icon: '🤖',
    description: 'Setup add-on, sensori REST in configuration.yaml, notifiche push e automazioni smart.',
    badgeColor: 'from-cyan-500 to-blue-600'
  },
  {
    id: 'FAQ_TROUBLESHOOTING',
    label: 'FAQ & Risoluzione Problemi',
    icon: '❓',
    description: 'Risposte immediate ai dubbi più comuni, backup selettivo e risoluzione anomalie.',
    badgeColor: 'from-slate-500 to-gray-700'
  }
];

export const HELP_ARTICLES: HelpArticle[] = [
  {
    id: 'start_architecture',
    title: 'Architettura di ImmoPlan & Modalità Operative',
    category: 'GETTING_STARTED',
    summary: 'Scopri come funziona ImmoPlan in modalità Desktop e come Add-on Home Assistant, con storage locale sicuro in IndexedDB.',
    tags: ['Architettura', 'IndexedDB', 'Backup', 'Privacy', 'Add-on'],
    readTimeMinutes: 4,
    featured: true,
    relatedArticleIds: ['start_workflow', 'troubleshoot_backup_persistence'],
    content: `### 1. Architettura Ibrida ad Elevata Privacy

ImmoPlan è concepito secondo il paradigma **Local-First**: tutti i dati catastali, contratti, importi di mutuo, fatture e note riservate rimangono memorizzati nel database locale del browser o dell'istanza Home Assistant (**IndexedDB**).

#### Modalità di Esecuzione
1. **Applicazione Desktop (Electron)**: Avvio ultra-veloce su Windows, Mac o Linux senza dipendere da connessione Internet per l'archiviazione.
2. **Add-on Home Assistant OS**: Server integrato Node.js / Express accessibile via porta protetta (Ingress) all'interno dell'ecosistema domotico di casa.

#### Gestione Multi-Proprietario (Giuseppe & Claudia)
ImmoPlan supporta la profilazione a due titolari con:
- **Portafogli separati**: tracciamento dei fondi personali di ciascun proprietario.
- **Ripartizione delle spese**: quote percentuali personalizzabili (50/50, 70/30, 100% singolo titolare) per acquisti, notai, imposte e fatture di ristrutturazione.
- **Riconciliazione bancaria**: monitoraggio dello stato di pagamento (saldato / in attesa).`
  },
  {
    id: 'start_workflow',
    title: 'Flusso Operativo: Dall\'Analisi di Acquisto alla Gestione Quotidiana',
    category: 'GETTING_STARTED',
    summary: 'Guida passo-passo alle fasi di investimento: simulazione scenari, rogito, ristrutturazione e messa a reddito.',
    tags: ['Workflow', 'Scenari', 'Acquisto', 'Ciclo di Vita'],
    readTimeMinutes: 5,
    relatedArticleIds: ['start_architecture', 'forecaster_market_engine', 'property_mgmt_assets'],
    content: `### Il Ciclo di Vita dell'Investimento Immobiliare in ImmoPlan

ImmoPlan ti accompagna lungo tutte le 5 fasi fondamentali di un'operazione immobiliare:

#### Fase 1: Simulazione e Scenari (Tab "Acquisto")
Prima di formulare una proposta di acquisto, usa l'**Editor Dati** per configurare:
- Prezzo di acquisto concordato e percentuale di mutuo (LTV tipico 80%).
- Costi accessori (imposta di registro/IVA, parcella notaio acquisto e notaio mutuo, provvigione agenzia).
- Preventivo lavori di ristrutturazione suddiviso per opere murarie, finiture, progettazione e imprevisti.
- Salva molteplici versioni come **Scenari Indipendenti** per confrontare opzioni prima di decidere.

#### Fase 2: Rogito e Consegna Chiavi
All'avvenuto acquisto, converti l'operazione in un'unità gestita registrando:
- Anagrafica catastale completa (foglio, particella, subalterno).
- Data del rogito e mutuo ipotecario stipulato.

#### Fase 3: Ristrutturazione & Tracciamento Fatture (Tab "Fatture & Detrazioni")
- Archiviazione di ogni fattura di cantiere con aliquota agevolata (10% per beni significativi/posa).
- Tracciamento della tipologia di pagamento tramite **Bonifico Parlante**.
- Calcolo automatico della quota di detrazione 730 spettante per i successivi 10 anni.

#### Fase 4: Messa a Reddito & Locazione (Tab "Patrimonio -> Affitti")
- Registrazione inquilini con scadenze contrattuali (4+4, 3+2, transitorio).
- Monitoraggio incassi mensili, spese condominiali a carico dell'inquilino e imposta di registro/cedolare.

#### Fase 5: Monitoraggio Finanziario & Forecaster
- Proiezione a 10 anni con il modulo **MarketForecaster** per verificare la creazione di equità e il ROE effettivo.`
  },
  {
    id: 'forecaster_market_engine',
    title: 'Motore Previsionale Finanziario (MarketForecaster): Architettura & Parametri',
    category: 'FORECASTER',
    summary: 'Come funziona il calcolo a 10 anni: rivalutazione deterministica, micro-mercato OMI/ISTAT e scenari tassi BCE.',
    tags: ['Forecaster', 'OMI', 'ISTAT', 'Algoritmo', 'BCE', 'Trend 10 Anni'],
    readTimeMinutes: 7,
    featured: true,
    relatedArticleIds: ['forecaster_case_verdi', 'forecaster_mortgage_amortization', 'forecaster_roe_etf'],
    content: `### 1. Fondamenti Matematici della Simulazione 1-10 Anni

Il modulo **MarketForecaster** genera una simulazione finanziaria decennale combinando fattori macroeconomici, metriche territoriali e vincoli normativi europei.

#### Formula del Valore Futuro dell'Immobile $V(t)$
Il valore stimato dell'immobile all'anno $t$ ($t \\in [1, 10]$) è calcolato con la formula a interesse composto:

$$\\mathbf{V(t) = V_0 \\times (1 + g_{\\text{netto}})^t}$$

Dove:
- **$V_0$**: Valore attuale di perizia o prezzo di acquisto totale.
- **$g_{\\text{netto}}$**: Tasso di crescita annuo netto determinato dalla somma di 4 componenti:

$$\\mathbf{g_{\\text{netto}} = g_{\\text{base}} + \\Delta_{\\text{BCE}} + \\Delta_{\\text{Energy}} + \\Delta_{\\text{Size}}}$$

---

### 2. Le 4 Componenti del Tasso di Rivalutazione

#### Componente 1: Micro-Mercato Base ($g_{\\text{base}}$)
Basato sulle quotazioni **OMI (Osservatorio del Mercato Immobiliare)** dell'Agenzia delle Entrate e sulle serie storiche **ISTAT** per la micro-zona:
- Tasso di crescita tendenziale dei prezzi (default storico nazionale: +1.8% annuo).
- Trend demografico locale (+0.3% annuo nelle aree urbane ad alta attrattività).
- $g_{\\text{base}} = 0.018 + 0.003 = +2.1\\%$.

#### Componente 2: Scenario Tassi BCE ($\\Delta_{\\text{BCE}}$)
Imposta la politica monetaria della Banca Centrale Europea:
- **Tassi in Aumento (RISING)**: penalizzazione $\\Delta_{\\text{BCE}} = -0.75\\%$ annuo sui prezzi (stretta creditizia) e aumento di $+0.75\\%$ sul tasso del mutuo.
- **Tassi in Discesa (FALLING)**: spinta $\\Delta_{\\text{BCE}} = +0.75\\%$ annuo sui prezzi (maggiore liquidità bancaria) e riduzione di $-0.75\\%$ sui mutui.
- **Tassi Stabili (STABLE)**: impatto $\\Delta_{\\text{BCE}} = 0.0\\%$.

#### Componente 3: Taglio e Superficie ($\\Delta_{\\text{Size}}$)
- Immobili compatti (< 65 mq, bilocali/monolocali): $\\Delta_{\\text{Size}} = +0.3\\%$ per elevata liquidità di mercato e domanda studentesca/lavorativa.
- Immobili ampi (> 120 mq): $\\Delta_{\\text{Size}} = -0.2\\%$ per minor bacino di acquirenti e maggiori costi di gestione.

---

### 3. Fasce di Tolleranza Monte Carlo (Scenari Ottimistico & Pessimistico)
Per ciascun anno di previsione, ImmoPlan genera un corridoio di incertezza:
- **Scenario Ottimistico**: $V_{\\text{opt}}(t) = V(t) \\times (1.02)^t$ (+2% annuo cumulato).
- **Scenario Pessimistico**: $V_{\\text{pes}}(t) = V(t) \\times (0.98)^t$ (-2% annuo cumulato).`
  },
  {
    id: 'forecaster_case_verdi',
    title: 'Direttiva UE "Case Verdi" (EPBD): Algoritmo di Calcolo Bonus/Malus',
    category: 'FORECASTER',
    summary: 'Approfondimento tecnico sull\'impatto della direttiva europea sulle classi energetiche A/B vs E/F/G.',
    tags: ['Case Verdi', 'EPBD', 'Classe Energetica', 'Bonus Green', 'Svalutazione'],
    readTimeMinutes: 6,
    featured: true,
    relatedArticleIds: ['tax_bonus_edilizi', 'forecaster_market_engine'],
    content: `### La Direttiva Europea EPBD IV ("Case Verdi")

La normativa europea approvata dal Parlamento UE impone standard progressivi di riduzione dei consumi energetici del parco immobiliare residenziale entro il 2030 e il 2035.

Nel modulo MarketForecaster di ImmoPlan, la classe energetica dell'immobile non è un mero dato descrittivo, ma un **moltiplicatore finanziario dinamico**.

---

### La Matrice di Impatto Energetico $\\Delta_{\\text{Energy}}$

| Classe Energetica | Impatto Annuo ($\\Delta_{\\text{Energy}}$) | Effetto Composto a 10 Anni | Motivazione Tecnica |
| :--- | :---: | :---: | :--- |
| **Classe A4, A3, A2, A1, B** | **+1.5% annuo** | **+16.05% di premio** | Immobili a emissioni quasi zero (NZEB), mutui green agevolati dalle banche, elevata richiesta di mercato. |
| **Classe C, D** | **0.0% (Neutro)** | **0.00%** | Conformità standard temporanea; manutenzione ordinaria sostenibile. |
| **Classe E, F, G** | **-2.0% annuo** | **-18.29% di sconto** | "Brown Discount": svalutazione dovuta al costo futuro obbligatorio di riqualificazione energetica. |

---

### Esempio Pratico di Calcolo

Immaginiamo un immobile acquistato a **200.000 €**:

1. **Se l'immobile è in Classe G**:
   - Perdita di valore annua da penalizzazione energetica: circa $-4.000$ €/anno.
   - Dopo 10 anni, la sola penalizzazione europea sottrae circa **36.500 €** rispetto al trend naturale di mercato.

2. **Se si effettua una Riqualificazione Energetica (da Classe G a Classe A)**:
   - CapEx stimato di ristrutturazione: 35.000 € (ammortizzabile con Ecobonus 65%).
   - Delta prestazionale: da $-2.0\\%$ a $+1.5\\%$ = **+3.5% di incremento annuo netto sul rendimento**!
   - In 10 anni l'immobile riqualificato guadagna oltre **70.000 € di differenziale patrimoniale** rispetto all'immobile non riqualificato.`
  },
  {
    id: 'forecaster_mortgage_amortization',
    title: 'Ammortamento Francese: Formula della Rata Costante & Debito Residuo',
    category: 'FORECASTER',
    summary: 'Analisi matematica del piano di ammortamento a rata costante, quota capitale, interessi e calcolo dell\'equità.',
    tags: ['Mutuo', 'Ammortamento Francese', 'Rata', 'Equità Netta', 'Formula'],
    readTimeMinutes: 7,
    relatedArticleIds: ['forecaster_roe_etf', 'tax_cedolare_vs_irpef'],
    content: `### 1. Il Principio dell'Ammortamento Francese

Il piano di ammortamento francese è il modello standard adottato dagli istituti di credito italiani:
- La **rata complessiva mensile è costante** per tutta la durata del finanziamento.
- La **quota capitale è crescente nel tempo** (all'inizio si rimborsa poco capitale e molti interessi).
- La **quota interessi è decrescente** (calcolata sempre sul debito residuo del mese precedente).

---

### 2. Formula Matematica della Rata Mensile ($R$)

Dati:
- $P$: Capitale finanziato erogato dalla banca (es. 160.000 €).
- $i_{\\text{annuo}}$: Tasso nominale annuo in percentuale (es. 3.5%).
- $r = \\frac{i_{\\text{annuo}}}{12 \\times 100}$: Tasso di interesse periodico mensile (es. $3.5 / 1200 = 0.0029167$).
- $n = \\text{durata in anni} \\times 12$: Numero complessivo di rate mensili (es. 20 anni = 240 rate).

La rata periodica $R$ è:

$$\\mathbf{R = P \\times \\frac{r \\times (1 + r)^n}{(1 + r)^n - 1}}$$

---

### 3. Formula del Debito Residuo all'Anno $k$ ($D_k$)

All'anno $k$ (dopo $m = k \\times 12$ rate pagate), il debito residuo ancora dovuto alla banca è calcolato con la formula attuariale della rendita residua:

$$\\mathbf{D(m) = P \\times \\frac{(1 + r)^n - (1 + r)^m}{(1 + r)^n - 1}}$$

Oppure, ricavato dalla rata mensile:

$$\\mathbf{D(m) = R \\times \\frac{1 - (1 + r)^{-(n - m)}}{r}}$$

---

### 4. Calcolo dell'Equità Netta Patrimoniale (Net Equity)

L'equità netta rappresenta il valore reale di cui sei effettivamente proprietario al netto del debito bancario:

$$\\mathbf{\\text{Equità Netta}(t) = V(t) - D(t)}$$

All'anno zero, l'equità corrisponde al capitale proprio versato (anticipo 20%). Con il passare degli anni, l'equità aumenta per due forze convergenti:
1. **Rivalutazione del bene**: $V(t)$ cresce.
2. **Deleverage (riduzione del debito)**: $D(t)$ scende verso 0.`
  },
  {
    id: 'forecaster_roe_etf',
    title: 'ROE (Return on Equity) vs ROI e Benchmark Competitivo ETF World',
    category: 'FORECASTER',
    summary: 'Comprendi la leva finanziaria immobiliare: formula del ROE su capitale proprio e confronto con un ETF azionario globale.',
    tags: ['ROE', 'ROI', 'ETF World', 'Leva Finanziaria', 'Benchmark', 'Rendimento'],
    readTimeMinutes: 6,
    relatedArticleIds: ['forecaster_market_engine', 'forecaster_mortgage_amortization'],
    content: `### 1. Differenza tra ROI e ROE

- **ROI (Return on Investment)**: Rendimento complessivo generato dall'asset rispetto al valore totale dell'immobile:
  $$\\text{ROI} = \\frac{\\text{Reddito Operativo Netto Annuo}}{\\text{Costo Totale Immobile}} \\times 100$$
- **ROE (Return on Equity)**: Rendimento effettivo generato **esclusivamente sul capitale proprio (Cash Equity)** versato dai proprietari:
  $$\\mathbf{ROE = \\frac{\\text{Incremento Equità} + \\text{Cash Flow Netto Cumulato}}{\\text{Capitale Proprio Iniziale}} \\times 100}$$

#### L'Effetto Leva Finanziaria (Leverage)
Se acquisti una casa da **200.000 €** impiegando solo **40.000 €** di capitale proprio (anticipo 20%) e 160.000 € di mutuo:
- Se l'immobile si rivaluta del **3% in un anno** (+6.000 € di valore).
- Sul valore totale il guadagno è il 3% (ROI).
- Ma sui tuoi 40.000 € reali investiti, 6.000 € rappresentano un **guadagno del 15% (ROE)**!

---

### 2. Il Benchmark Competitivo: ETF MSCI World (7.0% Annuo)

Per verificare se l'investimento immobiliare è finanziariamente vantaggioso, ImmoPlan calcola in ogni istante cosa sarebbe successo se avessi investito il tuo capitale proprio iniziale ($E_0$) in un **ETF azionario diversificato globale ad accumulazione** (es. MSCI World / FTSE All-World):

$$\\mathbf{V_{\\text{ETF}}(t) = E_0 \\times (1 + r_{\\text{ETF}})^t}$$

Dove di default $r_{\\text{ETF}} = 7.0\\%$ annuo (rendimento medio storico reale dei mercati azionari mondiali a lungo termine).

#### La Condizione di Vittoria dell'Immobile
L'investimento immobiliare batte il mercato azionario quando:

$$\\mathbf{\\text{Equità Netta}(t) + \\text{Cash Flow Cumulato}(t) > V_{\\text{ETF}}(t)}$$

Grazie alla leva del mutuo e ai flussi d'affitto netti indicizzati all'inflazione ISTAT, l'operazione immobiliare ben selezionata genera un alpha competitivo rispetto al mercato passivo.`
  },
  {
    id: 'property_mgmt_assets',
    title: 'Gestione Patrimonio: Dati Catastali, Rendita & Valore Fiscale',
    category: 'PROPERTY_MGMT',
    summary: 'Come censire correttamente gli immobili: foglio, particella, subalterno, rendita catastale e valore fiscale prima/seconda casa.',
    tags: ['Catasto', 'Rendita', 'Valore Catastale', 'Patrimonio', 'IMU'],
    readTimeMinutes: 5,
    relatedArticleIds: ['property_mgmt_rentals', 'tax_cedolare_vs_irpef'],
    content: `### 1. I Parametri Catastali Essenziali

Nel modulo **Patrimonio**, per ciascun immobile censito è possibile registrare:
- **Foglio, Particella e Subalterno**: le coordinate univoche catastali indicate nell'atto di compravendita.
- **Categoria Catastale**:
  - \`A/2\`: Abitazione di tipo civile.
  - \`A/3\`: Abitazione di tipo economico.
  - \`A/7\`: Abitazioni in villini.
  - \`C/6\`: Box, autorimesse o posti auto pertinenziali.
- **Rendita Catastale (€)**: il reddito annuo teorico attribuito dall'Agenzia delle Entrate all'immobile.

---

### 2. Calcolo del Valore Catastale Fiscale

Il valore catastale è fondamentale per il calcolo delle imposte di registro, dell'IMU e delle imposte di successione:

#### Regola "Prezzo-Valore" (Acquisto tra privati)
- **Prima Casa**:
  $$\\text{Valore Catastale} = \\text{Rendita} \\times 1.05 \\times 110$$
  *(Moltiplicatore catastale agevolato: 115.5)*
- **Seconda Casa**:
  $$\\text{Valore Catastale} = \\text{Rendita} \\times 1.05 \\times 120$$
  *(Moltiplicatore catastale ordinario: 126.0)*

#### Imposta di Registro:
- Prima Casa: **2%** sul Valore Catastale (minimo 1.000 €).
- Seconda Casa: **9%** sul Valore Catastale (minimo 1.000 €).`
  },
  {
    id: 'property_mgmt_rentals',
    title: 'Contratti di Locazione: Canone Libero (4+4) vs Concordato (3+2) & Gestione Inquilini',
    category: 'PROPERTY_MGMT',
    summary: 'Differenze normative tra contratti, calcolo degli adeguamenti ISTAT FOI e monitoraggio morosità.',
    tags: ['Affitti', 'Contratti', 'Canone Concordato', 'Inquilini', 'ISTAT FOI'],
    readTimeMinutes: 6,
    relatedArticleIds: ['tax_cedolare_vs_irpef', 'property_mgmt_assets'],
    content: `### 1. Principali Tipologie Contrattuali Residenziali

| Tipologia Contratto | Durata Normativa | Canone | Vantaggio Fiscale Principale |
| :--- | :--- | :--- | :--- |
| **Canone Libero (4+4)** | 4 anni + rinnovo 4 anni | Libero accordo di mercato | Flessibilità di prezzo massima; Cedolare Secca al **21%**. |
| **Canone Concordato (3+2)** | 3 anni + rinnovo 2 anni | Vincolato ad accordi territoriali comunali | **Cedolare Secca agevolata al 10%** + sconto IMU 25%. |
| **Transitorio Ordinario** | Da 1 a 18 mesi | Libero o concordato in base al comune | Massima elasticità, motivazione documentata (es. lavoro a tempo determinato). |
| **Transitorio Studenti** | Da 6 a 36 mesi | Concordato con atenei | Ricambio rapido, cedolare al 10% nei comuni sede di università. |

---

### 2. Adeguamento ISTAT dell'Affitto

Nei contratti a canone libero senza cedolare secca (regime ordinario), il canone può essere annualmente indicizzato all'inflazione **ISTAT FOI** (indice dei prezzi al consumo per famiglie di operai e impiegati):
- Adeguamento ordinario: applicazione del **100% dell'indice ISTAT**.
- Contratti agevolati: applicazione del **75% dell'indice ISTAT**.
- *Nota importante*: se si opta per la **Cedolare Secca**, la legge vieta espressamente qualsiasi adeguamento ISTAT per l'intera durata dell'opzione.`
  },
  {
    id: 'tax_cedolare_vs_irpef',
    title: 'Fisco Immobiliare: Cedolare Secca (21% / 10%) vs IRPEF Ordinaria',
    category: 'TAXES_BONUS',
    summary: 'Confronto analitico tra i regimi fiscali di locazione: quando conviene la tassazione a cedolare e quando conviene l\'IRPEF.',
    tags: ['Cedolare Secca', 'IRPEF', 'Fisco', 'Imposte', 'Convenienza Fiscale'],
    readTimeMinutes: 6,
    featured: true,
    relatedArticleIds: ['tax_bonus_edilizi', 'property_mgmt_rentals'],
    content: `### 1. I Tre Regimi di Tassazione a Confronto

#### Regime 1: Cedolare Secca al 21%
- Si applica a tutti i contratti a canone libero (4+4) o transitori tra persone fisiche.
- Sostituisce integralmente: IRPEF, Addizionale Regionale, Addizionale Comunale, Imposta di Registro e Imposta di Bollo sul contratto.
- **Calcolo**: $\\text{Imposta} = \\text{Canone Annuo Lordo} \\times 21\\%$.

#### Regime 2: Cedolare Secca al 10% (Agevolata)
- Riservata ai contratti a **Canone Concordato (3+2)** e contratti universitari stipulati nei comuni ad alta densità abitativa o calamitati.
- **Calcolo**: $\\text{Imposta} = \\text{Canone Annuo Lordo} \\times 10\\%$.
- Beneficio accessorio: **Sconto IMU obbligatorio del 25%** per legge statale (si paga il 75% dell'aliquota comunale).

#### Regime 3: Tassazione Ordinaria IRPEF
- I canoni di locazione concorrono al reddito complessivo del contribuente, con una deduzione forfettaria del **5%**:
  $$\\text{Base Imponibile IRPEF} = \\text{Canone Lordo} \\times 0.95$$
- L'aliquota applicata dipende dallo scaglione marginale del proprietario (23%, 35%, 43%) oltre alle addizionali locali (circa 2-3%).

---

### 2. Quando Conviene l'IRPEF rispetto alla Cedolare Secca?

La Cedolare Secca conviene nella quasi totalità dei casi, **ECCETTO** quando:
1. Il proprietario ha **molte detrazioni fiscali pregresse (Bonus Ristrutturazioni 50%, Ecobonus, Spese Mediche)** che rischierebbe di perdere per **incapienza fiscale** (la cedolare secca non è compensabile con detrazioni IRPEF).
2. Se l'IRPEF lorda generata dallo stipendio non basta ad assorbire le rate di detrazione 730, optare temporaneamente per l'IRPEF sul canone di locazione permette di non bruciare i crediti d'imposta.`
  },
  {
    id: 'tax_bonus_edilizi',
    title: 'Bonus Casa 50%, Ecobonus 65% e Detrazioni 730: Regole & Bonifico Parlante',
    category: 'TAXES_BONUS',
    summary: 'Come gestire fatture e detrazioni in ImmoPlan: massimali di spesa, requisiti tecnici e compilazione del bonifico parlante.',
    tags: ['Bonus 50%', 'Ecobonus 65%', 'Detrazioni 730', 'Bonifico Parlante', 'ENEA'],
    readTimeMinutes: 7,
    relatedArticleIds: ['tax_cedolare_vs_irpef', 'forecaster_case_verdi'],
    content: `### 1. I Bonus Edilizi Integrati nell'Archivio Fiscale di ImmoPlan

Nel sottomodulo **Fatture & Detrazioni**, ogni spesa sostenuta viene classificata con la sua detrazione specifica:

#### Bonus Ristrutturazione 50% (Art. 16-bis TUIR)
- **Aliquota**: 50% delle spese sostenute.
- **Massimale**: 96.000 € per singola unità immobiliare residenziale.
- **Ripartizione**: 10 quote annuali costanti di pari importo.
- **Opere ammesse**: Manutenzione straordinaria, restauro e risanamento conservativo, ristrutturazione edilizia.

#### Ecobonus 65% (Riqualificazione Energetica)
- **Aliquota**: 65% per sostituzione impianti con pompe di calore ibride/ad alta efficienza, cappotto termico, serramenti e schermature solari con specifici requisiti di trasmittanza.
- **Obbligo ENEA**: trasmissione della scheda descrittiva sul portale ENEA entro **90 giorni** dal collaudo/fine lavori.

#### Bonus Mobili ed Elettrodomestici 50%
- Detrazione del 50% per l'acquisto di arredi ed elettrodomestici (classe A per forni, E per lavatrici/lavastoviglie, F per frigoriferi).
- Massimale di spesa: 5.000 € per unità ristrutturata.

#### Oneri Accessori Compravendita Prima Casa
- **Interessi Passivi Mutuo**: Detrazione IRPEF del 19% fino a un massimo di 4.000 € all'anno (max 760 €/anno di risparmio).
- **Parcella Notaio Mutuo**: Detraibile al 19% all'interno del plafond dei 4.000 € del mutuo.
- **Spese di Intermediazione Immobiliare (Agenzia)**: Detrazione del 19% su un tetto massimo di 1.000 € (max 190 € una tantum).

---

### 2. La Regola d'Oro: Il "Bonifico Parlante" Obbligatorio

Tutti i pagamenti per Bonus Ristrutturazione ed Ecobonus devono avvenire esclusivamente tramite **Bonifico Parlante** bancario o postale, contenente:
1. **Causale di legge** con riferimento alla norma (es. *"Bonifico per interventi di recupero del patrimonio edilizio ex art. 16-bis del Dpr 917/1986"*).
2. **Codice Fiscale** del/dei beneficiari della detrazione (Giuseppe e/o Claudia).
3. **Numero di Partita IVA** o Codice Fiscale dell'impresa esecutrice dei lavori.
4. **Numero e data della fattura** saldata.
*Nota bene*: la banca effettua in automatico una ritenuta d'acconto (attualmente all'11%) a carico dell'impresa ricevente.`
  },
  {
    id: 'ha_addon_setup',
    title: 'Integrazione Home Assistant: Configurazione Add-on & Sensori REST',
    category: 'HOME_ASSISTANT',
    summary: 'Guida all\'esposizione delle entità di ImmoPlan nella domotica: sensori di cashflow, valore portafoglio e scadenze.',
    tags: ['Home Assistant', 'Add-on', 'REST Sensor', 'YAML', 'Domotica'],
    readTimeMinutes: 5,
    featured: true,
    relatedArticleIds: ['ha_webhook_automation', 'troubleshoot_ha_gemini_connectivity'],
    content: `### 1. Architettura dell'Add-on Home Assistant

ImmoPlan può funzionare come add-on ufficiale supervisionato all'interno di Home Assistant OS.
Il server locale Node.js esponde un set di API REST protette che permettono a Home Assistant di monitorare in tempo reale lo stato finanziario del tuo patrimonio.

---

### 2. Configurazione Sensori in \`configuration.yaml\`

Aggiungi il seguente blocco nel tuo file \`configuration.yaml\` di Home Assistant per creare i sensori virtuali di ImmoPlan:

\`\`\`yaml
# Sensori Finanziari ImmoPlan
sensor:
  - platform: rest
    name: "ImmoPlan Valore Patrimonio"
    resource: "http://localhost:3000/api/properties/summary"
    value_template: "{{ value_json.totalEstimatedValue }}"
    unit_of_measurement: "EUR"
    device_class: monetary
    scan_interval: 3600

  - platform: rest
    name: "ImmoPlan Cash Flow Mensile"
    resource: "http://localhost:3000/api/properties/summary"
    value_template: "{{ value_json.monthlyNetCashflow }}"
    unit_of_measurement: "EUR"
    device_class: monetary
    scan_interval: 1800

  - platform: rest
    name: "ImmoPlan Prossime Scadenze 30gg"
    resource: "http://localhost:3000/api/deadlines/upcoming"
    value_template: "{{ value_json.pendingCount }}"
    unit_of_measurement: "eventi"
    scan_interval: 3600
\`\`\`

---

### 3. Card Dashboard Lovelace Consigliata
Puoi visualizzare le metriche finanziarie direttamente sulle tue plance Lovelace tramite una card di tipo \`tile\` o \`gauge\`:

\`\`\`yaml
type: vertical-stack
cards:
  - type: tile
    entity: sensor.immoplan_valore_patrimonio
    name: Valore Patrimonio Reale
    icon: mdi:home-analytics
  - type: tile
    entity: sensor.immoplan_cash_flow_mensile
    name: Cash Flow Netto Mensile
    icon: mdi:cash-multiple
\`\`\``
  },
  {
    id: 'ha_webhook_automation',
    title: 'Automazioni Home Assistant: Notifiche Telegram e Promemoria Scadenze',
    category: 'HOME_ASSISTANT',
    summary: 'Come configurare avvisi automatici su smartphone per rate di mutuo, canoni di locazione e controlli caldaia.',
    tags: ['Automazioni', 'Telegram', 'Notifiche', 'Scadenze', 'Webhook'],
    readTimeMinutes: 4,
    relatedArticleIds: ['ha_addon_setup', 'property_mgmt_rentals'],
    content: `### Ricevi Notifiche Smart su Telegram o App Home Assistant

Con i sensori ImmoPlan configurati, puoi creare automazioni per non scordare mai una scadenza fiscale o un pagamento dell'affitto.

#### Esempio: Automazione Notifica Pagamento Canone di Affitto
\`\`\`yaml
alias: "ImmoPlan: Alert Scadenza Affitto"
description: "Avvisa il 5 del mese di verificare l'incasso dell'affitto"
trigger:
  - platform: time
    at: "09:00:00"
condition:
  - condition: template
    value_template: "{{ now().day == 5 }}"
action:
  - action: notify.notify
    data:
      title: "🏢 Promemoria ImmoPlan"
      message: "Oggi è il giorno di accredito dei canoni di locazione. Controlla il registro pagamenti nell'app!"
\`\`\`

#### Esempio: Alert Revisione Caldaia e Contratti
\`\`\`yaml
alias: "ImmoPlan: Alert Scadenza Manutenzione Immobile"
trigger:
  - platform: numeric_state
    entity_id: sensor.immoplan_prossime_scadenze_30gg
    above: 0
action:
  - action: notify.persistent_notification
    data:
      title: "⚠️ ImmoPlan: Scadenza Imminente"
      message: "Hai scadenze in arrivo nei prossimi 30 giorni nel calendario ImmoPlan."
\`\`\`
`
  },
  {
    id: 'troubleshoot_backup_persistence',
    title: 'Guida al Backup, Ripristino Selettivo & Integrità Dati',
    category: 'FAQ_TROUBLESHOOTING',
    summary: 'Come gestire i backup JSON crittografabili, il ripristino selettivo per modulo e la prevenzione della perdita dati in IndexedDB.',
    tags: ['Backup', 'Ripristino', 'IndexedDB', 'Cache', 'Sicurezza', 'Export'],
    readTimeMinutes: 5,
    featured: true,
    relatedArticleIds: ['start_architecture', 'troubleshoot_ha_gemini_connectivity'],
    content: `### 1. Il Sistema di Persistenza Locale (IndexedDB)

ImmoPlan memorizza tutte le tabelle nel motore **IndexedDB** del tuo browser o istanza Electron. Per garantire la massima sicurezza:
- Nessun dato sensibile viene inviato al cloud o a server esterni non autorizzati.
- Le informazioni rimangono disponibili anche totalmente offline in assenza di rete.

#### Come Funziona il Backup JSON Completo
Cliccando sull'icona **Backup JSON** nella barra superiore dell'applicazione:
1. Viene serializzato l'intero database locale (immobili, inquilini, contratti, mutui, perizie, scenari e fatture).
2. Viene scaricato un file denominato \`immoplan_backup_YYYY-MM-DD.json\`.
3. Consigliamo di salvare periodicamente questo file su una cartella sincronizzata (Google Drive, OneDrive o NAS locale).

---

### 2. Ripristino Selettivo Intelligente

A differenza dei tradizionali ripristini "tutto o niente", ImmoPlan include un **Ripristino Modulare Selettivo**:
- Facendo clic su **Ripristina DB**, si apre una finestra modale in cui puoi spuntare individualmente:
  - *Immobili & Valutazioni*
  - *Scenari di Acquisto*
  - *Registro Locazioni & Inquilini*
  - *Fatture & Detrazioni 730*
  - *Preferenze e Profili Utente*
- Puoi così aggiornare ad esempio solo le fatture senza sovrascrivere nuovi immobili aggiunti recentemente.

---

### 3. Risoluzione Errori Comuni di Salvataggio

#### "I dati spariscono dopo aver chiuso il browser"
- **Causa**: Navigazione in incognito oppure impostazione del browser che cancella i cookie/dati sito alla chiusura.
- **Risoluzione**: Aggiungi l'indirizzo di ImmoPlan tra le eccezioni del browser per consentire la memorizzazione persistente permanente.`
  },
  {
    id: 'troubleshoot_ha_gemini_connectivity',
    title: 'Diagnostica di Rete: Connessione Home Assistant, CORS & Gemini AI',
    category: 'FAQ_TROUBLESHOOTING',
    summary: 'Risoluzione rapida degli errori di connessione REST tra Home Assistant e ImmoPlan, e configurazione dell\'API Key Google Gemini.',
    tags: ['CORS', 'Home Assistant', 'Gemini AI', 'REST API', 'Network', 'Troubleshooting'],
    readTimeMinutes: 6,
    featured: true,
    relatedArticleIds: ['ha_addon_setup', 'ha_webhook_automation'],
    content: `### 1. Diagnostica Connettività Home Assistant

Quando integri i sensori REST in Home Assistant, potresti riscontrare stati "Unavailable" o "Unknown". Ecco la checklist di diagnosi:

#### Verifica 1: Risoluzione Host e Porte
- Se ImmoPlan è in esecuzione come **Add-on Home Assistant**, l'endpoint interno è:
  \`http://localhost:3000/api/properties/summary\` oppure \`http://local-immoplan:3000/api/...\`
- Se ImmoPlan è su un server separato (es. PC Mac o Windows), usa l'IP locale statico:
  \`http://192.168.1.X:3000/api/properties/summary\`

#### Verifica 2: Blocco CORS (Cross-Origin Resource Sharing)
Se la console segnala un errore CORS:
1. Apri il file \`server.js\` nella directory principale dell'app.
2. Verifica che il middleware \`cors()\` sia attivo prima della definizione dei router API:
\`\`\`javascript
const cors = require('cors');
app.use(cors({ origin: '*' }));
\`\`\`

---

### 2. Risoluzione Errori Assistente AI Google Gemini

#### "Errore di connessione o API Key non valida"
1. **Verifica della Chiave**: Assicurati di aver generato la chiave su [Google AI Studio](https://aistudio.google.com/) senza spazi iniziali o finali.
2. **Quota Limiti Gratuiti**: Il tier gratuito di Gemini offre 15 richieste al minuto (RPM). Se effettui molte interrogazioni consecutive, attendi 60 secondi.
3. **Salvataggio Locale**: La chiave viene memorizzata esclusivamente nel localStorage/IndexedDB del tuo client, garantendo che nessuno all'esterno possa intercettarla.`
  }
];

export const HELP_FAQS: FaqItem[] = [
  {
    id: 'faq_data_privacy',
    category: 'GETTING_STARTED',
    question: 'I miei dati finanziari e contratti sono al sicuro o vengono inviati su server terzi?',
    answer: 'La tua privacy è tutelata al 100%. Tutti i dati (immobili, mutui, conti di Giuseppe e Claudia, contratti, inquilini e fatture) sono conservati esclusivamente in locale nel tuo browser (IndexedDB) o nel database locale del tuo server Home Assistant. Nessun dato finanziario viene mai trasmesso a server cloud esterni.',
    tags: ['Privacy', 'Sicurezza', 'IndexedDB']
  },
  {
    id: 'faq_backup_selective',
    category: 'GETTING_STARTED',
    question: 'Come posso salvare un backup sicuro o ripristinare solo alcune categorie?',
    answer: 'Nella barra di navigazione in alto a destra trovi l\'icona "Backup JSON" che genera istantaneamente un file completo crittografabile. Inoltre, il pulsante "Ripristina DB" offre una finestra modale di Ripristino Selettivo: puoi scegliere di sovrascrivere ad esempio solo i "Registro Affitti" o solo "Fatture & Detrazioni" senza toccare gli immobili o gli scenari esistenti.',
    tags: ['Backup', 'Ripristino', 'JSON']
  },
  {
    id: 'faq_forecaster_decrease',
    category: 'FORECASTER',
    question: 'Perché nel Forecaster il valore dell\'immobile talvolta diminuisce invece di crescere?',
    answer: 'Il motore applica rigorosamente le normative e i dati reali: se l\'immobile è in classe energetica sfavorevole (E, F o G), subisce la penalizzazione annuale del -2.0% per effetto della Direttiva UE Case Verdi. Inoltre, se è impostato lo scenario tassi BCE in aumento ("RISING"), viene applicata un\'ulteriore flessione del -0.75%. Se riqualifichi l\'immobile portandolo in classe A o B, vedrai il trend invertirsi e salire sensibilmente.',
    tags: ['Forecaster', 'Case Verdi', 'Svalutazione', 'Classe Energetica']
  },
  {
    id: 'faq_roe_vs_etf',
    category: 'FORECASTER',
    question: 'Che differenza c\'è tra il rendimento dell\'immobile e il Benchmark ETF World al 7%?',
    answer: 'L\'ETF World calcola la crescita composta al 7% annuo sul solo capitale proprio investito (anticipo cash). L\'immobile invece sfrutta la leva finanziaria bancaria: l\'intero valore della casa (incluso il debito pagato gradualmente dall\'inquilino con l\'affitto) cresce nel tempo, generando l\'Equità Netta. Il grafico ti mostra chiaramente l\'anno esatto in cui l\'immobile supera il portafoglio azionario grazie al reinvestimento del cash flow.',
    tags: ['ROE', 'ETF World', 'Leva Finanziaria']
  },
  {
    id: 'faq_cedolare_choice',
    category: 'TAXES_BONUS',
    question: 'Quando mi conviene scegliere la Cedolare Secca al 10% rispetto a quella al 21%?',
    answer: 'La Cedolare Secca al 10% è riservata ai contratti a Canone Concordato (3+2) nei comuni capoluogo o ad alta densità abitativa. Ti garantisce un risparmio netto sulle imposte più che dimezzato rispetto al 21% e uno sconto del 25% sull\'IMU comunale. Tuttavia, il canone mensile massimo è calmierato dagli accordi territoriali: ImmoPlan ti permette di simulare entrambi i casi per verificare se il maggior incasso lordo del 4+4 compensa la minore tassazione del 3+2.',
    tags: ['Cedolare Secca', 'Canone Concordato', 'IMU', 'Tasse']
  },
  {
    id: 'faq_bonifico_ordinario_error',
    category: 'TAXES_BONUS',
    question: 'Cosa succede se per errore pago una fattura di ristrutturazione con bonifico ordinario invece che parlante?',
    answer: 'L\'Agenzia delle Entrate revoca il diritto alla detrazione fiscale del 50% o 65% se il pagamento non transita con bonifico parlante soggetto a ritenuta d\'acconto. Tuttavia, la circolare AdE 43/E/2016 ammette il ravvedimento se l\'impresa fornitrice rilascia una dichiarazione sostitutiva di atto notorio in cui attesta che i corrispettivi sono stati regolarmente accreditati e contabilizzati nel proprio reddito d\'impresa.',
    tags: ['Bonifico Parlante', 'Errori', 'Fisco', 'Detrazioni']
  },
  {
    id: 'faq_gemini_ai_key',
    category: 'FAQ_TROUBLESHOOTING',
    question: 'Come posso configurare o modificare l\'API Key di Google Gemini per l\'assistente AI?',
    answer: 'Accedi alla scheda "Admin" nella barra superiore: nella sezione "Integrazione AI Google Gemini" puoi incollare la tua chiave API personale gratuita generata su Google AI Studio (aistudio.google.com). La chiave viene salvata crittografata in locale e permette all\'assistente di analizzare contestualmente il tuo database di immobili e scenari.',
    tags: ['Gemini', 'API Key', 'AI', 'Admin']
  },
  {
    id: 'faq_multi_owner_split',
    category: 'PROPERTY_MGMT',
    question: 'Come posso gestire quote di comproprietà diverse dal 50% (es. 70% Giuseppe e 30% Claudia)?',
    answer: 'Nella sezione "Fatture & Detrazioni" e nelle schede immobile puoi selezionare il beneficiario come "CUSTOM" e specificare esattamente la percentuale per ciascun titolare (es. 70% Giuseppe e 30% Claudia). L\'app calcolerà automaticamente le quote di detrazione IRPEF annuali e la ripartizione dei fondi dai rispettivi portafogli.',
    tags: ['Comproprietà', 'Quote', 'Giuseppe', 'Claudia']
  },
  {
    id: 'faq_condo_expenses_reconciliation',
    category: 'PROPERTY_MGMT',
    question: 'Come posso gestire le spese condominiali ordinarie e straordinarie con gli inquilini?',
    answer: 'Le spese ordinarie (pulizia scale, ascensore, riscaldamento centralizzato) possono essere addebitate all\'inquilino nel canone mensile con conguaglio di fine anno. Le spese straordinarie (rifacimento tetto, facciata, caldaia comune) restano sempre a carico esclusivo del proprietario locatore e possono essere archiviate con relative detrazioni fiscali nella tab Fatture.',
    tags: ['Condominio', 'Spese Ordinarie', 'Inquilini', 'Ripartizione']
  },
  {
    id: 'faq_print_export_report',
    category: 'FAQ_TROUBLESHOOTING',
    question: 'Posso stampare un report dettagliato in PDF per la mia banca o il commercialista?',
    answer: 'Certamente! Facendo clic sul pulsante Stampa (o premendo Ctrl+P / Cmd+P), l\'applicazione attiva un foglio di stile specifico per la stampa cartacea/PDF che nasconde la navigazione e i controlli interattivi, impaginando in modo pulito i grafici, il prospetto costi, la tabella di ammortamento e il registro fatture per la dichiarazione 730.',
    tags: ['Stampa', 'PDF', 'Report', 'Banca']
  },
  {
    id: 'faq_browser_cache_clean',
    category: 'FAQ_TROUBLESHOOTING',
    question: 'Cosa succede se cancello la cronologia del browser? Rischio di perdere i dati?',
    answer: 'Cancellare la semplice cronologia web non elimina i database IndexedDB. Tuttavia, se selezioni "Cancella cookie e dati di siti web", il browser potrebbe azzerare l\'archivio locale. Consigliamo caldamente di scaricare regolarmente un file di backup JSON prima di effettuare operazioni di pulizia del browser.',
    tags: ['Cache', 'IndexedDB', 'Backup', 'Dati']
  },
  {
    id: 'faq_mac_windows_transfer',
    category: 'FAQ_TROUBLESHOOTING',
    question: 'Posso trasferire il database tra computer Mac, Windows e server Home Assistant?',
    answer: 'Sì! Il file di backup JSON generato da ImmoPlan è universale e conforme allo schema JSON standard. Puoi esportarlo ad esempio dall\'app Desktop su macOS e reimportarlo fedelmente nell\'Add-on Home Assistant su Raspberry Pi o sul PC Windows.',
    tags: ['Mac', 'Windows', 'Home Assistant', 'Export', 'Import']
  },
  {
    id: 'faq_ha_cors_issue',
    category: 'HOME_ASSISTANT',
    question: 'Come risolvo problemi di connessione REST tra Home Assistant e l\'app?',
    answer: 'Se l\'app è avviata in modalità standalone su un computer separato rispetto a Home Assistant, assicurati di aver abilitato le impostazioni CORS nel file server.js o di specificare l\'indirizzo IP statico del server. Quando ImmoPlan è installato come add-on nativo all\'interno di Home Assistant Supervised, la comunicazione avviene internamente su localhost senza alcun blocco di rete.',
    tags: ['Home Assistant', 'CORS', 'Rete', 'Troubleshooting']
  }
];
