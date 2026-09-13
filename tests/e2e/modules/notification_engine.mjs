// tests/e2e/modules/notification_engine.mjs
// Opaque-box client & dispatcher for Home Assistant and Telegram notifications (F5, F6, F7, F8, F9)

/**
 * Dispatches a text message via Telegram Bot API.
 */
export function escapeTelegramHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export async function sendTelegramMessage({
  baseUrl = 'https://api.telegram.org',
  botToken,
  chatId,
  text,
  parseMode = 'HTML'
}) {
  if (!botToken) {
    return { success: false, error: 'Bot token is missing' };
  }
  if (!chatId) {
    return { success: false, error: 'Chat ID is missing' };
  }

  const endpoint = `${baseUrl.replace(/\/$/, '')}/bot${botToken}/sendMessage`;
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode
      })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      return {
        success: false,
        status: res.status,
        error: data.description || `HTTP ${res.status}`,
        parameters: data.parameters
      };
    }

    return {
      success: true,
      messageId: data.result?.message_id,
      date: data.result?.date
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Dispatches a document (PDF) via Telegram Bot API using native FormData/Blob.
 */
export async function sendTelegramDocument({
  baseUrl = 'https://api.telegram.org',
  botToken,
  chatId,
  documentBuffer,
  filename = 'quietanza.pdf',
  caption = ''
}) {
  if (!botToken || !chatId || !documentBuffer) {
    return { success: false, error: 'Missing required parameters for document dispatch' };
  }

  const endpoint = `${baseUrl.replace(/\/$/, '')}/bot${botToken}/sendDocument`;
  try {
    const formData = new FormData();
    formData.append('chat_id', String(chatId));
    formData.append('caption', caption);

    const blob = new Blob([documentBuffer], { type: 'application/pdf' });
    formData.append('document', blob, filename);

    const res = await fetch(endpoint, {
      method: 'POST',
      body: formData
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      return {
        success: false,
        status: res.status,
        error: data.description || `HTTP ${res.status}`
      };
    }

    return {
      success: true,
      documentId: data.result?.document?.file_id,
      messageId: data.result?.message_id
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Telegram Connection Test (Feature F6).
 */
export async function testTelegramConnection({
  baseUrl = 'https://api.telegram.org',
  botToken
}) {
  if (!botToken || !botToken.trim()) {
    return { success: false, message: 'Bot Token mancante' };
  }

  const endpoint = `${baseUrl.replace(/\/$/, '')}/bot${botToken.trim()}/getMe`;
  try {
    const res = await fetch(endpoint, { method: 'GET' });
    const data = await res.json().catch(() => ({}));

    if (res.ok && data.ok) {
      return {
        success: true,
        message: `Connessione riuscita con @${data.result.username}`,
        botUsername: data.result.username
      };
    }

    return {
      success: false,
      message: `Errore Telegram: ${data.description || res.status}`
    };
  } catch (err) {
    return {
      success: false,
      message: `Impossibile connettersi ai server Telegram: ${err.message}`
    };
  }
}

/**
 * Home Assistant Sensor State update (Feature F7).
 */
export async function updateHomeAssistantSensor({
  supervisorUrl = 'http://supervisor',
  token,
  entityId = 'sensor.immoplan_affitti_stato',
  state,
  attributes = {}
}) {
  const url = `${supervisorUrl.replace(/\/$/, '')}/core/api/states/${entityId}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token || ''}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        state: String(state),
        attributes: {
          ...attributes,
          unit_of_measurement: attributes.unit_of_measurement || 'canoni',
          friendly_name: attributes.friendly_name || 'Stato Canoni di Locazione',
          icon: attributes.icon || (Number(state) > 0 ? 'mdi:alert-circle' : 'mdi:check-circle')
        }
      })
    });

    if (!res.ok) {
      return { success: false, status: res.status, error: `HA Error: ${res.statusText}` };
    }
    const data = await res.json();
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Home Assistant Connection Test (Feature F8).
 */
export async function testHomeAssistantConnection({
  supervisorUrl = 'http://supervisor',
  token
}) {
  const url = `${supervisorUrl.replace(/\/$/, '')}/core/api/config`;
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token || ''}`,
        'Content-Type': 'application/json'
      }
    });

    if (res.ok) {
      const data = await res.json();
      return {
        success: true,
        message: `Connessione a Home Assistant riuscita (v${data.version || 'unknown'})`,
        haVersion: data.version
      };
    }

    return {
      success: false,
      message: `Errore Home Assistant (HTTP ${res.status})`
    };
  } catch (err) {
    return {
      success: false,
      message: `Supervisor Home Assistant non raggiungibile: ${err.message}`
    };
  }
}

/**
 * Create Persistent Notification in Home Assistant.
 */
export async function createHomeAssistantNotification({
  supervisorUrl = 'http://supervisor',
  token,
  notificationId,
  title,
  message
}) {
  const url = `${supervisorUrl.replace(/\/$/, '')}/core/api/services/persistent_notification/create`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token || ''}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        notification_id: notificationId,
        title,
        message
      })
    });
    return { success: res.ok };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Dismiss Persistent Notification in Home Assistant.
 */
export async function dismissHomeAssistantNotification({
  supervisorUrl = 'http://supervisor',
  token,
  notificationId
}) {
  const url = `${supervisorUrl.replace(/\/$/, '')}/core/api/services/persistent_notification/dismiss`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token || ''}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ notification_id: notificationId })
    });
    return { success: res.ok };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
