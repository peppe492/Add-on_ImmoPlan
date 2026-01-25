# 🔍 Validazione Input Finanziario

## Implementazione P0.1

Aggiunto sistema di validazione robusto per proteggere i dati finanziari sensibili.

### 📋 Cosa è stato fatto

#### 1. **File `services/validator.ts`** (Nuovo)
Sistema completo di validazione con funzioni specializzate:

- **`validateFinancialAmount()`**: Valida importi finanziari
  - Non accetta NaN, Infinity, o valori negativi
  - Supporta limite massimo opzionale
  - Restituisce messaggi di errore in italiano

- **`validatePercentage()`**: Valida percentuali (0-100)
  - Usato per "Percentuale Mutuo", "IVA", ecc.

- **`validateDate()`**: Valida date in formato YYYY-MM-DD
  - Verifica validità effettiva della data

- **`validateString()`**: Valida stringhe
  - Controlla lunghezza min/max
  - Non accetta stringhe vuote

- **`validateCostDetail()`**: Valida oggetti CostDetail
  - Controlla amount, paidAmount, paymentDate
  - Garantisce paidAmount ≤ amount

- **`validateRenovationItem()`**: Valida voci di ristrutturazione
  - Description + Amount + Date

- **`validateFinancialData()`**: Validazione completa del progetto
  - Tutte le proprietà principali
  - Relazioni tra campi (budget ≥ prezzo)
  - Restituisce array di errori

#### 2. **Aggiornamenti `components/FinancialInput.tsx`**

**State Aggiunto:**
```tsx
const [validationErrors, setValidationErrors] = useState<string[]>([]);
```

**Validazione Real-time:**
- Eseguita in `useEffect([data])` ad ogni change
- Mostra banner con errori (massimo 5 visibili)
- Non blocca l'input, ma avvisa l'utente

**Input Validation:**
- `ModernInput`: Rifiuta NaN e numeri negativi
- `PayableCostInput`: Valida amount e paidAmount
- `CostBreakdown`: Valida ogni item alla modifica

**Banner Errori:**
```
⚠️ Errori di Validazione
• propertyName: Nome Immobile deve avere almeno 3 caratteri
• totalBudget: Budget totale deve essere >= Prezzo totale
... e 2 altri errori
```

### 🎯 Benefici

✅ **Data Integrity**: Nessun valore corrotto nel DB
✅ **User Experience**: Feedback immediato sui dati errati
✅ **Debugging**: Log di console con dettagli
✅ **Multilanguage**: Messaggi in italiano
✅ **Type-Safe**: Validazione anche senza Zod (per evitare dipendenze extra)

### 📊 Regole di Validazione

| Campo | Regola | Messaggio |
|-------|--------|-----------|
| `propertyName` | 3-100 caratteri | "deve avere almeno 3 caratteri" |
| `totalPrice` | ≥ 0, finito | "deve essere un numero valido" |
| `totalBudget` | ≥ totalPrice | "deve essere >= Prezzo totale" |
| `liquidityGiuseppe` | ≥ 0 | "non può essere negativo" |
| `liquidityClaudia` | ≥ 0 | "non può essere negativo" |
| `loanPercentage` | 0-100 | "deve essere tra 0 e 100" |
| Amount | ≥ 0, finito | "non può essere negativo" |
| PaidAmount | ≤ Amount | "non può superare l'importo totale" |
| Date | YYYY-MM-DD | "deve essere in formato YYYY-MM-DD" |

### 🔧 Utilizzo nel Codice

**Importare validator:**
```tsx
import { validateFinancialData, validateFinancialAmount, safeNumber } from '../services/validator';
```

**Validare i dati:**
```tsx
const result = validateFinancialData(data);
if (!result.isValid) {
  console.error('Errori:', result.errors);
  // Mostrare banner agli errori
}
```

**Input numerico sicuro:**
```tsx
const val = parseFloat(e.target.value);
if (isNaN(val) || val < 0) return; // Rifiuta
```

### 📝 Esempi di Comportamento

#### ✅ Input Valido
```
propertyName: "Via Roma 10"
totalPrice: 300000
totalBudget: 350000
loanPercentage: 70
```
→ ✓ Nessun errore

#### ❌ Input Invalido
```
propertyName: "Roma"  // < 3 caratteri
totalPrice: -50000    // Negativo
totalBudget: 250000   // < totalPrice
```
→ 3 errori mostrati nel banner

### 🚀 Prossimi Passi (P0)

1. **Error Handling nei Servizi** (P0.2)
   - Validazione in `dbService.ts`
   - Try-catch nei salvataggi
   - Error boundaries nei componenti

2. **Offline Mode** (P0.3)
   - Gestione sincronizzazione offline
   - Retry logic robusto

### 📞 Troubleshooting

**Errore: "Importo pagato non può superare l'importo totale"**
→ Controlla che paidAmount ≤ amount

**Errore: "Budget totale deve essere >= Prezzo totale"**
→ Aumenta il budget o riduci il prezzo

**Messaggio: "deve essere un numero valido"**
→ Usa solo numeri, non lettere o caratteri speciali

---

**Versione**: 1.0.0
**Data**: 2026-01-18
**Status**: ✅ Implementato
