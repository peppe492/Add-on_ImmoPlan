# Configurazione Automazioni Home Assistant per ImmoPlan

Per far funzionare le **notifiche push interattive** con ImmoPlan direttamente sul tuo telefono, devi aggiungere una piccola configurazione a Home Assistant. 

Questo permetterà di ricevere una notifica sul telefono con un bottone **"Segna come Pagato"**. Cliccandolo, la scadenza verrà aggiornata automaticamente nell'App ImmoPlan e la notifica sparirà!

## 1. Aggiungi il comando REST a `configuration.yaml`
Questo comando permette a Home Assistant di dire a ImmoPlan che hai pagato la scadenza.
Apri il tuo file `configuration.yaml` in Home Assistant e aggiungi:

```yaml
rest_command:
  immoplan_mark_paid:
    url: "http://local_mm_property_manager:9301/api/deadlines/{{ id }}/complete"
    method: POST
```
*(Nota: assicurati che il nome host `local_mm_property_manager` e la porta `9301` corrispondano al tuo Add-on. Se l'add-on ha un nome diverso, usa quello).*

---

## 2. Crea l'Automazione per ricevere le Notifiche (YAML)
Vai su **Impostazioni > Automazioni > Crea Automazione > Modifica in YAML** e incolla questo codice (ricordati di cambiare `notify.mobile_app_tuo_telefono` con il nome del tuo dispositivo):

```yaml
alias: "ImmoPlan: Notifica Scadenza Pendente"
mode: parallel
trigger:
  - platform: event
    event_type: immoplan_deadline_due
action:
  - service: notify.mobile_app_tuo_telefono
    data:
      title: "🚨 Scadenza ImmoPlan!"
      message: "{{ trigger.event.data.title }} - Importo: €{{ trigger.event.data.amount }}"
      data:
        actions:
          - action: "IMMOPLAN_PAID_{{ trigger.event.data.id }}"
            title: "✅ Segna come Pagato"
```

---

## 3. Crea l'Automazione per gestire il Bottone (YAML)
Sempre in Home Assistant, crea un'altra automazione che "ascolta" quando premi il bottone nella notifica e aggiorna ImmoPlan:

```yaml
alias: "ImmoPlan: Segna Scadenza come Pagata"
mode: parallel
trigger:
  - platform: event
    event_type: mobile_app_notification_action
condition:
  - condition: template
    value_template: "{{ trigger.event.data.action.startswith('IMMOPLAN_PAID_') }}"
action:
  - service: rest_command.immoplan_mark_paid
    data:
      id: "{{ trigger.event.data.action | replace('IMMOPLAN_PAID_', '') }}"
  # Opzionale: Pulisce la notifica dal telefono dopo aver premuto il bottone
  - service: notify.mobile_app_tuo_telefono
    data:
      message: clear_notification
      data:
        tag: "{{ trigger.event.data.action }}"
```

### Come testarlo:
1. Riavvia Home Assistant o ricarica la configurazione YAML.
2. Crea una scadenza in ImmoPlan con data di oggi o ieri.
3. Entro la prossima ora riceverai una notifica sul telefono. Cliccando "Segna come Pagato", l'app ImmoPlan sposterà la scadenza nelle "Completate"!
