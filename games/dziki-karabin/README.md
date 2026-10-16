# Dziki Karabin

Przeglądarkowa gra FPS 3D: ty i 9 botów, dwie drużyny po 5 postaci. Gra odbywa się lokalnie w przeglądarce. Nie ma trybu sieciowego.

## Uruchomienie

W folderze `block-ops` uruchom `node server.mjs` (lub `npm start`), następnie otwórz http://127.0.0.1:4185. Gra działa na komputerach, telefonach i tabletach w przeglądarkach obsługujących WebGL. Moduły JavaScript wymagają serwera HTTP; pliku HTML nie należy otwierać przez `file://`.

## Telefon i tablet

Dotyk jest wybierany automatycznie na ekranach dotykowych. W menu można też ręcznie wybrać „DOTYK” albo „MYSZ + KLAWIATURA”; wybór zapamiętuje się w tej przeglądarce.

- Lewy joystick: ruch z płynną regulacją prędkości, pełne wychylenie uruchamia sprint.
- Przesuwanie palcem po prawej stronie: rozglądanie.
- Przytrzymaj STRZAŁ, aby prowadzić ogień. Przeciąganie po tym przycisku jednocześnie celuje. Karabin Scout strzela raz na każde dotknięcie.
- CELUJ: przytrzymaj, aby przybliżyć. SKOK: skok. ŁADUJ: przeładowanie. 1/2: zmiana karabinu na nóż i odwrotnie.
- Przy skrzynce przytrzymaj OTWÓRZ. Przycisk staje się aktywny, gdy jesteś dostatecznie blisko.
- Górne przyciski otwierają wyniki lub pauzę. Czułość dotyku można zmienić w pauzie.

Można grać w pionie i poziomie. Menu oraz sklep przewijają się na małych ekranach. Gra uwzględnia bezpieczne marginesy przy wycięciu ekranu i ogranicza rozdzielczość renderowania oraz cieni na urządzeniach dotykowych.

## Sterowanie

| Klawisz | Działanie |
| --- | --- |
| WASD | Poruszanie |
| Mysz | Rozglądanie |
| Lewy przycisk myszy | Strzał / użycie noża |
| Prawy przycisk myszy | Przybliżenie celownika |
| 1 / 2 | Karabin / nóż |
| R | Przeładowanie |
| E (przytrzymaj) | Otwarcie skrzynki |
| Shift | Sprint |
| Spacja | Skok |
| Tab (przytrzymaj) | Tabela wyników |
| Escape | Pauza / zwolnienie myszy |

## Zasady

- Wyeliminuj przeciwną drużynę. W trakcie rundy nie ma odradzania.
- Mecz wygrywa pierwsza drużyna z 3 wygranymi rundami.
- Twoje zabójstwo daje 5 monet, śmierć kosztuje 1 monetę (saldo nie spada poniżej zera). Zabójstwa botów nie zmieniają twojego portfela.
- Zaczynasz z karabinkiem K-24, nożem i 10 monetami. Portfel zachowuje się między meczami w tej przeglądarce. Kupione bronie zachowujesz do końca meczu.
- Sklep przed każdą rundą: Viper SMG za 15, AK-47 za 25, Scout DMR za 35 monet. W sklepie można swobodnie wyposażać posiadane bronie.
- Amunicja jest ograniczona. Przeładowanie zużywa zapas. Skrzynka daje 2 magazynki amunicji zapasowej i leczy do 30 punktów zdrowia (maksymalnie 100).
- Każdą skrzynkę można otworzyć raz na rundę. Na nową rundę odradzają się obie drużyny i skrzynki, a amunicja się odnawia.
- Po śmierci obserwujesz ocalałego sojusznika. Po opuszczeniu okna gra automatycznie pauzuje.
- Postacie po śmierci rozpadają się na kostki w kolorach ich ekwipunku. Kostki wirują, odbijają się od podłoża i znikają po 2,6 sekundy.

## Cloudflare Pages

Adres gry: https://dzikikarabin.pages.dev

Konfiguracja `wrangler.jsonc` wskazuje osobny projekt Cloudflare Pages `dzikikarabin`. Z folderu `block-ops` można opublikować `dist` poleceniem `npm run deploy` lub `node ../node_modules/wrangler/bin/wrangler.js pages deploy dist --project-name dzikikarabin --branch main --commit-dirty=true` po uruchomieniu testów.

## Sprawdzenie

`npm test` lub `node --test tests/*.test.mjs` sprawdza ekonomię, zakupy, amunicję, zakończenie rundy, przechodniość tras botów, animacje śmierci i sterowanie wieloma palcami. `node --check dist/game.js` sprawdza składnię.

Three.js jest dołączone lokalnie w `dist/vendor/`; licencja w `THREE-LICENSE.txt`. Grafika, geometria i dźwięki są generowane w kodzie. Fonty Google są opcjonalne — dostępne są fonty zastępcze.
