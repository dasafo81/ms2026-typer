# ⚽ Typer MŚ 2026

Osiedlowa liga typowania wyników Mistrzostw Świata 2026.

## Setup

### 1. Supabase — baza danych
1. Otwórz projekt na supabase.com
2. Przejdź do **SQL Editor**
3. Wklej i uruchom zawartość pliku `supabase_schema.sql`

### 2. Lokalne uruchomienie
```bash
npm install
npm run dev
```

### 3. Zmienne środowiskowe (.env)
```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_API_FOOTBALL_KEY=twój_klucz
VITE_ADMIN_PASSWORD=typer2026
```

### 4. Deploy na Vercel
```bash
npm install -g vercel
vercel --prod
```
Dodaj zmienne środowiskowe w Vercel Dashboard → Settings → Environment Variables.

## Użytkowanie

- **Gracze** — rejestrują się mailem, typują wyniki przed kick-off
- **Punktacja** — 3 pkt za dokładny wynik, 1 pkt za trafiony wynik meczu
- **Admin** — wejdź na `/admin`, wpisz hasło, kliknij "Pełny sync" by pobrać mecze MŚ 2026 z API

## Punktacja
| Trafienie | Punkty |
|---|---|
| Dokładny wynik | 3 |
| Trafiony wynik (1X2) | 1 |
| Pudło | 0 |
