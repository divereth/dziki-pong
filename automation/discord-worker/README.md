# Zmiany w grach z Discorda

Istniejąca komenda obsługuje cztery kanały:

- `#dziki-pong` — Dziki Pong
- `#dziki-sprzedawca` — Dziki Sprzedawca
- `#dziki-bieg` — Dziki Bieg
- `#dziki-karabin` — Dziki Karabin

Na kanale wybranej gry wpisz:

```text
/dzika zmiana text:Dodaj fioletowy kolor nieba
```

Wszyscy na kanale zobaczą opis zmiany i numer zlecenia. Bot publicznie informuje o rozpoczęciu pracy, gotowym kodzie, sprawdzaniu gry i publikowaniu podglądu. Po udanym wdrożeniu zamieszcza link do gotowej gry; w razie błędu publikuje informację o niepowodzeniu. Sprzedawca, Bieg i Karabin wysyłają te raporty również na `#dev` (`1398036719101542601`), z nazwą gry, numerem zlecenia, kanałem źródłowym i linkiem do przebiegu GitHuba. Awaria jednego kanału nie blokuje wysyłania na drugi. Błędy przekazania zlecenia do GitHuba są raportowane przez Worker, a końcowy raport zadania działa w osobnym jobie, także po awarii lub przekroczeniu limitu czasu generowania. Każda prośba ma osobną gałąź, pull request i podgląd.

Historia zmian jest dostępna dla każdego na kanale gry:

```text
/ostatnie zmiany
```

Lista zawiera pięć najnowszych działających podglądów: osobę zlecającą, datę, opis i link do gry ze zmianą. Nie obejmuje zleceń, dla których nie udało się opublikować podglądu. Starsze zlecenia Ponga są obsługiwane. Odczyt historii nie uruchamia API GPT.

Po sprawdzeniu podglądu administrator może opublikować zmianę na tym samym kanale gry:

```text
/dzika promote request_id:NUMER_ZLECENIA
```

Integracja sprawdza uprawnienia administratora oraz zgodność gry, kanału i zmienionych plików. Generowanie samo w sobie nie publikuje zmiany w głównej wersji gry.

Integracja korzysta z obecnej usługi i zapisanego sekretu `DISCORD_BOT_TOKEN`. Bot musi mieć możliwość wysyłania wiadomości na kanałach gier i `#dev`. Wdrożenie zapisuje ten token również jako sekret Workera do raportowania błędów przed uruchomieniem zadania i automatycznie rejestruje `/ostatnie zmiany`, zachowując inne komendy aplikacji. Rozszerzenie nie publikuje wartości kluczy.

## Sprawdzenie kodu

```sh
node --test automation/*.test.mjs
node automation/game-tools.mjs check dziki-sprzedawca
node automation/game-tools.mjs check dziki-bieg
node automation/game-tools.mjs check dziki-karabin
```

Testy integracji używają lokalnych atrap Discorda i GitHuba. Nie wysyłają wiadomości na serwer i nie uruchamiają API GPT.
