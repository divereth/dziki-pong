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

Otrzymasz numer zlecenia i adres przyszłego podglądu. Podgląd zacznie działać po zakończeniu generowania i publikacji. Postęp, wynik i ewentualny błąd są zgłaszane na dotychczasowym kanale deweloperskim. Każda prośba ma osobną gałąź, pull request i podgląd. Pozostałe gry pozostają bez zmian.

Po sprawdzeniu podglądu administrator może opublikować zmianę na tym samym kanale gry:

```text
/dzika promote request_id:NUMER_ZLECENIA
```

Integracja sprawdza uprawnienia administratora oraz zgodność gry, kanału i zmienionych plików. Generowanie samo w sobie nie publikuje zmiany w głównej wersji gry.

Nie trzeba tworzyć nowej aplikacji ani rejestrować dodatkowej komendy. Integracja korzysta z obecnej usługi i zachowuje zapisane sekrety. Rozszerzenie nie publikuje wartości kluczy.

## Sprawdzenie kodu

```sh
node --test automation/*.test.mjs
node automation/game-tools.mjs check dziki-sprzedawca
node automation/game-tools.mjs check dziki-bieg
node automation/game-tools.mjs check dziki-karabin
```

Testy integracji używają lokalnych atrap Discorda i GitHuba. Nie wysyłają wiadomości na serwer i nie uruchamiają API GPT.
