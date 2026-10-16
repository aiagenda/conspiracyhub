# The Theorist — teljes fejlesztési javaslat

Dátum: 2026. október 15. Projekt: `/Users/skrillex/conspiracyhub`. Élő oldal: https://www.the-theorist.com/.

Az audit a helyi forráskód, az élő főoldal, az Analysis lista és két cikk mintavételes vizsgálatára épül. A főoldalt és a hír olvasóját asztali nézetben, a hírolvasót 390 px szélességen is ellenőriztem. Nem történt éles adatbázis-módosítás, publikálás, privát adminadatok lekérése vagy alkalmazáskód-módosítás. Az éles deploy és a helyi checkout teljes azonossága nincs igazolva; a kódból levezetett megállapításokat ennek megfelelően kell kezelni. Nem teljes körű akadálymentességi, biztonsági vagy teljesítménymérés.

## Javasolt termékirány

**Forrásokra épülő, karakteres oknyomozó magazin, folyamatosan frissülő tematikus dossziékkal.** A The Theorist erőssége a kíváncsiság, a dokumentumok és kapcsolatok feltárása lehet. Az olvasó gyorsan értse meg, mi történt, mi új benne, mely állítás mire támaszkodik, és hol maradt nyitott kérdés.

Megtartandó: a név, a visszafogott zöld arculati elem, UAP/megfigyelés/technológia fókusz, kapcsolati gráf, tematikus adatnézetek, forráslinkek, mentés és folytatható olvasás, heti briefing. Már létezik többforrású import, kapcsolódó tartalom, SEO-metaadat, Search Console és PostHog is. Ezekre érdemes építeni.

## A legsürgősebb, igazolt hibák

### 1. Különböző hírek azonos importazonosítót kaphatnak

RSS, Google News és Reddit esetében az URL Base64-kódjának első 32 karaktere az azonosító. Ez az eredeti URL első 24 bájtját őrzi meg: az azonos kezdetű, eltérő cikk-URL-ek ütköznek. A deduplikáció és az upsert erre az értékre épül.

Két eltérő Google News-cím, valamint két eltérő subreddit-cím szintetikus példájával reprodukáltuk az ütközést. Ez konkrét mechanizmus arra, hogyan veszhetnek el hírek; az éles elveszett elemszámot nem mértük.

Bizonyíték: [RSS azonosító](/Users/skrillex/conspiracyhub/src/app/api/scraper/route.ts:76), [Google News](/Users/skrillex/conspiracyhub/src/app/api/scraper/route.ts:227), [Reddit](/Users/skrillex/conspiracyhub/src/app/api/scraper/route.ts:269), [deduplikáció](/Users/skrillex/conspiracyhub/src/app/api/scraper/route.ts:29).

Javaslat: normalizált teljes URL + teljes URL-ből készített hash; ezt követően külön eseményszintű csoportosítás. Meglévő adatok migrációjánál egyeztetési riport és visszaállíthatóság kell, hogy a javítás ne gyártson új duplikációkat.

### 2. A hét napnál régebbi hírek törlődnek

A scraper minden hét napnál régebbi `news_items` rekordot töröl, az átírt cikkeket sem kivéve. Az Oracle-kapcsolat alapmigrációja kaszkádolt törlést használ. Ez ütközik a tartós cikkarchívum és a felépülő dossziék céljával.

Bizonyíték: [törlés](/Users/skrillex/conspiracyhub/src/app/api/scraper/route.ts:318), [kapcsolódó séma](/Users/skrillex/conspiracyhub/supabase/migrations/20260508170500_init_schema.sql:19).

Javaslat: a régi hír kerüljön ki a friss feedből, de maradjon elérhető stabil URL-en. Külön archív státusz és megőrzési szabály a nyers importnak, a publikált cikknek és a bizonyítékoknak.

### 3. A pontszámok és reakciók jelentése nem megbízható

A pontozó összeesküvés-potenciált kér pusztán a címsorból. Ugyanez a szám a kártyán PRIORITY, a cikkben THREAT. A generált cikkek olvasója ráadásul fix 55-ös értéket kap. A reakciószámok valódi szavazatokhoz hozzáadott mesterséges induló értékeket tartalmaznak.

Bizonyíték: [pontozó prompt](/Users/skrillex/conspiracyhub/src/lib/prompts.ts:2), [csak címek](/Users/skrillex/conspiracyhub/src/app/api/scraper/route.ts:386), [PRIORITY](/Users/skrillex/conspiracyhub/src/components/NewsCard.tsx:96), [THREAT](/Users/skrillex/conspiracyhub/src/components/ArticleReader.tsx:514), [fix érték](/Users/skrillex/conspiracyhub/src/app/blog/[slug]/page.tsx:150), [mesterséges reakciók](/Users/skrillex/conspiracyhub/src/lib/readerReactionVote.ts:17).

Javaslat: az olvasó lásson érthető műfajt és bizonyítékállapotot; a szerkesztő kapjon külön relevancia-, újdonság- és forrásminőségi értékelést. A közönségvélemény kizárólag valódi reakciókból álljon. Százalékos igazság- vagy veszélyértéket csak világos, érvényes mérési modell mellett érdemes mutatni.

### 4. Túl rövid alapanyagból túl hosszú cikk készülhet

Az átírás már 80 karakter forrásszövegnél elindulhat, miközben a prompt 550–900 szót kér. Az ellenőrzés főként azt nézi, hogy nem üres és legalább 180 szavas-e a kimenet. A hosszúcikkek bővítője pedig 1800 szó alatt további hosszabbításra törekszik.

Bizonyíték: [belépési küszöb](/Users/skrillex/conspiracyhub/src/lib/server/newsArticleRewrite.ts:113), [hosszúsági feltétel](/Users/skrillex/conspiracyhub/src/lib/server/newsArticleRewrite.ts:73), [prompt](/Users/skrillex/conspiracyhub/src/lib/prompts.ts:97), [bővítő](/Users/skrillex/conspiracyhub/src/lib/server/articleExpand.ts:4).

Javaslat: az alapanyag határozza meg a műfajt és a terjedelmet. Rövid hírhez elég lehet 120–250 szó; magyarázóhoz 600–1000; mélyelemzéshez több, ha a bizonyíték indokolja. Ezek szerkesztési kiindulópontok, nem új kötelező szószámok.

### 5. A keresési találat még nem elolvasott bizonyíték

A kutatási modul címet, URL-t és legfeljebb 220 karakteres keresési kivonatot ad tovább, mégis ellenőrzötten elérhető oldalnak nevezi ezeket. Kutatási találat nélkül is folytatódhat a generálás, a normál hosszúcikk-útvonal közvetlenül publikál.

Bizonyíték: [kutatási adatok](/Users/skrillex/conspiracyhub/src/lib/server/articleResearch.ts:94), [ellenőrzöttség állítása](/Users/skrillex/conspiracyhub/src/lib/server/articleResearch.ts:113), [hiányzó kutatás](/Users/skrillex/conspiracyhub/src/lib/server/articleResearch.ts:63), [publikálás](/Users/skrillex/conspiracyhub/src/lib/server/generateArticleCore.ts:625).

Javaslat: teljes forrásoldal feldolgozása; állítás–bizonyíték kapcsolatok; szövegrész, kiadó, dátum, elérési idő és felhasználási szerep tárolása. A kritikus állítást ténylegesen alátámasztó részlet nélkül ne lehessen elemzést automatikusan publikálni. A forrásfüggetlenséget is ellenőrizni kell: ugyanannak a közleménynek több átvétele nem több független bizonyíték.

### 6. A dátumkezelés az élő tartalomban is félrevezető lehet

Az auditkor frissnek jelölt [NUFORC-cikk](https://www.the-theorist.com/blog/422-new-ufo-reports-nuforc-update-mv7tf1aq) címe „Latest Update”, miközben az alapul szolgáló [eredeti közlemény](https://nuforc.org/422-new-ufo-reports/) 2023. december 9-i. A cikk szövege tartalmazza a 2023-as dátumot, de a cím, a relatív publikálási idő és a visszatérő aktualitásállítások együtt félreérthetők. A forráslista egyik NUFORC-feliratú linkje a National Archives UAP-oldalára mutatott; a szövegbeli hivatkozás közben NUFORC-ra vezetett.

Javaslat: külön `event_date`, `source_published_at`, `source_updated_at`, `article_published_at` és `article_updated_at`. Régi esemény új elemzése legyen egyértelműen archív elemzés. Forrás URL-jének cseréjekor a cím és a hozzá kötött állítás újraellenőrzendő; általános témabeli hasonlóság nem elég.

A kódban azonosítottunk egy ezt előidézni képes hibát is: a forrásjavító az első engedélyezett domainű keresési találatot választja, majd csak az URL-t cseréli, a régi címet és leírást megtartva. [találatválasztás](/Users/skrillex/conspiracyhub/src/lib/searchSourceUrl.ts:49), [csak URL cseréje](/Users/skrillex/conspiracyhub/src/lib/searchSourceUrl.ts:109). Ez igazolt hibás mechanizmus; az adott éles cikk keletkezési naplója nélkül nem bizonyítható, hogy annak eltérését ez okozta. Sikertelen feloldáskor ellenőrizetlen jelölés vagy szerkesztői ellenőrzés szükséges, a talált másik dokumentum pedig külön forrásrekord legyen.

Példa jobb angol címre: **NUFORC’s December 2023 update: reports, limitations and open questions.** A lead pontosítsa, hogy bejelentésekről van szó; a bejelentésszámból önmagában nem következik a jelenségek gyakoriságának növekedése.

### 7. Ismétlődő történetek és elakadó feldolgozás

Az élő Analysis-listán az AATIP-, MKUltra-, Echelon- és nukleáris/AI-témák ismétlődő címekkel szerepelnek. A hírből cikket készítő útvonal új időbélyeges slugot hoz létre, ezen az ágon nincs azonos történetre vonatkozó ellenőrzés. A scraper új hírek hiányában az átírási backlog feldolgozása előtt visszatér; sok új hír pedig elhasználhatja a keretet a régebbi várakozók előtt.

Bizonyíték: [élő Analysis](https://www.the-theorist.com/blog), [cikkválasztás](/Users/skrillex/conspiracyhub/src/lib/server/generateArticleCore.ts:368), [új slug](/Users/skrillex/conspiracyhub/src/lib/server/generateArticleCore.ts:622), [korai visszatérés](/Users/skrillex/conspiracyhub/src/app/api/scraper/route.ts:364), [átírási sor](/Users/skrillex/conspiracyhub/src/app/api/scraper/route.ts:451).

Javaslat: egy eseményhez vagy tartós ügyhöz egy központi oldal, több forrás és verziózott frissítések. Külön tartós feladatsor a begyűjtésnek, kutatásnak, írásnak és ellenőrzésnek. Várakozási idő, újrapróbálás, hibaok és költség legyen látható.

### 8. A felület néhány alapművelete hiányosan működik

- A PRIORITY rendezés csak az aktuálisan betöltött 12 hírt rendezi át; nem a teljes állományt. [FeedScreen](/Users/skrillex/conspiracyhub/src/components/FeedScreen.tsx:156)
- A belső kereső `news_items` rekordokra keres, a saját `generated_articles` cikkek kimaradnak. [kereső API](/Users/skrillex/conspiracyhub/src/app/api/search/route.ts:89)
- Az Analysis lista 50 cikkre korlátozott, nincs lapozás vagy témaszűrés. [blog](/Users/skrillex/conspiracyhub/src/app/blog/page.tsx:44)
- A SiteNav bejelentkezési gombja opcionális handlert hív; több oldalon handler nélkül kapja a felület. [gomb](/Users/skrillex/conspiracyhub/src/components/SiteNav.tsx:146), [keresőoldali használat](/Users/skrillex/conspiracyhub/src/app/search/page.tsx:258)

Javaslat: szerveroldali teljes rendezés, URL-ben tárolt keresési/szűrési állapot, egységes kereső minden tartalomtípusra és központi bejelentkezés. Ezek a redesign elfogadási feltételei legyenek.

### 9. Üzemeltetési és hozzáférési javítások szükségesek

A repó napi 09:00 UTC scheduler-ticket állít be, de egyes jobok 07:00/08:00 vagy óránkénti ütemezésűek. A scheduler az aktuális perccel pontosan egyező feladatokat választja. Külső gyakoribb indítás nélkül ezek az eltérő időpontok kimaradnak. Az éles külső ütemezést nem ellenőriztük.

Bizonyíték: [Vercel](/Users/skrillex/conspiracyhub/vercel.json:4), [tick](/Users/skrillex/conspiracyhub/src/app/api/scheduler/tick/route.ts:35), [jobok](/Users/skrillex/conspiracyhub/src/lib/server/scraperScheduler.ts:265).

Több admin route-ból hiányzik a szerveroldali adminellenőrzés, bár a közös ellenőrző már létezik. Az élő kitettséget nem teszteltük, külső védelem jelenléte ismeretlen. A kiadás feltétele legyen minden adminművelet egységes védelme. [scrapers](/Users/skrillex/conspiracyhub/src/app/api/admin/scrapers/route.ts:32), [közös ellenőrző](/Users/skrillex/conspiracyhub/src/lib/server/requireAdminSession.ts:9).

## Javasolt designrendszer és oldalstruktúra

### Arculat

- Sötét grafit alap, törtfehér olvasószöveg, visszafogott zöld kiemelés. A piros valódi figyelmeztetéshez tartozzon.
- Karakteres szerkesztőségi címbetű és könnyen olvasható sans serif törzsszöveg; monospace az apró technikai metaadatokra.
- Cikktörzs 18–19 px körül, 1,6–1,75 sortávval és 65–72 karakter körüli sorhosszal. Mobilon legalább 17–18 px kiindulópontként, felhasználói nagyítás támogatásával.
- Nagyobb különbség a vezető hír, a másodlagos hírek és a rövid frissítések között. Következetes térközök, néhány jól definiált komponens.
- Fotók természetesebb fényerővel és színekkel. A jelenlegi rendszer minden főképet sötétít és színtelenít. [NewsCard](/Users/skrillex/conspiracyhub/src/components/NewsCard.tsx:75)
- A scanline, villogás és futó státuszszöveg kerüljön ki az alap olvasási felületből. A terminálhangulat a board speciális nézetében visszafogottan megőrizhető.

### Fő navigáció

**Latest · Investigations · Topics · Data**, külön jól megtalálható kereséssel és fiókkal. Az UAP, Seismic, Outbreaks és Insider Radar a Data/Topics alatt rendezhető. A Guide és Toolkit másodlagos menübe kerülhet. Így a látogató először a célját választja ki, és utána a konkrét eszközt.

### Főoldal

1. Rövid szerkesztői ajánló: mi érdemel ma figyelmet.
2. Egy vezető történet nagy címmel és képpel; mellette két másodlagos.
3. Rövid Latest lista, ahol a cím mellett valódi tartalmi összefoglaló, műfaj, forrás és frissítési idő látszik.
4. Folyamatosan követett ügyek/dossziék: mi változott a legutóbbi látogatás óta.
5. Külön adatszekció és releváns heti briefing-feliratkozás.

A mostani INGEST/GNEWS/SCRAPER/GPT-4o működési diagnosztika az adminba kerüljön. Olvasói információként a tartalom frissessége és forráseredete hasznos.

### Cikkoldal

A cím után rövid lead, műfaj, szerző vagy tényleges szerkesztőségi felelős, AI-közreműködés jelölése, megjelenés/frissítés és olvasási idő. Ezek alatt három tömör megállapítás, majd a cikk.

Ajánlott szerkezet: **Mi történt? → Mi támasztja alá? → Miért fontos? → Mi vitatott vagy ismeretlen? → Mi várható következőként?** A források az állítások mellett nyíljanak meg; a kapcsolati gráf külön elmélyülési lehetőség legyen. Mobilon a fix board- és feedback-elemek ne fedjék el az olvasott szöveget. Az egér föléhúzására épülő kiegészítések érintéssel és billentyűzettel is legyenek elérhetők.

### Dosszié és board

Minden tartós ügyhöz rövid áttekintés, szereplők, ellenőrzött idővonal, dokumentumtár, frissítési napló és nyitott kérdések. A gráf kapcsolatai jelöljék, milyen kapcsolatot támaszt alá melyik forrás. A „nincs igazolt kapcsolat” elfogadható eredmény legyen; ne kelljen minden témához elméletet generálni.

## Az új szerkesztési folyamat

**Begyűjtés → teljes szöveg kinyerése → URL- és történetdeduplikáció → dátumellenőrzés → szerkesztői kiválasztás → forráskutatás → állítás–bizonyíték lista → írás → ellenőrzés → publikálás → frissítés.**

Az AI szerepe lehet külön kutató, író és ellenőrző lépés. Az ellenőrző ugyanazokat a tényleges forrásrészleteket kapja meg, és konkrét hibákat jelezzen. Egy második modell önmagában nem jelent tényellenőrzést.

Javasolt publikálási szabályok:

- A cím ne állítson többet a szövegnél és a forrásnál.
- Az esemény ideje és az új elemzés ideje legyen megkülönböztethető.
- Lényeges név, szám, idézet, vád és oksági állítás legyen bizonyítékhoz köthető.
- Egyetlen forrásból készült átvétel egyértelműen így legyen jelölve; elemzésnél legyen független ellenőrzés, ahol elérhető.
- Vélemény, hipotézis, tanúbeszámoló és dokumentált tény külön kategória.
- A hiányzó forrás, ellentmondás vagy jelentős kockázat tegye szerkesztői várólistára a cikket.
- A szöveghossz és a keyword-sűrűség ne helyettesítse az információs érték ellenőrzését.
- Képaláírás csak a ténylegesen megjelenő képre vonatkozzon, pontos eredetmegjelöléssel.

Az admin főképernyője a feldolgozásra váró történeteket, duplikációkat, hibás forrásokat és ellenőrzendő állításokat mutassa. Legyen forrás–vázlat összehasonlítás, javítási előzmény és éles olvasói előnézet.

## Megvalósítási sorrend és elfogadási feltételek

| Csomag | Tartalom | Akkor kész, ha |
|---|---|---|
| 1. Megbízható alap | Importazonosító, tartós archívum, valós reakciók, egységes adminvédelem, scheduler és backlog | Külön URL-ek nem ütköznek; régi publikált cikk elérhető; adminhitelesítés nélkül nincs adminművelet; esedékes feladatok és hibák követhetők |
| 2. Szerkesztési minőség | Teljes forrás, dátumok, történetcsoportok, állításellenőrzés, műfajok, publikálási kapu | Rövid/hiányzó forrásból nem készül automatikus mélyelemzés; régi anyag nem „latest”; forrásfelirat és URL egyezik; ismételt történet a meglévőt frissíti |
| 3. Új olvasói felület | Főoldal, cikkoldal, navigáció, egységes kereső, mobil, hozzáférhetőség | A felhasználó gyorsan megtalálja a fontos történetet és annak bizonyítékát; a kereső saját cikket is talál; minden alapművelet mobilon és billentyűzettel működik |
| 4. Visszatérés és optimalizálás | Dossziék, témakövetés, frissítési értesítések, heti briefing, mérés | A mentett/követett ügy új fejleménye könnyen észrevehető; a mérés elválasztja az olvasói érdeklődést a puszta megnyitástól |

A designrendszer és a cikkoldal tervezése az első két csomaggal párhuzamosan indulhat. Teljes keretrendszercsere szükségességét az audit nem mutatta ki; a meglévő Next.js/Supabase alap fejleszthető.

## Hogyan derüljön ki, hogy jobb lett?

Először legyen alapmérés, utána célérték. Olvasói oldalon: érdemi olvasási idő, befejezett olvasás, forrásmegnyitás, mentés, kapcsolódó cikk megnyitása, heti visszatérés. Szerkesztőségi oldalon: forrásonként sikeres átvétel, duplikációarány, feldolgozási késés, forrással alátámasztott lényeges állítások aránya, elutasítás és javítás oka, egy jóváhagyott cikk költsége.

Kezdetben egy szerkesztő által ellenőrzött, változatos mintán érdemes összehasonlítani a jelenlegi és az új folyamatot: rövid hír, többforrású elemzés, régi dokumentum, ellentmondó források, hiányzó teljes szöveg, duplikált esemény és későbbi helyesbítés. A legfontosabb hibákhoz célzott automatizált ellenőrzés kell, a szöveg minőségét pedig emberi értékelés is mérje.

SEO-feladatként központosított domain, valódi frissítési dátum, tartós cikk-URL, megfelelő 404, publikálhatósághoz kötött sitemap és témaközpontok javasoltak. A meglévő metaadatok jó alapot adnak, de a gyenge vagy ismétlődő tartalom újabb indexelése nem legyen önálló sikerfeltétel.

## Ajánlott első konkrét eredmény

Egy javított hírimport és egy teljes, új olvasási út: **főoldal → cikk → állításhoz tartozó forrás → kapcsolódó dosszié**. Ehhez társuljon az adminban egy ellenőrizhető szerkesztési sor. Ez már kézzelfoghatóan megmutatja a teljes upgrade értékét, és megfelelő alapot ad a többi tracker és nézet átalakításához.
