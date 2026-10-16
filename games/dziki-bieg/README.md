# Dziki Bieg

Przeglądarkowa platformówka 2D typu endless runner. Gra online: https://dzikibieg.pages.dev. Otwórz `dist/index.html` w przeglądarce lub uruchom `npm start` i wejdź na wyświetlony adres.

- **Enter** — rozpoczęcie / kolejna runda.
- **Z** (również spacja lub strzałka w górę) — skok. Naciśnij ponownie w powietrzu, żeby wykonać drugi skok. Oba skoki odnawiają się po lądowaniu; wskaźnik pokazuje pozostałe skoki.
- **X** — poziomy dash, który rozbija duże jajka i wydłuża lot nad przepaścią. Odnowienie: 0,7 s. Skok przerywa dash i rozpoczyna kolejny łuk lotu. Dash nie odnawia skoków.
- **P / Escape** — pauza. Przełączenie okna również pauzuje grę.
- **M** — dźwięk. **F** — pełny ekran.
- Na telefonach i tabletach dostępne są duże przyciski dotykowe SKOK i DASH. Można używać dwóch palców jednocześnie; przytrzymanie przycisku nie powtarza akcji. Drugi skok wymaga kolejnego dotknięcia.
- Plansza dopasowuje skalę do ekranu, pozostawiając wyprzedzenie przed przeszkodami i miejsce na cały podwójny skok. Sterowanie znajduje się poniżej toru lotu.
- Gra działa pionowo i poziomo. Obrót urządzenia pauzuje rundę bez resetowania wyniku. Przycisk pełnego ekranu na urządzeniach dotykowych rozszerza planszę na całe okno przeglądarki; widoczny przycisk wyjścia działa również podczas pauzy i po zakończeniu rundy.

Yoshi automatycznie zjada Koopy, które lecą przed nim w zasięgu języka. Koopa: **100 pkt**, zniszczone jajko: **200 pkt**, każdy metr: **1 pkt**. Zderzenie z jajkiem lub czołem uskoku oraz upadek w przepaść kończą bieg. Rekord jest zapisywany lokalnie w przeglądarce. Prędkość startuje od 290 i rośnie o 8,5 jednostki/s co sekundę, do 760 po około 55 sekundach. Przyspieszenie jest ponad siedem razy większe od poprzedniej wersji.

Trasa zawiera większe przepaście, wyższe i niższe półki, podjazdy, zjazdy oraz krótkie latające wyspy. Generator przewiduje prędkość przy dobieganiu do krawędzi i uwzględnia różnicę wysokości. Jajka mają 120–146 jednostek wysokości zamiast 74–90, a ich szerokość i obszar zderzenia rosną proporcjonalnie. Stoją na powierzchni terenu i pozostawiają miejsce na lądowanie. Koopy pojawiają się także nad przepaściami, aby nagradzać skoki.

Gra nie wymaga bibliotek ani zewnętrznych grafik. Krajobraz i postacie są rysowane bezpośrednio na canvasie. Dźwięki są generowane w przeglądarce. Krój pisma z Google Fonts jest opcjonalny — bez połączenia z internetem używane są fonty systemowe.

`npm test` sprawdza fizykę, punktację, generowanie trasy, zachowanie pauzy i dopasowanie planszy do telefonów i tabletów.

## Cloudflare Pages

Projekt Pages: `dzikibieg`. Publiczny adres: https://dzikibieg.pages.dev.

Konfiguracja jest w `wrangler.jsonc`. Polecenie `npm run deploy:pages` uruchamia testy i publikuje tylko katalog `dist/` na gałęzi produkcyjnej `main`. Korzysta z narzędzia Wrangler zainstalowanego w nadrzędnym katalogu projektu. Logowanie musi obejmować uprawnienie `pages:write`.
