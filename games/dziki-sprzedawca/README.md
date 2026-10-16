# Dziki Sprzedawca

Gra przeglądarkowa 3D FPS. Rozpoczynasz ze 100 zł, znajdujesz okazje na targu, ustalasz ceny na swoim straganie i sprzedajesz towary klientom NPC. Cel: milion złotych gotówki.

Publiczna gra: https://dzikisprzedawca.pages.dev

## Uruchomienie lokalne

W tym folderze uruchom `node server.cjs` i otwórz http://127.0.0.1:4173. Biblioteka i wszystkie zasoby są lokalne; po pobraniu gra nie potrzebuje zewnętrznych serwisów. Moduły wymagają serwera HTTP i przeglądarki z WebGL 2.

## Sterowanie

- WASD lub strzałki: ruch; mysz: rozglądanie; Shift: bieg; Spacja: skok.
- E: kup przedmiot na celowniku lub otwórz własny stragan.
- B: plecak, ustalanie cen i wystawianie towaru; ponowne B wraca do gry (poza edycją pola ceny).
- N: następny dzień; Esc: pauza i uwolnienie kursora.
- Bez przechwycenia kursora przytrzymaj lewy przycisk myszy i przeciągaj.
- Dotyk: przyciski kierunkowe, przycisk zakupu i plecaka oraz przesuwanie palcem po świecie.

## Handel i klienci

24 stoiska oferują codziennie 72 przedmioty z 7 branż: elektroniki retro, designu, kolekcjonerstwa, ubrań, telefonów, jedzenia i różności. Katalog obejmuje 55 typów towarów. Droższe przedmioty pojawiają się wraz ze wzrostem kapitału. Notowania zmieniają się co dzień.

Kupiony przedmiot trafia do plecaka. W panelu B gracz wybiera gotową cenę (szybka sprzedaż, rynkowa lub +20%), korzysta z przycisków +/− albo wpisuje własną kwotę z przecinkiem lub kropką, po czym klika „Wystaw”. Przycisk zbiorczy wystawia wszystkie niewystawione towary. Wpisywanie nie jest przerywane przez zakupy innych NPC. Towar pojawia się na zielonym straganie przy wejściu. Wystawienie i zmiana ceny nie wypłacają pieniędzy. Ofertę można wycofać, zachowując przedmiot.

18 klientów NPC porusza się alejkami, podchodzi do stoisk, ogląda ofertę i decyduje o zakupie na podstawie budżetu, zainteresowań i tolerancji cenowej. Po zakupie płaci dokładnie cenę ustaloną przez gracza. Zawyżone oferty mogą pozostać niesprzedane. NPC kupują także od innych wystawców; zakupiony towar znika ze stoiska. Udane zakupy widać w dymkach, torbach NPC, licznikach i historii sprzedaży.

Plecak i wystawione przedmioty dzielą limit 8 sztuk. Klienci działają również podczas ustalania cen w panelu B. Esc, poradnik, zamknięcie plecaka bez wznowienia i przejście do innej karty zatrzymują symulację. Dzień trwa 4 minuty aktywnego targu. Wykupione przedmioty są uzupełniane co 12–18 sekund, także po zakupach NPC. Nowa dostawa nie zmienia pozostałych ofert. Nowy dzień odświeża stoiska i notowania, zachowując towar oraz własne ceny. Gdy gracz pozostaje z pustym plecakiem i mniej niż 2 zł, pomoc przy rozstawianiu następnego targu zapewnia 25 zł na ponowny start.

## Zapis

Gra zapisuje transakcje, własne oferty i nowe dni w localStorage. Zapis pierwszej wersji jest migrowany przy uruchomieniu na tym samym adresie. Pamięć przeglądarki jest przypisana do domeny, więc zapis spod poprzedniego adresu ChatGPT Site nie przechodzi automatycznie na Cloudflare Pages. Poradnik pozwala rozpocząć nową grę po potwierdzeniu.

## Weryfikacja i publikacja

`node --test economy.test.js customers.test.js market.test.js` sprawdza ekonomię, własne ceny, decyzje i ruch klientów, brak podwójnych sprzedaży, zapis, migrację i osiągalność miliona.

`node build.cjs` przygotowuje wyłącznie zasoby gry w `dist/`. Publikacja z tego folderu: `node ../node_modules/wrangler/bin/wrangler.js pages deploy dist --project-name dzikisprzedawca --branch main`. Projekt Pages jest już utworzony. Wymagane są uprawnienia Pages write na skonfigurowanym koncie Cloudflare.

Materiały nawierzchni, tkanin i drewna powstają lokalnie. Statyczna geometria jest łączona według materiału dla płynniejszego renderowania większego targu. Three.js r170 używa licencji MIT, dołączonej w `vendor/THREE-LICENSE.txt`.

## Negocjacje i urządzenia dotykowe

Klient odrzucający cenę gracza czeka około 50 sekund. Kliknięcie lub dotknięcie NPC w zasięgu 8 metrów (albo wycelowanie i E) otwiera rozmowę. Można przyjąć jego ofertę lub zaproponować własną cenę; trzy odrzucone próby kończą rozmowę. Wybrany towar jest zarezerwowany przed innymi klientami do końca negocjacji. Zmiana dnia czeka na zakończenie rozmowy, aby nie zmieniać uzgodnionych kwot.

Strona zawiera wyłącznie ramkę gry. Na telefonach i tabletach zajmuje cały dostępny ekran, uwzględniając bezpieczne obszary urządzenia. Lewy joystick zapewnia analogowy ruch, druga dłoń rozgląda się po scenie, a przyciski służą do działania, biegu, skoku, plecaka i pauzy. Orientacja pionowa oraz pozioma są obsługiwane. Ustawienia w pauzie pozwalają ręcznie włączyć sterowanie dotykowe. Zapis z wcześniejszych 16 stoisk jest rozszerzany do 24 z zachowaniem kapitału, towaru i własnych cen.
