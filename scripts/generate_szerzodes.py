#!/usr/bin/env python3
"""Generate comprehensive PROJEKTÁTRUHÁZÁSI ÉS INGATLANFEJLESZTÉSI VÁLLALKOZÁSI SZERZŐDÉS."""

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Cm, Pt
from docx.oxml.ns import qn


def set_document_margins(doc, top=2.5, bottom=2.5, left=3.0, right=2.5):
    section = doc.sections[0]
    section.top_margin = Cm(top)
    section.bottom_margin = Cm(bottom)
    section.left_margin = Cm(left)
    section.right_margin = Cm(right)


def styled_run(p, text, bold=False, italic=False, size=11):
    run = p.add_run(text)
    run.bold = bold
    run.italic = italic
    run.font.size = Pt(size)
    run.font.name = "Times New Roman"
    run._element.rPr.rFonts.set(qn("w:eastAsia"), "Times New Roman")
    return run


def add_title(doc, text, size=14):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    styled_run(p, text, bold=True, size=size)


def add_para(doc, text, bold=False, indent=0, space_after=6):
    p = doc.add_paragraph()
    if indent:
        p.paragraph_format.left_indent = Cm(indent)
    p.paragraph_format.space_after = Pt(space_after)
    p.paragraph_format.line_spacing = 1.15
    styled_run(p, text, bold=bold)
    return p


def add_section(doc, number, title):
    add_para(doc, f"{number}. {title}", bold=True, space_after=4)


def add_clause(doc, text, indent=1.0):
    add_para(doc, text, indent=indent)


def add_bullet(doc, text, indent=1.5):
    add_para(doc, f"• {text}", indent=indent)


def main():
    doc = Document()
    set_document_margins(doc)
    style = doc.styles["Normal"]
    style.font.name = "Times New Roman"
    style.font.size = Pt(11)

    # ── FEJLÉC ──
    add_title(doc, "PROJEKTÁTRUHÁZÁSI ÉS INGATLANFEJLESZTÉSI")
    add_title(doc, "VÁLLALKOZÁSI SZERZŐDÉS", size=14)
    doc.add_paragraph()
    add_para(doc, "szerződésszám: ………………………………………", indent=0)
    add_para(doc, "kelt: ……………………, 2026. ………… napja", indent=0)
    doc.add_paragraph()

    # ── BEVEZETŐ ──
    add_para(
        doc,
        "Jelen Projektátruházási és Ingatlanfejlesztési Vállalkozási Szerződés "
        "(a továbbiakban: „Szerződés”) az alábbi felek között jött létre:",
    )

    add_para(doc, "I. fél – Megrendelő / Projektátvevő:", bold=True)
    add_clause(
        doc,
        "Név: First Beauty Korlátolt Felelősségű Társaság\n"
        "Rövid név: First Beauty Kft.\n"
        "Székhely: 1202 Budapest, Klapka utca 110.\n"
        "Cégjegyzékszám: 01-09-321396\n"
        "Adószám: 26273608-2-43\n"
        "Képviseli: ………………………………………, ………………………………………\n"
        "Bankszámlaszám: ………………………………………\n"
        "E-mail: ………………………………………\n"
        "Telefon: ………………………………………\n"
        "(a továbbiakban: „Megrendelő” vagy „Projektátvevő”)",
    )

    add_para(doc, "II. fél – Vállalkozó / Projektátadó:", bold=True)
    add_clause(
        doc,
        "Név: Taking-System Ingatlanközvetítő, Szolgáltató és Tanácsadó "
        "Korlátolt Felelősségű Társaság\n"
        "Rövid név: Taking-System Kft.\n"
        "Székhely: 2145 Kerepes, József Attila park 1. 2. em. 21. ajtó\n"
        "Cégjegyzékszám: 13-09-172196\n"
        "Adószám: 25043790-1-13\n"
        "Képviseli: ………………………………………, ………………………………………\n"
        "Bankszámlaszám: ………………………………………\n"
        "E-mail: ………………………………………\n"
        "Telefon: ………………………………………\n"
        "(a továbbiakban: „Vállalkozó” vagy „Projektátadó”)",
    )

    add_clause(
        doc,
        "A Megrendelő és a Vállalkozó a továbbiakban együttesen: „Felek”, "
        "külön-külön: „Fél” megnevezéssel illetődnek.",
    )
    doc.add_paragraph()

    # ── 1. FOGLALMAK ──
    add_section(doc, "1", "FOGLALMAK ÉS ÉRTELMEZŐ RENDELKEZÉSEK")

    definitions = [
        ("Pályázat", "A GINOP Plusz-1.2.1-21 azonosítójú, „A mikro-, kis- és "
         "középvállalkozások modern üzleti és termelési kihívásokhoz való "
         "alkalmazkodását segítő fejlesztések támogatása” című pályázati "
         "felhívás, annak módosításai, valamint a kapcsolódó útmutatók és "
         "mellékletei."),
        ("Támogatás", "A Vállalkozó által a Pályázat keretében elnyert, "
         "vissza nem térítendő uniós és hazai forrású támogatás, "
         "amely a támogatói okiratban rögzített feltételek szerint "
         "került engedélyezésre és részben folyósításra, és amelynek "
         "a kedvezményezettjére visszafizetési kötelezettség nem terheli "
         "a szabályszerű felhasználás és elszámolás teljesítése esetén."),
        ("Támogatói okirat", "Az Irányító Hatóság által a Vállalkozó "
         "részére kiállított, a Támogatás összegét, felhasználási "
         "feltételeit, határidőit, valamint az elszámolási és "
         "fenntartási kötelezettségeket tartalmazó hatósági okirat "
         "(TO szám: ………………………………………)."),
        ("Irányító Hatóság", "A Támogatás engedélyezéséért, ellenőrzéséért "
         "és elszámolásáért felelős, a Pályázat felhívásában meghatározott "
         "magyar illetékes hatóság."),
        ("Projekt", "A Vállalkozó által a Pályázat keretében benyújtott "
         "és jóváhagyott fejlesztési projekt, amely ingatlanfejlesztési "
         "beruházást és kapcsolódó fejlesztési tevékenységet foglal magában."),
        ("Átruházott Támogatási Keret", "A Támogatás azon, a Vállalkozó "
         "által még fel nem használt része, amely a jelen Szerződés "
         "alapján átruházásra kerül, összesen 262 000 000 (kettőszázhatvankétmillió) "
         "forint, ezen belül: (a) 82 000 000 (nyolcvankétmillió) forint; "
         "és (b) 180 000 000 (száznyolcvanmillió) forint."),
        ("Projektátadás", "A Projekt teljes körű átruházása, amely magában "
         "foglalja a Támogatáshoz kapcsolódó jogok, kötelezettségek, "
         "dokumentumok és a fel nem használt támogatási keret "
         "átszolgáltatását a Megrendelő részére."),
        ("Kedvezményezett-változás", "A támogatási jogviszonyban a "
         "kedvezményezett személyének megváltoztatására irányuló, az "
         "Irányító Hatóságnál lefolytatandó adminisztratív eljárás."),
        ("Fenntartási időszak", "A támogatói okiratban meghatározott "
         "időtartam, amely alatt a Megrendelő köteles a Projekt "
         "eredményeit és a Támogatás felhasználásának szabályszerűségét "
         "fenntartani."),
        ("Elszámolás", "A Támogatás felhasználásának és a Projekt "
         "megvalósításának a támogatói okiratban és a hatályos "
         "jogszabályokban meghatározott módon történő beszámolása "
         "az Irányító Hatóság felé."),
    ]

    for i, (term, definition) in enumerate(definitions, 1):
        add_clause(doc, f"1.{i}. „{term}”: {definition}")

    add_clause(
        doc,
        "1.11. A jelen Szerződésben nem külön meghatározott fogalmakra "
        "a hatályos magyar jogszabályok, különösen a Polgári Törvénykönyvről "
        "szóló 2013. évi V. törvény (a továbbiakban: „Ptk.”), valamint "
        "az uniós és hazai támogatási jogszabályok rendelkezései irányadók.",
    )
    doc.add_paragraph()

    # ── 2. JOGALAP ──
    add_section(doc, "2", "JOGALAP ÉS ALAPELVEK")

    legal_clauses = [
        "2.1. Jelen Szerződés a felek szabad akaratából, a Ptk. 6:58. § "
        "(vállalkozási szerződés) alapján jött létre, és a Ptk. 6:§ 6:1–6:9. "
        "(a szerződés létrejötte) rendelkezései szerint hatályos.",
        "2.2. A Felek kijelentik, hogy jelen Szerződés megkötésére "
        "jogosultak, képviselőik az aláíráshoz szükséges "
        "cégjogi felhatalmazással rendelkeznek a gazdasági társaságokról "
        "szóló 2006. évi IV. törvény (a továbbiakban: „Gttv.”) "
        "6:3. § (képviselő) és 3:113. § (ügyvezető) rendelkezései alapján.",
        "2.3. A Támogatás felhasználására, elszámolására, ellenőrzésére "
        "és visszafizetésére vonatkozó szabályokat az alábbi jogszabályok "
        "és jogforrások határozzák meg:",
        "     a) az Európai Parlament és a Tanács (EU) 2021/1060 rendelete "
        "a költségvetési támogatások, az Európai Beruházási Bank által "
        "kezelt eszközök és az egyes uniós alapok igénybevételének "
        "szabályairól (a továbbiakban: „CPR rendelet”);",
        "     b) a 2021–2027. számú Európai Uniós programozási időszakban "
        "a kohéziós célok elérését biztosító egyes uniós alapokból "
        "származó támogatások felhasználásának szabályairól szóló "
        "272/2024. (VII. 23.) Korm. rendelet (a továbbiakban: "
        "„272/2024. Korm. rendelet”);",
        "     c) a 272/2024. Korm. rendelet 1. mellékletében foglalt "
        "Általános Útmutató;",
        "     d) a Pályázat felhívása, annak módosításai és mellékletei;",
        "     e) a támogatói okirat és annak esetleges módosításai;",
        "     f) a szabálytalan allokációról szóló 2016. évi LIII. törvény "
        "(a továbbiakban: „Szaa tv.”);",
        "     g) az államháztartásról szóló 2011. évi CXCV. törvény "
        "(a továbbiakban: „Áht.”) támogatásokra vonatkozó rendelkezései.",
        "2.4. A Felek rögzítik, hogy a Támogatás vissza nem térítendő "
        "támogatásnak minősül: a kedvezményezett a támogatás "
        "szabályszerű felhasználása és elszámolása teljesítése "
        "esetén nem köteles azt visszafizetni. A Támogatás uniós "
        "forrásból származik, és felhasználása során az uniós és hazai "
        "támogatási szabályok, valamint az átláthatósági és "
        "közbeszerzési előírások maradéktalan betartása kötelező.",
        "2.5. A Felek rögzítik, hogy jelen Szerződés a Felek között "
        "annak aláírásával lép hatályba, és nem minősül feltételes "
        "szerződésnek a Ptk. 6:81. § (feltételes kötelezettség) "
        "értelmében. Ugyanakkor a Felek tudomásul veszik, hogy a "
        "támogatási jogviszonyban a kedvezményezett személyének "
        "megváltoztatása külön hatósági eljárást igényel.",
    ]
    for c in legal_clauses:
        add_clause(doc, c)
    doc.add_paragraph()

    # ── 3. TÁRGY ──
    add_section(doc, "3", "A SZERZŐDÉS TÁRGYA")

    subject_clauses = [
        "3.1. Jelen Szerződés tárgya, hogy a Vállalkozó – mint a Pályázat "
        "keretében elnyert Támogatás eredeti kedvezményezettje – a "
        "Projekthez kapcsolódó valamennyi jogot, kötelezettséget, "
        "dokumentumot és az Átruházott Támogatási Keretet a Megrendelő "
        "részére átruházza, a Megrendelő pedig azokat teljes egészében "
        "átveszi, és vállalja a Projekt további megvalósítását.",
        "3.2. A Vállalkozó kijelenti és szavatolja, hogy:",
        "     a) a Pályázatot szabályosan benyújtotta, a Támogatást "
        "elnyerte, és a támogatói okirat hatályba lépett;",
        "     b) a Támogatás részben folyósításra került a Vállalkozó "
        "bankszámlájára, és a Támogatás vissza nem térítendő "
        "támogatásnak minősül;",
        "     c) az Átruházott Támogatási Keret (262 000 000 forint) "
        "még fel nem használt, szabadon rendelkezhető támogatási összeg;",
        "     d) az Átruházott Támogatási Keretre harmadik személynek "
        "nincs joga, zálogjoga, vagy egyéb igénye.",
        "3.3. A Megrendelő kijelenti és szavatolja, hogy:",
        "     a) megismerte a Pályázat felhívását, a támogatói okirat "
        "rendelkezéseit, valamint a Támogatás felhasználására vonatkozó "
        "valamennyi jogszabályi és szerződéses kötelezettséget;",
        "     b) a Pályázat kedvezményezetti feltételeinek megfelel, "
        "különösen mikro-, kis- vagy középvállalkozásnak minősül "
        "az Európai Unió 651/2014/EU bizottsági rendelet "
        "(a továbbiakban: „Általános csoportmentességi rendelet”) "
        "1. melléklete szerinti meghatározás alapján;",
        "     c) nem áll fenn olyan körülmény, amely a Támogatás "
        "átvételét jogszabály vagy a Pályázat feltételei alapján "
        "kizárná, különös tekintettel a 272/2024. Korm. rendelet "
        "2. § (2) bekezdésében foglalt kizáró okokra;",
        "     d) nem szerepel az Általános Útmutató 1. számú mellékletében "
        "foglalt, támogatásból kizárt tevékenységek között.",
        "3.4. A Vállalkozó a Megrendelő fenti megfelelőségi nyilatkozatainak "
        "ismeretében ruházza át a Projektet és az Átruházott Támogatási "
        "Keretet.",
        "3.5. A Felek határozottan rögzítik, hogy a Támogatás vissza nem "
        "térítendő támogatás. A Vállalkozó kijelenti és szavatolja, "
        "hogy a támogatói okirat a Támogatást vissza nem térítendő "
        "támogatásként határozta meg, a Támogatás nem minősül "
        "visszafizetendő kölcsönnek vagy kamatozó hitelnek, és a "
        "kedvezményezett – a Projekt szabályszerű megvalósítása és "
        "elszámolása teljesítése esetén – nem köteles a Támogatást "
        "visszafizetni.",
        "3.6. A Felek tudomásul veszik, hogy a Támogatás vissza nem "
        "térítendő jellege nem mentesíti a Megrendelőt a támogatói "
        "okiratban, a Pályázat felhívásában és a hatályos "
        "jogszabályokban – különösen a Szaa tv. és a 272/2024. Korm. "
        "rendelet 1. mellékletében foglalt Általános Útmutató "
        "2.4. fejezetében – meghatározott szabálytalanság, "
        "nem szabályszerű felhasználás vagy elszámolási hiány "
        "esetén fennálló visszafizetési kötelezettség alól.",
    ]
    for c in subject_clauses:
        add_clause(doc, c)
    doc.add_paragraph()

    # ── 4. TÁMOGATÁSI JOGVISZONY ──
    add_section(doc, "4", "A TÁMOGATÁSI JOGVISZONY ÉS A KEDVEZMÉNYEZETT-VÁLTOZÁS")

    grant_clauses = [
        "4.1. A Felek tudomásul veszik, hogy a jelen Szerződés önmagában "
        "nem eredményezi automatikusan a kedvezményezett személyének "
        "megváltozását a támogatási jogviszonyban. A Megrendelő "
        "kedvezményezettként történő elismerése az Irányító Hatóság "
        "vonatkozó döntésével, illetve a támogatói okirat vagy "
        "támogatási szerződés módosításával válik hatályossá.",
        "4.2. A Felek vállalják, hogy a Projektátadásnak és a "
        "kedvezményezetti jogutódlásnak a támogatási jogviszonyban "
        "történő átvezetése érdekében szükséges valamennyi nyilatkozatot, "
        "kérelmet és dokumentumot haladéktalanul, de legkésőbb a jelen "
        "Szerződés aláírásától számított 15 (tizenöt) naptári napon "
        "belül benyújtják az Irányító Hatóság részére.",
        "4.3. A kedvezményezett-változási eljárás során a Felek "
        "külön-külön, de egymással összhangban kötelesek benyújtani:",
        "     a) a kedvezményezett-változási kérelmet;",
        "     b) a jelen Szerződés másolatát, vagy annak hiteles "
        "extractumát;",
        "     c) a Megrendelő kedvezményezetti megfelelőségét igazoló "
        "dokumentumokat (cégkivonat, adóigazolás, NAV igazolás, "
        "MEKH/NAV adóigazolás a 272/2024. Korm. rendelet "
        "2. § (2) bekezdés c) pontja alapján);",
        "     d) a Projekt megvalósítási helyszínének és tartalmának "
        "módosítására vonatkozó kérelmet, amennyiben szükséges;",
        "     e) a Vállalkozó nyilatkozatát az Átruházott Támogatási "
        "Keret fel nem használt jellegéről;",
        "     f) a Megrendelő nyilatkozatát a Pályázat feltételeinek "
        "megfeleléséről és a Projekt átvételéről;",
        "     g) az Irányító Hatóság által esetlegesen kért egyéb "
        "dokumentumokat.",
        "4.4. A Felek az eljárás során egymással teljeskörűen "
        "együttműködnek, és haladéktalanul tájékoztatják egymást "
        "minden olyan körülményről, hatósági kérdésről vagy "
        "hiánypótlási felhívásról, amely a kedvezményezett-változás "
        "ügyében felmerül.",
        "4.5. A kedvezményezett-változás eljárási költségeit és "
        "díjait a Felek egyenlő arányban viselik, kivéve, ha "
        "írásban ettől eltérően állapodnak meg.",
        "4.6. Amennyiben az Irányító Hatóság a kedvezményezett-változást "
        "elutasítja, a Felek kötelesek haladéktalanul egyeztetni a "
        "további lépésekről. A Vállalkozó ebben az esetben nem "
        "követelheti a jelen Szerződés szerinti díj teljes megfizetését, "
        "ha az elutasítás oka kizárólag a Vállalkozó korábbi "
        "szabálytalanságából ered.",
        "4.7. A Felek tudomásul veszik, hogy a Támogatás felhasználása "
        "során az Irányító Hatóság, az Állami Számvevőszék, az "
        "Európai Számvevőszék, az Európai Csalás Elleni Hivatal "
        "(OLAF), valamint a Magyar Államkincstár ellenőrzési "
        "jogosultsággal rendelkezik a 272/2024. Korm. rendelet "
        "és a CPR rendelet alapján.",
    ]
    for c in grant_clauses:
        add_clause(doc, c)
    doc.add_paragraph()

    # ── 5. PROJEKTÁTADÁS ──
    add_section(doc, "5", "A PROJEKTÁTADÁS RÉSZLETES SZABÁLYAI")

    transfer_clauses = [
        "5.1. A Vállalkozó a Projektátadást a jelen Szerződés aláírásától "
        "számított 5 (öt) munkanapon belül köteles teljesíteni.",
        "5.2. A Projektátadás során a Vállalkozó köteles a Megrendelő "
        "részére átadni az alábbi dokumentumokat (a továbbiakban: "
        "„Átadási Dokumentáció”):",
        "     a) a támogatói okirat eredeti példányát vagy hiteles "
        "másolatát;",
        "     b) a Pályázathoz benyújtott teljes pályázati anyagot;",
        "     c) a Támogatás eddigi felhasználásáról szóló elszámolásokat;",
        "     d) a Projekt megvalósításához kapcsolódó valamennyi "
        "szerződést, megállapodást, számlát, bizonylatot;",
        "     e) az ingatlanfejlesztési beruházáshoz kapcsolódó "
        "engedélyeket, terveket, szakmai dokumentációt;",
        "     f) a Támogatás folyósításáról szóló bankszámlakivonatokat;",
        "     g) az Irányító Hatósággal folytatott levelezést;",
        "     h) a fenntartási kötelezettségekre vonatkozó dokumentumokat;",
        "     i) az Átruházott Támogatási Keret pontos kimutatását.",
        "5.3. A Projektátadásról a Felek jegyzőkönyvet vesznek fel, "
        "amely tartalmazza az átadott dokumentumok felsorolását, "
        "az átadás időpontját, valamint a Felek aláírását. "
        "A jegyzőkönyv a jelen Szerződés elválaszthatatlan "
        "1. számú mellékletét képezi.",
        "5.4. A Megrendelő az Átadási Dokumentáció átvételétől "
        "számított 3 (három) munkanapon belül köteles jelezni, "
        "ha hiányosságot, ellentmondást vagy hibát észlel. "
        "Az észlelt hiányosságokat a Vállalkozó 5 (öt) munkanapon "
        "belül köteles pótolni.",
        "5.5. A Projektátadás a jegyzőkönyv aláírásával tekintendő "
        "teljesítettnek a Felek között, ettől függetlenül attól, "
        "hogy a kedvezményezett-változás az Irányító Hatóságnál "
        "még folyamatban van.",
    ]
    for c in transfer_clauses:
        add_clause(doc, c)
    doc.add_paragraph()

    # ── 6. MEGRENDELŐ KÖTELEZETTSÉGEI ──
    add_section(doc, "6", "A MEGRENDELŐ KÖTELEZETTSÉGEI")

    client_clauses = [
        "6.1. A Megrendelő köteles a Projektet a támogatói okiratban "
        "és a Pályázat felhívásában foglalt feltételeknek megfelelően, "
        "a határidők betartásával megvalósítani.",
        "6.2. A Megrendelő köteles az Átruházott Támogatási Keretet "
        "kizárólag a Projekt céljaira, a támogatói okiratban "
        "meghatározott támogatható költségtételekre, elszámolható "
        "költségekre és a 272/2024. Korm. rendelet 1. mellékletében "
        "foglalt Általános Útmutató előírásainak megfelelően "
        "felhasználni.",
        "6.3. A Megrendelő köteles a Támogatás felhasználásáról, "
        "elszámolásáról, valamint az esetleges fenntartási "
        "kötelezettségekről a hatályos jogszabályoknak, különösen "
        "a 272/2024. Korm. rendelet 1. § (3) bekezdésében hivatkozott "
        "Általános Útmutató 2. fejezetének (elszámolás) rendelkezéseinek "
        "megfelelően gondoskodni.",
        "6.4. A Megrendelő köteles az Irányító Hatóság ellenőrzései "
        "során teljes körűen együttműködni, és a kért dokumentumokat "
        "haladéktalanul rendelkezésre bocsátani.",
        "6.5. A Megrendelő köteles a Fenntartási időszak alatt "
        "a Projekt eredményeit a támogatói okiratban foglaltak "
        "szerint fenntartani, és nem hozhat olyan döntést, amely "
        "a Projekt céljainak megvalósulását veszélyezteti.",
        "6.6. A Megrendelő köteles a Vállalkozóval együttműködni "
        "az Irányító Hatóságnál szükséges adminisztratív eljárások "
        "lefolytatásában, különös tekintettel a 4. fejezetben "
        "foglalt kedvezményezett-változási eljárásra.",
        "6.7. A Megrendelő köteles a jelen Szerződés 7. fejezete "
        "szerinti díjat a Vállalkozó részére határidőben megfizetni.",
        "6.8. A Megrendelő köteles a Támogatás felhasználása során "
        "betartani az átláthatósági követelményeket, különösen "
        "a CPR rendelet 49. cikkében (közérdekű adatok) és a "
        "272/2024. Korm. rendelet 1. mellékletében foglalt "
        "Általános Útmutató 1.3. fejezetében (publikációs "
        "kötelezettség) foglaltakat.",
    ]
    for c in client_clauses:
        add_clause(doc, c)
    doc.add_paragraph()

    # ── 7. VÁLLALKOZÓ KÖTELEZETTSÉGEI ──
    add_section(doc, "7", "A VÁLLALKOZÓ KÖTELEZETTSÉGEI ÉS SZAVATOSSÁGA")

    contractor_clauses = [
        "7.1. A Vállalkozó szavatolja, hogy:",
        "     a) a Pályázat benyújtása, a Támogatás elnyerése, valamint "
        "a Támogatás eddigi felhasználása a hatályos jogszabályoknak, "
        "különösen a 272/2024. Korm. rendeletnek, a Szaa tv.-nek "
        "és a támogatói okirat rendelkezéseinek megfelelően történt;",
        "     b) az Átruházott Támogatási Keret valóban fel nem "
        "használt, szabadon átruházható támogatási összeg;",
        "     c) a Projekt eddigi megvalósítása nem tartalmaz "
        "szabálytalanságot, hamis adatszolgáltatást vagy "
        "visszaélést;",
        "     d) nem áll fenn olyan hatósági eljárás, ellenőrzés "
        "vagy visszafizetési kötelezettség, amely az Átruházott "
        "Támogatási Keret átruházását akadályozná;",
        "     e) a Támogatás vissza nem térítendő támogatás, "
        "és a támogatói okirat ezt a minősítést tartalmazza.",
        "7.2. A Vállalkozó köteles a 5. fejezetben meghatározott "
        "Átadási Dokumentációt határidőben és hiánytalanul "
        "átszolgáltatni.",
        "7.3. A Vállalkozó köteles a Megrendelővel együttműködni "
        "az Irányító Hatóságnál szükséges kedvezményezett-változási "
        "eljárás lefolytatásában, és a szükséges nyilatkozatokat "
        "megtenni.",
        "7.4. A Vállalkozó köteles a Projekt korábbi szakaszában "
        "keletkezett esetleges szabálytalanságokat, visszafizetési "
        "vagy szankciós kötelezettségeket önállóan viselni, "
        "és a Megrendelőt ezekkel kapcsolatban kártalanítani.",
        "7.5. A Vállalkozó köteles legkésőbb 2026. augusztus 10. "
        "napjáig kiállítani és megküldeni a jelen Szerződés "
        "8. fejezete szerinti számlát.",
        "7.6. A Vállalkozó a szavatossági nyilatkozatai valótlansága "
        "esetén a Megrendelő felé teljes kártérítési felelősséggel "
        "tartozik a Ptk. 6:527. § (szavatosság) alapján.",
    ]
    for c in contractor_clauses:
        add_clause(doc, c)
    doc.add_paragraph()

    # ── 8. DÍJAZÁS ÉS SZÁMLÁZÁS ──
    add_section(doc, "8", "DÍJAZÁS, SZÁMLÁZÁS ÉS FIZETÉSI FELTÉTELEK")

    payment_clauses = [
        "8.1. A Megrendelő a Projekt átruházásáért, valamint a "
        "Vállalkozó által nyújtott kapcsolódó szolgáltatásokért "
        "(projektátadás, dokumentáció-átadás, adminisztratív "
        "támogatás, együttműködés az Irányító Hatóságnál) "
        "díjat fizet a Vállalkozó részére.",
        "8.2. A szerződés szerinti díj nettó összege: 262 000 000 "
        "(kettőszázhatvankétmillió) forint, amely az alábbi "
        "tételekből áll:",
        "     a) 82 000 000 (nyolcvankétmillió) forint nettó – "
        "első támogatási keret átruházása;",
        "     b) 180 000 000 (száznyolcvanmillió) forint nettó – "
        "második támogatási keret átruházása.",
        "8.3. A Vállalkozó köteles a számlát legkésőbb 2026. "
        "augusztus 10. napjáig kiállítani és a Megrendelő "
        "részére megküldeni.",
        "8.4. A számla kötelező tartalmi elemei:",
        "     a) a Vállalkozó és a Megrendelő teljes adószáma "
        "és székhelye;",
        "     b) a számla sorszáma és kelte;",
        "     c) a teljesítés időpontja (a Projektátadás "
        "jegyzőkönyvének kelte);",
        "     d) a szolgáltatás megnevezése: „Projektátruházási "
        "és ingatlanfejlesztési vállalkozási szolgáltatás – "
        "GINOP Plusz-1.2.1-21 projekt átruházása”;",
        "     e) a nettó és bruttó összeg, az alkalmazandó "
        "ÁFA kulcs;",
        "     f) a fizetési határidő;",
        "     g) a Vállalkozó bankszámlaszáma.",
        "8.5. A számlázásra vonatkozó rendelkezéseket az alábbi "
        "jogszabályok szerint kell alkalmazni:",
        "     a) a számvitelről szóló 2000. évi C. törvény "
        "(a továbbiakban: „Számvitel tv.”) 169. § (bizonylatok "
        "tartalmi követelményei);",
        "     b) az adózás rendjéről szóló 2017. évi CL. törvény "
        "(a továbbiakban: „Art.”) 259. § (számla kötelező "
        "tartalmi elemei);",
        "     c) az általános forgalmi adóról szóló 2007. évi "
        "CXXVII. törvény (a továbbiakban: „Áfa tv.”) "
        "vonatkozó rendelkezései.",
        "8.6. A szolgáltatás ÁFA-kötelezettségét a Felek az "
        "Áfa tv. rendelkezései alapján, adótanácsadó "
        "bevonásával határozzák meg. Amennyiben a szolgáltatás "
        "ÁFA-köteles, a számla bruttó összege az alkalmazandó "
        "27%-os adómérték figyelembevételével kerül "
        "megállapításra, kivéve, ha a Felek ettől eltérő "
        "adómértékben állapodnak meg.",
        "8.7. A Megrendelő a számla kézhezvételétől számított "
        "8 (nyolc) naptári napon belül köteles a számla "
        "bruttó ellenértékét a Vállalkozó 8.4. g) pontban "
        "megadott bankszámlájára utalni.",
        "8.8. Késedelmes fizetés esetén a Megrendelő köteles "
        "a Ptk. 6:155. § (késedelmi kamat) alapján késedelmi "
        "kamattal tartozni. A késedelmi kamat mértéke a "
        "késedelem első napjától számított jegybanki alapkamat "
        "ketszerese.",
        "8.9. A Felek rögzítik, hogy a díj megfizetése "
        "független a kedvezményezett-változás Irányító "
        "Hatóságnál történő jóváhagyásától, amennyiben a "
        "Vállalkozó a Projektátadást a 5. fejezet szerint "
        "teljesítette.",
    ]
    for c in payment_clauses:
        add_clause(doc, c)
    doc.add_paragraph()

    # ── 9. INGATLANFEJLESZTÉS ──
    add_section(doc, "9", "INGATLANFEJLESZTÉSI VÁLLALKOZÁS")

    re_clauses = [
        "9.1. A Vállalkozó vállalja, hogy a Projekt keretében "
        "az ingatlanfejlesztési feladatokat – a támogatói "
        "okiratban és a pályázati anyagban foglaltak szerint – "
        "a Megrendelővel együttműködve teljesíti, illetve "
        "az átadás időpontjáig teljesítette.",
        "9.2. A Megrendelő mint Projektátvevő átveszi az "
        "ingatlanfejlesztési feladatok további ellátását, "
        "és köteles azokat a Projekt céljainak megfelelően, "
        "a támogatói okiratban meghatározott határidőre "
        "befejezni.",
        "9.3. Az ingatlanfejlesztési vállalkozásra a Ptk. "
        "6:242–6:246. §-ai (építési vállalkozási szerződés) "
        "rendelkezései irányadók, amennyiben azok alkalmazandók.",
        "9.4. Az ingatlanfejlesztési tevékenység során a "
        "Felek kötelesek betartani:",
        "     a) az építésügyi és építésügyi adminisztrációs "
        "szabályairól szóló 312/2012. (XI. 8.) Korm. rendelet "
        "előírásait;",
        "     b) a településrendezési, építési és építésügyi "
        "adminisztrációs eljárásokról szóló 253/1997. (XII. 20.) "
        "Korm. rendelet vonatkozó rendelkezéseit;",
        "     c) a környezetvédelmi és fenntartható fejlesztési "
        "követelményeket.",
        "9.5. A Megrendelő viseli az ingatlanfejlesztési "
        "beruházás további megvalósításával kapcsolatos "
        "valamennyi költséget, engedélyeztetési eljárást "
        "és hatósági kapcsolattartást.",
    ]
    for c in re_clauses:
        add_clause(doc, c)
    doc.add_paragraph()

    # ── 10. FELELŐSSÉG ──
    add_section(doc, "10", "FELELŐSSÉG, KÁRTÉRÍTÉS ÉS KÁRTALANÍTÁS")

    liability_clauses = [
        "10.1. Amennyiben a Megrendelő a Pályázat kedvezményezetti "
        "feltételeinek megfeleléséről tett nyilatkozata valótlan, "
        "a Megrendelő viseli az ebből eredő valamennyi "
        "jogkövetkezményt, különösen:",
        "     a) a Támogatás teljes vagy részleges visszafizetését;",
        "     b) a Szaa tv. 6. § (szabálytalan allokáció) szerinti "
        "szankciókat;",
        "     c) a 272/2024. Korm. rendelet 1. mellékletében "
        "foglalt Általános Útmutató 2.4. fejezetében (visszafizetés) "
        "meghatározott visszafizetési kötelezettséget;",
        "     d) az eljárási költségeket, bírságokat, kamatokat.",
        "10.2. Amennyiben a Projekt korábbi szakaszában, illetve "
        "a Támogatás eddigi felhasználása során szabálytalanság "
        "merült fel, a Vállalkozó viseli a teljes felelősséget, "
        "és köteles a Megrendelőt kártalanítani a Szaa tv. "
        "és a 272/2024. Korm. rendelet alapján keletkezett "
        "valamennyi kárért.",
        "10.3. A kártalanítás magában foglalja a Megrendelő "
        "által a Vállalkozó szabálytalansága miatt megfizetett "
        "visszafizetési összegeket, bírságokat, kamatokat, "
        "ügyvédi költségeket és egyéb járulékos kiadásokat.",
        "10.4. A Felek kötelesek egymást haladéktalanul "
        "értesíteni minden olyan körülményről, amely a "
        "Támogatás vagy a Projekt megvalósítását veszélyezteti, "
        "különösen hatósági ellenőrzésről, hiánypótlási "
        "felhívásról, visszafizetési felszólításról.",
        "10.5. A felek szerződésszegésére a Ptk. 6:142–6:146. §-ai "
        "(szerződésszegés) rendelkezései irányadók.",
        "10.6. A felek kártérítési felelősségére a Ptk. 6:518–6:523. §-ai "
        "(kártérítés) rendelkezései irányadók.",
    ]
    for c in liability_clauses:
        add_clause(doc, c)
    doc.add_paragraph()

    # ── 11. KÖTBÉR ──
    add_section(doc, "11", "KÖTBÉR ÉS SZANKCIÓK")

    penalty_clauses = [
        "11.1. Amennyiben a Vállalkozó a számlát a 8.3. pontban "
        "meghatározott 2026. augusztus 10. határidőig nem "
        "állítja ki, kötbér fizetésére kötelezett napi "
        "50 000 (ötvenezer) forint összegben, legfeljebb "
        "30 (harminc) napig.",
        "11.2. Amennyiben a Megrendelő a számla ellenértékét "
        "a 8.7. pontban meghatározott határidőn túl nem "
        "fizeti meg, kötbér fizetésére kötelezett napi "
        "50 000 (ötvenezer) forint összegben, legfeljebb "
        "30 (harminc) napig.",
        "11.3. Amennyiben a Vállalkozó az Átadási Dokumentációt "
        "a 5.1. pontban meghatározott határidőn túl nem "
        "adja át, kötbér fizetésére kötelezett napi "
        "100 000 (százezer) forint összegben, legfeljebb "
        "15 (tizenöt) napig.",
        "11.4. Amennyiben bármelyik Fél a kedvezményezett-változási "
        "eljárásban szükséges dokumentumokat a 4.2. pontban "
        "meghatározott határidőn túl nem nyújtja be, "
        "és ez a másik Fél kárát okozza, a késedelmes Fél "
        "köteles a okozott kárt megtéríteni.",
        "11.5. A kötbér önmagában nem mentesíti a szerződésszegő "
        "Felet a teljesítés és a kártérítés alól. A kötbér "
        "levonható a teljesítés ellenértékéből.",
    ]
    for c in penalty_clauses:
        add_clause(doc, c)
    doc.add_paragraph()

    # ── 12. TITOKTARTÁS ──
    add_section(doc, "12", "TITOKTARTÁS ÉS ADATVÉDELEM")

    confidentiality_clauses = [
        "12.1. A Felek kötelesek a jelen Szerződés tartalmát, "
        "valamint a Projekt és a Támogatás felhasználásával "
        "kapcsolatos üzleti, pénzügyi és szakmai információkat "
        "bizalmasan kezelni.",
        "12.2. A bizalmas információk harmadik személynek "
        "csak az alábbi esetekben adhatók át:",
        "     a) jogszabályi kötelezettség alapján;",
        "     b) az Irányító Hatóság, az Állami Számvevőszék "
        "vagy más ellenőrző hatóság előtti eljárás keretében;",
        "     c) a Felek írásbeli hozzájárulásával;",
        "     d) a Felek jogi képviselője, adótanácsadója "
        "vagy könyvelője részére, a titoktartási kötelezettség "
        "vállalása mellett.",
        "12.3. A titoktartási kötelezettség a Szerződés "
        "megszűnését követő 5 (öt) évig fennáll.",
        "12.4. A Felek a jelen Szerződés teljesítése során "
        "kezelt személyes adatokra vonatkozóan kötelesek "
        "betartani:",
        "     a) az Európai Parlament és a Tanács (EU) 2016/679 "
        "rendeletét (a továbbiakban: „GDPR”);",
        "     b) az információs önrendelkezési jogról és az "
        "információszabadságról szóló 2011. évi CXII. "
        "törvényt (a továbbiakban: „Infotv.”);",
        "     c) a GDPR 28. cikkében (adatfeldolgozó) foglalt "
        "adatfeldolgozási megállapodás követelményeit, "
        "amennyiben adatfeldolgozói kapcsolat áll fenn.",
    ]
    for c in confidentiality_clauses:
        add_clause(doc, c)
    doc.add_paragraph()

    # ── 13. VIS MAIOR ──
    add_section(doc, "13", "VIS MAIOR")

    add_clause(
        doc,
        "13.1. A Felek mentesülnek a szerződéses kötelezettségeik "
        "teljesítéséért való felelősség alól, ha teljesítésüket "
        "vis maior esemény akadályozza. Vis maior eseménynek "
        "minősül különösen: természeti katasztrófa, háború, "
        "járvány, hatósági intézkedés, amely a teljesítést "
        "lehetetlenné teszi.",
    )
    add_clause(
        doc,
        "13.2. A vis maior esemény bekövetkezését érintett Fél "
        "haladéktalanul, de legkésőbb 5 (öt) napon belül "
        "köteles írásban jelezni a másik Fél felé, megadva "
        "az esemény természetét, várható időtartamát és "
        "a teljesítés akadályozottságának mértékét.",
    )
    add_clause(
        doc,
        "13.3. Vis maior esemény esetén a teljesítési határidő "
        "a vis maior esemény időtartamával meghosszabbodik. "
        "Amennyiben a vis maior esemény 90 (kilencven) napnál "
        "hosszabb ideig tart, bármelyik Fél jogosult a "
        "Szerződést felmondani.",
    )
    doc.add_paragraph()

    # ── 14. FELMONDÁS ──
    add_section(doc, "14", "SZERZŐDÉSSZEGÉS ÉS FELMONDÁS")

    termination_clauses = [
        "14.1. Súlyos szerződésszegés esetén – különösen a "
        "szavatossági nyilatkozatok megszegése, a határidők "
        "ismételt elmulasztása, vagy az Irányító Hatóságnál "
        "szükséges eljárások szándékos akadályozása – "
        "a sérelmet szenvedő Fél azonnali hatályú felmondással "
        "szüntetheti meg a Szerződést a Ptk. 6:142. § "
        "(szerződésszegés) alapján.",
        "14.2. A jelen Szerződés rendes felmondással csak "
        "írásban, 30 (harminc) napos felmondási idővel "
        "mondható fel, kivéve, ha a Felek ettől eltérően "
        "állapodnak meg.",
        "14.3. Felmondás esetén a Felek kötelesek elszámolni "
        "egymással a felmondás időpontjáig teljesített "
        "szolgáltatások alapján.",
        "14.4. A felmondás nem mentesíti a Feleket a "
        "felmondás időpontjáig keletkezett kötelezettségeik "
        "teljesítése, kártérítési felelősség és titoktartási "
        "kötelezettség alól.",
        "14.5. A Szerződés megszűnése nem érinti a "
        "kedvezményezett-változási eljárásban már "
        "benyújtott kérelmeket, amelyek esetében a Felek "
        "továbbra is kötelesek együttműködni.",
    ]
    for c in termination_clauses:
        add_clause(doc, c)
    doc.add_paragraph()

    # ── 15. VITARENDEZÉS ──
    add_section(doc, "15", "VITARENDEZÉS")

    dispute_clauses = [
        "15.1. A Felek a jelen Szerződésből eredő vitáikat "
        "elsősorban békés úton, tárgyalás útján kísérlik "
        "megoldani.",
        "15.2. Amennyiben a vitás kérdés tárgyalás útján "
        "30 (harminc) napon belül nem rendezhető, a Felek "
        "alávetik magukat a Ptk. 6:346. § (bírósági "
        "jogviták) alapján a Vállalkozó székhelye szerint "
        "illetékes bíróság kizárólagos joghatóságának.",
        "15.3. A Felek megállapodnak, hogy vitás kérdés "
        "esetén alternatív vitarendezési módként mediációt "
        "is igénybe vehetnek a mediációról szóló 2002. "
        "évi LV. törvény alapján.",
    ]
    for c in dispute_clauses:
        add_clause(doc, c)
    doc.add_paragraph()

    # ── 16. ZÁRÓ RENDELKEZÉSEK ──
    add_section(doc, "16", "ZÁRÓ RENDELKEZÉSEK")

    final_clauses = [
        "16.1. Jelen Szerződés a Felek között az aláírás "
        "napján lép hatályba.",
        "16.2. A jelen Szerződésben nem szabályozott "
        "kérdésekben a Ptk., valamint a Támogatás "
        "felhasználására vonatkozó hatályos jogszabályok "
        "rendelkezései az irányadók.",
        "16.3. A Felek jelen Szerződés aláírásával kijelentik, "
        "hogy a Szerződés tartalmát megismerték, azt "
        "akaratukkal megegyezőnek fogadják el, és az "
        "aláírásra jogosultak.",
        "16.4. A Felek kijelentik, hogy jelen Szerződés "
        "megkötése előtt lehetőségük volt jogi tanácsadó "
        "bevonására.",
        "16.5. Jelen Szerződés módosítása, kiegészítése "
        "kizárólag írásban, a Felek által aláírt "
        "megállapodással lehetséges a Ptk. 6:225. § "
        "(írásbeliség) alapján.",
        "16.6. Jelen Szerződés 2 (két) eredeti példányban "
        "készült, amelyből mindkét Fél 1 (egy)-1 (egy) "
        "eredeti példányt kap.",
        "16.7. Jelen Szerződés mellékletei:",
        "     • 1. számú melléklet: Projektátadási jegyzőkönyv",
        "     • 2. számú melléklet: Átadási Dokumentáció "
        "jegyzéke",
        "     • 3. számú melléklet: Átruházott Támogatási "
        "Keret kimutatása",
        "     • 4. számú melléklet: Megrendelő "
        "kedvezményezetti megfelelőségi nyilatkozata",
        "     • 5. számú melléklet: Vállalkozó szavatossági "
        "nyilatkozata",
    ]
    for c in final_clauses:
        add_clause(doc, c)
    doc.add_paragraph()

    # ── JOGSZABÁLYI HIVATKOZÁSOK ÖSSZEFOGLALÓ ──
    add_section(doc, "17", "ALKALMAZANDÓ JOGSZABÁLYOK JEGYZÉKE")

    laws = [
        "Polgári Törvénykönyvről szóló 2013. évi V. törvény (Ptk.)",
        "Gazdasági társaságokról szóló 2006. évi IV. törvény (Gttv.)",
        "Számvitelről szóló 2000. évi C. törvény (Számvitel tv.)",
        "Adózás rendjéről szóló 2017. évi CL. törvény (Art.)",
        "Általános forgalmi adóról szóló 2007. évi CXXVII. törvény (Áfa tv.)",
        "Szabálytalan allokációról szóló 2016. évi LIII. törvény (Szaa tv.)",
        "Államháztartásról szóló 2011. évi CXCV. törvény (Áht.)",
        "Információs önrendelkezési jogról szóló 2011. évi CXII. törvény (Infotv.)",
        "Mediacióról szóló 2002. évi LV. törvény",
        "272/2024. (VII. 23.) Korm. rendelet (EU támogatások felhasználása)",
        "312/2012. (XI. 8.) Korm. rendelet (építésügy)",
        "253/1997. (XII. 20.) Korm. rendelet (építésügyi eljárások)",
        "Európai Parlament és Tanács (EU) 2021/1060 rendelete (CPR rendelet)",
        "Európai Parlament és Tanács (EU) 2016/679 rendelete (GDPR)",
        "Európai Bizottság 651/2014/EU rendelete (csoportmentesség)",
        "GINOP Plusz-1.2.1-21 pályázati felhívás és mellékletei",
    ]
    for law in laws:
        add_bullet(doc, law)
    doc.add_paragraph()

    # ── ALÁÍRÁS ──
    add_para(doc, "Kelt: ……………………, 2026. ………… napján", space_after=12)

    table = doc.add_table(rows=1, cols=2)
    table.autofit = False
    for col in table.columns:
        col.width = Cm(8.5)

    left = table.cell(0, 0)
    right = table.cell(0, 1)

    def cell_text(cell, lines):
        cell.paragraphs[0].clear()
        for i, (text, bold) in enumerate(lines):
            p = cell.paragraphs[0] if i == 0 else cell.add_paragraph()
            styled_run(p, text, bold=bold)

    cell_text(left, [
        ("Megrendelő / Projektátvevő:", True),
        ("First Beauty Korlátolt Felelősségű Társaság", False),
        ("Székhely: 1202 Budapest, Klapka utca 110.", False),
        ("Cégjegyzékszám: 01-09-321396", False),
        ("Adószám: 26273608-2-43", False),
        ("", False),
        ("Képviseli:", True),
        ("Név: ………………………………………", False),
        ("Beosztás: ………………………………………", False),
        ("", False),
        ("Aláírás: _________________________", False),
        ("", False),
        ("P.H.", False),
    ])

    cell_text(right, [
        ("Vállalkozó / Projektátadó:", True),
        ("Taking-System Ingatlanközvetítő, Szolgáltató és", False),
        ("Tanácsadó Korlátolt Felelősségű Társaság", False),
        ("Székhely: 2145 Kerepes, József Attila park 1.", False),
        ("2. em. 21. ajtó", False),
        ("Cégjegyzékszám: 13-09-172196", False),
        ("Adószám: 25043790-1-13", False),
        ("", False),
        ("Képviseli:", True),
        ("Név: ………………………………………", False),
        ("Beosztás: ………………………………………", False),
        ("", False),
        ("Aláírás: _________________________", False),
        ("", False),
        ("P.H.", False),
    ])

    output_path = (
        "/Users/skrillex/conspiracyhub/docs/"
        "Projektatruhazasi_es_ingatlanfejlesztesi_vallalkozasi_szerzodes.docx"
    )
    doc.save(output_path)
    print(f"Saved: {output_path}")


if __name__ == "__main__":
    main()
