# Dziki — gry i zmiany z Discorda

Jedna komenda `/dzika zmiana text:opis zmiany` obsługuje cztery gry. Gra jest wybierana na podstawie kanału z podpisanej interakcji Discorda.

| Kanał | Gra | Cloudflare Pages | Pliki gry |
|---|---|---|---|
| #dziki-pong | Dziki Pong | https://dziki-pong.pages.dev/ | katalog główny |
| #dziki-sprzedawca | Dziki Sprzedawca | https://dzikisprzedawca.pages.dev/ | games/dziki-sprzedawca |
| #dziki-bieg | Dziki Bieg | https://dzikibieg.pages.dev/ | games/dziki-bieg/dist |
| #dziki-karabin | Dziki Karabin | https://dzikikarabin.pages.dev/ | games/dziki-karabin/dist |

Komenda publikuje opis zmiany i numer zlecenia dla wszystkich na kanale danej gry. Na tym samym kanale pojawiają się postęp pracy, gotowy podgląd lub informacja o błędzie. Dla Dzikiego Sprzedawcy, Dzikiego Biegu i Dzikiego Karabinu raporty trafiają również na `#dev`: przyjęcie zlecenia, kolejne etapy, podgląd, publikacja i błędy, razem z linkiem do zadania GitHuba. Osobny raport końcowy działa także po błędzie lub przekroczeniu limitu czasu zadania. Każde zlecenie ma osobną gałąź i podgląd. Generowanie trwa maksymalnie 30 minut; cały przebieg ma limit 45 minut.

`/ostatnie zmiany` pokazuje publicznie pięć ostatnich zmian gry przypisanej do kanału: osobę zlecającą, datę, opis i link do działającego podglądu. Historia obejmuje gotowe podglądy, również dla zleceń utworzonych przed dodaniem tej komendy. Nie uruchamia API GPT.

Administrator publikuje sprawdzony podgląd komendą `/dzika promote request_id:numer` na tym samym kanale. Workflow weryfikuje grę, kanał, pliki PR-a i wersję zatwierdzanego commita przed scaleniem. Zmiana nie jest publikowana automatycznie po wygenerowaniu.

Obsługa Discorda: [konfiguracja i testy](automation/discord-worker/README.md). Starszy `automation/discord-bot.mjs` jest historycznym botem Gateway i nie obsługuje nowych gier; aktywna integracja działa jako Worker `dziki-pong-discord`.

Sprawdzenie integracji: `node --test automation/*.test.mjs`.
Sprawdzenie dowolnej gry: `node automation/game-tools.mjs check dziki-sprzedawca`.
Paczka publiczna: `node automation/game-tools.mjs build dziki-sprzedawca` → `.artifacts/dziki-sprzedawca/`.

## Historia Ponga

Recovered from the Cloudflare Pages deployment on 22 September 2026.

- Live site: https://dziki-pong.pages.dev/
- Deployment: https://7d490395.dziki-pong.pages.dev/
- Cloudflare project: `dziki-pong`
- Deployment ID: `7d490395-bdaa-4ee3-baa0-f2ae77120536`

Files:

- `index.html`
- `style.css`
- `game.js`

## Discord

- `/dzika zmiana text:...` — zgłoś pomysł na zmianę w grze.
- `/dzika promote request_id:...` — opublikuj sprawdzoną zmianę; tylko administrator.
