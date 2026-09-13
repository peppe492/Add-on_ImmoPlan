// tests/e2e/harness/fixtures.mjs
// Deterministic fixtures matching PROJECT.md interface contracts

export const fixtureLandlord = {
  id: 'landlord_1',
  name: 'Giuseppe Rossi',
  taxCode: 'RSSGPP80A01H501U',
  email: 'giuseppe.rossi@example.it',
  phone: '+39 340 1234567',
  address: 'Via Roma 1, 20121 Milano (MI)',
  iban: 'IT60X0542811101000000123456',
  createdAt: '2025-01-01T00:00:00.000Z'
};

export const fixtureTenant1 = {
  id: 'tenant_1',
  name: 'Marco Bianchi',
  taxCode: 'BNCMRA85M01H501Z',
  email: 'marco.bianchi@example.it',
  phone: '+39 347 7654321',
  telegramChatId: '987654321',
  rentDueDay: 5,
  contractType: 'CONCORDATO_3_2',
  createdAt: '2025-01-01T00:00:00.000Z'
};

export const fixtureTenant2 = {
  id: 'tenant_2',
  name: 'Laura Verdi',
  taxCode: 'VRDLRA90A41F205W',
  email: 'laura.verdi@example.it',
  phone: '+39 333 9988776',
  telegramChatId: '112233445',
  rentDueDay: 10,
  contractType: 'LIBERO_4_4',
  createdAt: '2025-01-01T00:00:00.000Z'
};

export const fixturePropertyCedolare = {
  id: 'prop_centro_1',
  name: 'Appartamento Centro',
  address: 'Via Dante 10, Milano',
  type: 'RESIDENTIAL',
  status: 'RENTED',
  purchasePrice: 250000,
  currentValue: 270000,
  purchaseDate: '2023-01-15',
  currentTenantId: 'tenant_1',
  financials: {
    monthlyRent: 850,
    rentDueDay: 5,
    condoFees: 100,
    mortgageAmount: 450,
    defaultTaxRate: 21,
    taxRegime: 'CEDOLARE_SECCA'
  }
};

export const fixturePropertyOrdinario = {
  id: 'prop_navigli_2',
  name: 'Trilocale Navigli',
  address: 'Ripa di Porta Ticinese 45, Milano',
  type: 'RESIDENTIAL',
  status: 'RENTED',
  purchasePrice: 320000,
  currentValue: 350000,
  purchaseDate: '2022-05-20',
  currentTenantId: 'tenant_2',
  financials: {
    monthlyRent: 1100,
    rentDueDay: 10,
    condoFees: 120,
    mortgageAmount: 600,
    defaultTaxRate: 23,
    taxRegime: 'ORDINARIO'
  }
};

export const fixturePropertySmallRent = {
  id: 'prop_box_3',
  name: 'Box Auto Loreto',
  address: 'Piazza Loreto 5, Milano',
  type: 'GARAGE',
  status: 'RENTED',
  purchasePrice: 25000,
  currentValue: 28000,
  purchaseDate: '2024-02-10',
  currentTenantId: 'tenant_1',
  financials: {
    monthlyRent: 70.00, // Under € 77.47 threshold for stamp duty test
    rentDueDay: 5,
    condoFees: 10,
    mortgageAmount: 0,
    defaultTaxRate: 23,
    taxRegime: 'ORDINARIO'
  }
};

export const fixtureSettings = {
  reminderAdvanceDays: 5,
  autoCheckEnabled: true,
  homeAssistant: {
    enabled: true,
    updateSensors: true,
    persistentNotifications: true,
    sensorEntityId: 'sensor.immoplan_affitti_stato'
  },
  telegram: {
    enabled: true,
    botToken: '123456789:ABCdefGHIjklMNOpqrSTUvwxYZ',
    ownerChatId: '554433221',
    notifyOwnerOnDue: true,
    notifyTenantOnDue: true,
    autoSendReceiptToTenant: true
  }
};
