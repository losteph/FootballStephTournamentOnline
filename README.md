# ⚽ Football Steph - League Edition (Campionato)

Sito web companion per il gestionale Flutter **Football Steph**. Questa applicazione web statica legge i file JSON esportati direttamente dall'applicazione mobile e genera un portale interattivo e professionale per seguire in tempo reale la classifica, il calendario delle giornate, la classifica marcatori e le rose delle squadre con le relative schede giocatore in stile FUT.

---

## 🚀 Guida Rapida: Dall'App al Web

### 1. Creare e gestire il torneo nell'App
1. Apri l'app **Football Steph** sul tuo dispositivo.
2. Vai nella sezione **Storico / Tornei** e crea un nuovo torneo (es. *"Campionato Apertura 2026"*), associando le squadre partecipanti.
3. Gioca le partite direttamente dalla modalità live dell'app assicurandoti di selezionare il torneo attivo prima del fischio d'inizio (in modo che vengano salvate con il corretto `tournamentId`).

### 2. Esportare i database JSON dall'App
Dalle rispettive schermate dell'app, esporta i file di backup salvandoli sul tuo dispositivo:
* **Database Giocatori** (`database_giocatori.json`)
* **Squadre** (`squadre.json`)
* **Storico Partite** (`storico_partite.json`)

### 3. Posizionare e rinominare i file nel Template Web
Crea una cartella denominata **`data/`** nella root del progetto e inserisci i file rinominandoli rigorosamente così:
* `data/player.json` (proveniente dai giocatori esportati)
* `data/teams.json` (proveniente dalle squadre esportate)
* `data/match.json` (proveniente dallo storico partite)
* `data/scheduled.json` (il calendario ufficiale del campionato - vedi sezione dedicata sotto)

---

## 📅 Come strutturare il file `scheduled.json` (Campionato)

Il file **`data/scheduled.json`** comanda la struttura ufficiale del campionato, associandosi al torneo tramite il suo ID univoco e suddividendo le giornate in **Andata e Ritorno**.

### 📋 Esempio completo (Campionato a 6 Squadre)
Crea un file chiamato `scheduled.json` all'interno della cartella `data/`:

```json
{
  "tournamentId": "tour_1792064132854",
  "tournamentName": "LEAGUE CUP 2026",
  "rounds": [
    {
      "roundName": "1ª Giornata - Andata",
      "matches": [
        {
          "homeName": "Solaris FC",
          "awayName": "Vulcanica",
          "scheduledDate": "Lunedì 12/10/2026 - Ore 21:00",
          "locationName": "Centro Sportivo Lambrate - Campo 1",
          "mapsUrl": "[https://maps.google.com](https://maps.google.com)"
        },
        {
          "homeName": "Oceanic Blu",
          "awayName": "Real Bianco",
          "scheduledDate": "Martedì 13/10/2026 - Ore 21:00",
          "locationName": "Sporting Club San Siro - Campo A",
          "mapsUrl": "[https://maps.google.com](https://maps.google.com)"
        },
        {
          "homeName": "Aura Viola",
          "awayName": "Smeraldo FC",
          "scheduledDate": "Mercoledì 14/10/2026 - Ore 21:30",
          "locationName": "Centro Sportivo Lambrate - Campo 2",
          "mapsUrl": "[https://maps.google.com](https://maps.google.com)"
        }
      ]
    }
  ]
}
```
> Regola Fondamentale: I nomi inseriti in homeName e awayName nel calendario devono corrispondere esattamente (anche nelle maiuscole/minuscole) ai nomi delle squadre registrati in teams.json e match.json. Il sistema abbinerà automaticamente il risultato non appena la partita viene disputata nell'app e il file match.json viene aggiornato.

---

### 🛠️ Tecnologie Utilizzate

- HTML5 / CSS3 (Design moderno in stile dashboard calcistica)
- JavaScript Vanilla (Async/Await per la lettura dei JSON)
