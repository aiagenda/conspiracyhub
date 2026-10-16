# The Theorist — megvalósított upgrade

Állapot: helyi implementáció és ellenőrzés kész. Éles deploy, éles migráció és a korábbi cikkek tömeges átírása nem történt.

## Olvasói felület

- Az eredeti terminál és nyomozói műszerfal továbbfejlesztése: sötétzöld felület, Rajdhani címsorok, mono részletek, eredeti háromoszlopos hírfolyam, színkódolt rovatok. A korábbi magazinos átalakítás elvetve.
- Kompakt, ragadós fejléc, szem/triangulum emblémával és a változatlan The Theorist névvel. A monitorok, kutatási eszközök és Oracle továbbra is központi szerepet kapnak.
- A hírszalagon tényleges hírcímek jelennek meg; a mozgás megállítható, fókusznál/hovernél megáll, reduced-motion esetén kikapcsol.
- Folytatott olvasás és kompakt, háromeseményes szeizmikus sáv; kevesebb függőleges helyet foglaló rendezés és téma/időszűrés.
- Világosabb fotók, nagyobb és olvashatóbb címek, finom keretek és árnyékok, valós cikkazonosítók, prioritásjelzés, szavazósáv és külön AI-vizsgálati szempont. A Read & Investigate művelet minden kártyán megmarad.
- Egységes cikknézet, kiemelt Open investigation board gomb, AI-jelölés, olvasási idő, forráslista, mentés és olvasás folytatása. A hipotézisek külön jelölést kapnak.
- Közös keresés a hírekben és publikált elemzésekben, típus-, téma- és időszűrés, lapozás. A főoldali rendezés az adatbázisban, a lapozás előtt történik.
- Hat témaközpont, adat- és kutatásieszköz-központ, valamint nyilvános szerkesztési alapelvek.
- Valós olvasói reakciók: nincs mesterséges kezdőszavazat. A relevanciapontszám nem veszély- vagy igazságmérő.
- Egységes canonical domain; az új oldalak bekerültek a sitemapbe. A cikkek strukturált adatainál az elérhető módosítási idő is használatban van.

## Hírátvétel és cikkírás

- Teljes URL-ből számított SHA-256 azonosítók a rövidített Base64 helyett, canonical URL szerinti duplikációszűréssel és a korábbi azonosítók megőrzésével.
- Megszűnt a hírgyűjtő automatikus, hét nap utáni cikktörlése.
- A forráskutatás ténylegesen beolvasott forrásszöveget ad az írónak; a keresési snippet önmagában nem elég bizonyíték.
- A cikk, a hivatkozások és a forrásrészletek külön minőségi ellenőrzésen mennek át. A hibás vagy ellenőrizhetetlen generált cikk piszkozat marad. Hiányzó migráció mellett az új generált anyag szintén piszkozatként kerül mentésre.
- Nincs kötelező hosszú cikk vagy automatikus terjedelemnövelés. A brief, elemzés és hipotézis eltérő célt szolgál; a szöveg hossza a forrásokhoz igazodik.
- Az AI–tech író is ugyanazt a forrásellenőrzést és stabil történetazonosítást használja. A tech admin alapból piszkozatot készít.
- Az elveszett forráslink helyére nem kerül automatikusan egy másik dokumentum. A forrás címe és tényleges URL-je együtt marad.
- Régi vagy ismeretlen dátumú forrás nem elég a „latest/breaking/today” megfogalmazás alátámasztására. A generált cikkeknél megjelenik az elérhető forrásdátum és az ellenőrzés ideje.
- Az Oracle nem indít újabb AI-hívást pusztán azért, hogy egy üres elméletlistát feltöltsön. A prompt nem követel minimális számú spekulatív kapcsolatot.
- A forrásletöltő ellenőrzi a célcímet és az átirányításokat, és elutasítja a helyi/magánhálózati címeket.

## Szerkesztőség és üzemeltetés

- Az admin API-k JWT- és adminszerepkör-ellenőrzést végeznek az adatelérés és a fizetős munka előtt. A felület belépési ellenőrzést kapott.
- Content → Editorial review: piszkozatlista, hibák, szöveg- és forrásszerkesztés, emberi ellenőrzőlista és jegyzet, publikálás és visszaállítás piszkozatba.
- Szerkesztés után a jóváhagyás érvényét veszti. A mentés és a javító generálás verzióellenőrzéssel védett, hogy egy párhuzamos módosítást ne írjon felül.
- Az adatbázis korábbi, minden szerepkörre kiterjedő generated_articles szabálya a service_role szerepkörre szűkül: a piszkozatok nem olvashatók és a cikkek nem írhatók névtelen kliensből.
- Az időzítő tárolja az esedékességet, tranzakcióban foglal munkát, 10 perces futási zárral és legfeljebb három próbálkozással. A kimaradt időpontok pótolhatók. Ütemezésváltás közben egy régi worker nem állíthatja vissza a régi időpontot.
- Az admin megnyitása nem írja vissza az alapértelmezett ütemezéseket. Az egyes munkák a saját cronjuk szerint esedékesek; az éles Vercel Hobby csomag napi korlátja miatt a tick a korábbi 09:00 UTC időpontban fut. Az ötpercenkénti tickhez Pro csomag vagy külön külső ütemező szükséges.
- A közvetlen scraper és writer végpont fejlesztői környezetben is kér cron-hitelesítést. Helyi fejlesztéskor a PostHog inicializálása ki van kapcsolva.

## Ellenőrzések

- `npm test`: 22/22 sikeres teszt (azonosítók, forrásminőség, dátumok, reakciók, keresés, UTC cron, hitelesítés, forráscímek, üres elméletlista).
- TypeScript: sikeres (az arculati korrekció után is).
- ESLint: az ebben a munkában érintett 92 TypeScript/JavaScript fájlban 0 hiba, 0 figyelmeztetés. A korábban módosított `bragComposition.ts` és `bragPipeline.ts` nem része ennek az ellenőrzési körnek.
- `npm run build`: sikeres. Maradt egy kapcsolódó figyelmeztetés a már korábban módosított Brag pipeline `next.config.ts` importjának fájltracingjéről.
- Helyi HTTP-próba: 36 admin/scraper/writer/scheduler handler 401 választ adott névtelen kérésre.
- Elkülönített helyi PostgreSQL: mindkét migráció lefutott; tranzakciós SQL-próbák igazolták a kizárólagos foglalást, újrapróbálkozást, felső korlátot, lejárt worker visszautasítását, ütemezésváltást, RPC-jogosultságokat, jóváhagyás érvénytelenítését és a piszkozatok RLS-védelmét.
- Böngésző: asztali és 390 px mobilnézet, főoldali szűrő, mobilmenü, közös keresés, cikknézet, forrásugrás, témák, adatoldal, bejelentkezési ablak és admin belépési védelem ellenőrizve. Mobilon nem volt vízszintes túlcsordulás.
- A böngészős próba helyi, csak olvasható tesztadatokkal futott. Nem történtek valós AI-generálások, emailküldések vagy élő adminmódosítások. A teljes hitelesített szerkesztési folyamatot az éles integrációval még ellenőrizni kell.

## Helyi előnézet

`npm run preview:local` elindítja a Next előnézetet a `http://127.0.0.1:3011` címen és a csak olvasható fixture szervert az 55888-as porton. Ne indítsd másodszor, ha már fut. A főoldal a `scripts/preview-news.json` fájlban rögzített nyilvános eredeti hírcímeket és kép-URL-eket használja a valós összehasonlításhoz. A cikkbelsők és generált elemzések továbbra is kifejezetten demonstrációs szövegek; a képek a nyilvános forrásról töltődnek be. A helyi preview nem használja az éles Supabase-adatbázist.

A tesztfuttatóhoz Node 22.18+ szükséges; az ellenőrzés Node 26-tal történt. A `tests/api-access.mjs` csak localhost tesztszervert fogad el, például:

```sh
TEST_BASE_URL=http://127.0.0.1:3011 node tests/api-access.mjs
```

Az adatbázisteszt: `tests/database-invariants.sql`, kizárólag eldobható tesztadatbázishoz.

Képernyőképek a korrigált arculatról: `docs/upgrade-preview/desktop.jpg`, `desktop-stories.jpg`, `mobile-feed.jpg`, `mobile-reader.jpg`.

## Élesítési sorrend

1. A korábbi migrációkra építve alkalmazni kell a `20261015110000_editorial_quality.sql`, majd a `20261015130000_durable_scheduler.sql` migrációt.
2. Ezután telepíthető az alkalmazás. A cron a meglévő `CRON_SECRET`-et használja. A Vercel Hobby napi cronkorlátja miatt az éles tick 09:00 UTC-kor fut; az ötperces cron deployját a szolgáltató elutasította. Fizetős csomagra automatikus váltás nem történt.
3. Adminfiókkal ellenőrizni kell egy piszkozat megnyitását, mentését, ellenőrzését és publikálását, majd egy időzített munka futási naplóját. Az automatikus írók bizonyítékhiány esetén piszkozatot készítenek, tehát az alacsonyabb publikálási szám lehet a minőségszűrés helyes eredménye.

A régebbi publikált cikkek nem kapnak visszamenőleg ellenőrzött státuszt. A korábbi auditban jelzett elavult dátumokat, duplikációkat és gyenge hivatkozásokat az új szerkesztői felületen kell javítani. A tracker- és gráfeszközök saját részletes felületei megmaradtak; az új navigáció a Data központból teszi őket elérhetővé.

Visszaállításnál az új adatmezőket és forrásellenőrzési állapotot érdemes megtartani. A korábbi, korlátlan RLS-szabály visszaállítása ismét hozzáférhetővé tenné a piszkozatokat. A teljesen régi writer-verziót nem szabad változatlanul visszatenni az új minőségellenőrzési működés helyére.
