"use client";

import { useState } from "react";
import Link from "next/link";

const FONT = "var(--font-share-tech-mono), monospace";
const RAJ = "var(--font-raj), sans-serif";

// ── Mini mockup helpers ──────────────────────────────────────────
function MockCard() {
  return (
    <div style={{ border: "1px solid #1a3320", borderRadius: 4, background: "#090f0b", overflow: "hidden", fontSize: 10, fontFamily: FONT, maxWidth: 340 }}>
      <div style={{ padding: "8px 12px", borderBottom: "1px solid #1a3320", display: "flex", gap: 8, alignItems: "center" }}>
        <span style={{ fontSize: 9, color: "#ff3333", border: "1px solid #ff3333", padding: "1px 6px", borderRadius: 2, fontFamily: RAJ, fontWeight: 700 }}>THREAT: 82</span>
        <span style={{ fontSize: 9, color: "#ffaa00", border: "1px solid #ffaa00", padding: "1px 6px", borderRadius: 2, fontFamily: RAJ, fontWeight: 700 }}>TIER A</span>
        <span style={{ fontSize: 9, color: "#5a8068", letterSpacing: 1, marginLeft: "auto" }}>guardian</span>
      </div>
      <div style={{ padding: "10px 12px" }}>
        <div style={{ fontFamily: RAJ, fontSize: 12, fontWeight: 700, color: "#e8ffe8", marginBottom: 4 }}>Pentagon Confirms New UAP Program</div>
        <div style={{ color: "#5a8068", fontSize: 10, lineHeight: 1.6, marginBottom: 8 }}>Classified documents reveal a previously unknown research initiative...</div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 8, color: "#3a5040", border: "1px solid #0d1a10", padding: "1px 5px", borderRadius: 2 }}>uap</span>
          <span style={{ fontSize: 8, color: "#3a5040", border: "1px solid #0d1a10", padding: "1px 5px", borderRadius: 2 }}>pentagon</span>
          <button style={{ marginLeft: "auto", background: "rgba(0,255,136,0.07)", border: "1px solid #00bb66", color: "#00ff88", fontFamily: RAJ, fontSize: 10, fontWeight: 700, padding: "4px 10px", borderRadius: 2, cursor: "default", letterSpacing: 1 }}>◈ ANALYZE</button>
        </div>
      </div>
    </div>
  );
}

function MockBoardMini() {
  const cx = 200, cy = 100;
  const nodes = [
    { id: "c", x: cx, y: cy, r: 22, color: "#00ff88", label: "CENTER", sub: "ARTICLE" },
    { id: "n1", x: cx - 120, y: cy - 50, r: 14, color: "#ff3333", label: "FOIA", sub: "DOC" },
    { id: "n2", x: cx + 120, y: cy - 50, r: 14, color: "#00bb66", label: "PERSON", sub: "WITNESS" },
    { id: "n3", x: cx, y: cy + 90, r: 14, color: "#ffaa00", label: "CORP", sub: "COMPANY" },
    { id: "n4", x: cx - 110, y: cy + 70, r: 14, color: "#c94dff", label: "PATENT", sub: "USPTO" },
  ];
  return (
    <div style={{ border: "1px solid #1a3320", borderRadius: 4, background: "#090f0b", overflow: "hidden", maxWidth: 420 }}>
      <div style={{ padding: "6px 12px", borderBottom: "1px solid #1a3320", fontSize: 9, color: "#5a8068", fontFamily: FONT, letterSpacing: 2 }}>◈ INVESTIGATION BOARD PREVIEW</div>
      <svg viewBox="0 0 400 230" style={{ width: "100%", height: 180 }}>
        <rect width="400" height="230" fill="#090f0b" />
        <defs>
          <radialGradient id="gGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#00ff88" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#00ff88" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx={cx} cy={cy} r={55} fill="url(#gGrad)" />
        {nodes.slice(1).map(n => (
          <line key={n.id} x1={cx} y1={cy} x2={n.x} y2={n.y} stroke={n.color} strokeWidth="1.2" strokeOpacity="0.35" strokeDasharray="4 5" />
        ))}
        {nodes.map((n, i) => (
          <g key={n.id}>
            <circle cx={n.x} cy={n.y} r={n.r + 5} fill={n.color} opacity="0.05" />
            <circle cx={n.x} cy={n.y} r={n.r} fill="#090f0b" stroke={n.color} strokeWidth={i === 0 ? 2 : 1.5} style={{ filter: `drop-shadow(0 0 ${i === 0 ? 6 : 3}px ${n.color})` }} />
            <text x={n.x} y={n.y + 3} textAnchor="middle" fill={n.color} style={{ fontFamily: FONT, fontSize: i === 0 ? 7 : 6, letterSpacing: 0.5 }}>{n.label}</text>
            <text x={n.x} y={n.y + n.r + 12} textAnchor="middle" fill={n.color} opacity="0.5" style={{ fontFamily: FONT, fontSize: 5.5, letterSpacing: 0.5 }}>{n.sub}</text>
          </g>
        ))}
        <text x={cx} y={cy - 28} textAnchor="middle" fill="#00ff88" opacity="0.4" style={{ fontFamily: FONT, fontSize: 5, letterSpacing: 2 }}>PAN · ZOOM · CLICK NODE</text>
      </svg>
    </div>
  );
}

function MockOracle() {
  return (
    <div style={{ border: "1px solid #1a3320", borderRadius: 4, background: "#090f0b", padding: "12px 14px", maxWidth: 380, fontFamily: FONT }}>
      <div style={{ fontSize: 9, color: "#00ff88", letterSpacing: 2, marginBottom: 10 }}>◈ ORACLE ANALYSIS</div>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 8, color: "#5a8068", letterSpacing: 2, marginBottom: 3 }}>THREAT SCORE</div>
          <div style={{ fontFamily: RAJ, fontSize: 38, fontWeight: 700, color: "#ff3333", lineHeight: 1 }}>82</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ height: 4, background: "#1a3320", borderRadius: 2, overflow: "hidden", marginBottom: 5 }}>
            <div style={{ height: "100%", width: "82%", background: "#ff3333", borderRadius: 2 }} />
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <span style={{ fontSize: 8, color: "#ff3333", border: "1px solid #ff3333", padding: "1px 6px", borderRadius: 2, fontFamily: RAJ }}>QUESTIONABLE</span>
          </div>
        </div>
      </div>
      <div style={{ fontSize: 10, color: "#7aaa8a", lineHeight: 1.7, marginBottom: 8 }}>Cross-referencing with CIA FOIA index suggests deliberate information suppression. Patent filings by contractors align with the timeline...</div>
      <div style={{ padding: "8px 10px", background: "rgba(201,77,255,0.06)", border: "1px solid rgba(201,77,255,0.2)", borderRadius: 3 }}>
        <div style={{ fontSize: 8, color: "#c94dff", letterSpacing: 2, marginBottom: 3 }}>CONSPIRACY ANGLE</div>
        <div style={{ fontSize: 10, color: "#e9b3ff", lineHeight: 1.5 }}>Classified reverse-engineering program concealed under contractor shell companies</div>
      </div>
    </div>
  );
}

function MockUAPMap() {
  const incidents = [
    { x: 90, y: 80, col: "#00ff88", sel: true, label: "ROSWELL" },
    { x: 60, y: 100, col: "#00bb66", sel: false, label: "NIMITZ" },
    { x: 240, y: 70, col: "#ffaa00", sel: false, label: "RENDLESHAM" },
    { x: 300, y: 95, col: "#5a8068", sel: false, label: "YAZD" },
    { x: 170, y: 90, col: "#ff3333", sel: false, label: "AVEBURY" },
  ];
  return (
    <div style={{ border: "1px solid #1a3320", borderRadius: 4, background: "#090f0b", overflow: "hidden", maxWidth: 380 }}>
      <div style={{ padding: "6px 12px", borderBottom: "1px solid #1a3320", fontSize: 9, color: "#5a8068", fontFamily: FONT, letterSpacing: 2 }}>◈ GLOBAL INCIDENT MAP</div>
      <svg viewBox="0 0 380 140" style={{ width: "100%", height: 120 }}>
        <rect width="380" height="140" fill="#030806" />
        {/* Simplified continent outlines */}
        <ellipse cx="90" cy="95" rx="55" ry="28" fill="#0a160c" stroke="#1a3320" strokeWidth="0.5" />
        <ellipse cx="200" cy="85" rx="70" ry="35" fill="#0a160c" stroke="#1a3320" strokeWidth="0.5" />
        <ellipse cx="310" cy="90" rx="45" ry="25" fill="#0a160c" stroke="#1a3320" strokeWidth="0.5" />
        <ellipse cx="95" cy="55" rx="30" ry="18" fill="#0a160c" stroke="#1a3320" strokeWidth="0.5" />
        {incidents.map((inc, i) => (
          <g key={i}>
            <circle cx={inc.x} cy={inc.y} r={inc.sel ? 10 : 6} fill={inc.col} fillOpacity={inc.sel ? 0.95 : 0.7} stroke={inc.col} strokeWidth={inc.sel ? 2 : 1} style={{ filter: `drop-shadow(0 0 ${inc.sel ? 7 : 3}px ${inc.col})` }} />
            <circle cx={inc.x} cy={inc.y} r={(inc.sel ? 10 : 6) + 6} fill="none" stroke={inc.col} strokeWidth="0.7" strokeOpacity="0.2" />
            {inc.sel && <text x={inc.x + 13} y={inc.y + 3} fill={inc.col} style={{ fontFamily: FONT, fontSize: 6, letterSpacing: 1 }}>{inc.label}</text>}
          </g>
        ))}
      </svg>
    </div>
  );
}

// ── Section component ────────────────────────────────────────────

interface Section {
  id: string;
  icon: string;
  title: string;
  color: string;
  content: React.ReactNode;
}

function GuideSection({ section, open, onToggle }: { section: Section; open: boolean; onToggle: () => void }) {
  return (
    <div style={{ border: `1px solid ${open ? section.color : "#1a3320"}`, borderRadius: 4, overflow: "hidden", transition: "border-color 0.2s" }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: "100%",
          padding: "14px 18px",
          background: open ? `${section.color}0a` : "#090f0b",
          border: "none",
          display: "flex",
          alignItems: "center",
          gap: 12,
          cursor: "pointer",
          transition: "background 0.2s",
        }}
      >
        <span style={{ fontSize: 16 }}>{section.icon}</span>
        <span style={{ fontFamily: RAJ, fontSize: 14, fontWeight: 700, color: open ? section.color : "#c8e8d0", letterSpacing: 2, textTransform: "uppercase", flex: 1, textAlign: "left" }}>
          {section.title}
        </span>
        <span style={{ fontFamily: FONT, fontSize: 10, color: open ? section.color : "#3a5040", letterSpacing: 1 }}>{open ? "[ − BEZÁR ]" : "[ + MEGNYIT ]"}</span>
      </button>

      {open && (
        <div style={{ padding: "18px 20px 24px", borderTop: `1px solid ${section.color}22`, background: "#080e0a" }}>
          {section.content}
        </div>
      )}
    </div>
  );
}

// ── Explanation row ──────────────────────────────────────────────

function Row({ label, color, children }: { label: string; color?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 12, marginBottom: 10, alignItems: "flex-start" }}>
      <span style={{ fontFamily: RAJ, fontSize: 10, fontWeight: 700, color: color ?? "#00ff88", border: `1px solid ${color ?? "#00ff88"}`, padding: "2px 8px", borderRadius: 2, letterSpacing: 1, flexShrink: 0, whiteSpace: "nowrap", alignSelf: "flex-start", marginTop: 1 }}>
        {label}
      </span>
      <span style={{ fontFamily: FONT, fontSize: 11, color: "#7aaa8a", lineHeight: 1.75 }}>{children}</span>
    </div>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p style={{ fontFamily: FONT, fontSize: 11, color: "#7aaa8a", lineHeight: 1.8, margin: "0 0 10px" }}>{children}</p>;
}

function H({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: RAJ, fontSize: 11, fontWeight: 700, color: "#c8e8d0", letterSpacing: 2, marginBottom: 8, marginTop: 16, textTransform: "uppercase" }}>{children}</div>;
}

function InlineCode({ children }: { children: React.ReactNode }) {
  return <span style={{ fontFamily: FONT, fontSize: 10, color: "#00ff88", background: "rgba(0,255,136,0.07)", padding: "1px 5px", borderRadius: 2 }}>{children}</span>;
}

// ── Sections content ─────────────────────────────────────────────

const SECTIONS: Section[] = [
  {
    id: "feed",
    icon: "◈",
    title: "Fő feed — Hírek & threat score",
    color: "#00ff88",
    content: (
      <div>
        <P>A főoldal automatikusan gyűjtött híreket jelenít meg a Guardian API, Google News, Reddit és FOIA-adatbázisokból. Minden cikk átmegy egy AI-szűrőn (GPT-4o), ami 0–100 közötti <InlineCode>threat score</InlineCode>-t számol. Csak a <b style={{color:"#e8ffe8"}}>55+</b> pontot kapott cikkek jelennek meg.</P>
        <H>Hírkártya anatómiája</H>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start", marginBottom: 16 }}>
          <MockCard />
          <div style={{ flex: 1, minWidth: 200 }}>
            <Row label="THREAT: 82" color="#ff3333">Az AI által adott kockázati pontszám. 80+ = vörös (magas), 60–79 = sárga (közepes), 55–59 = zöld (alacsony). A szám azt jelzi, milyen valószínű, hogy a cikk rejtett összefüggéseket takar.</Row>
            <Row label="TIER A" color="#ffaa00">Forrástier: A = elsődleges hivatalos forrás (Guardian, Pentagon, FOIA), B = megalapozott média, C = közösségi / nem ellenőrzött.</Row>
            <Row label="SZEKCIÓ" color="#5a8068">A Guardian-szekció (pl. world, us-news, science). A szűrő gombokkal szekció szerint szűrhetsz a feed tetején.</Row>
            <Row label="◈ ANALYZE" color="#00ff88">Megnyitja a cikkhez tartozó Investigation Board-ot és Oracle-elemzést. GPT-4o feltérképezi az összefüggéseket, szereplőket, dokumentumokat.</Row>
          </div>
        </div>
        <H>Fejléc státuszsáv</H>
        <P>A zöld körök jelzik, hogy az adott adatforrás él. A <InlineCode>DARPA: ████</InlineCode> szándékosan takart — jelképezi a részlegesen titkosított forrásokat.</P>
        <H>LIVE ticker</H>
        <P>A fejléc alatt futó szövegcsík az aktív adatforrásokat és AI-rendszereket sorolja fel valós időben.</P>
      </div>
    ),
  },
  {
    id: "board",
    icon: "⬡",
    title: "Investigation Board — Összefüggéstérkép",
    color: "#00bb66",
    content: (
      <div>
        <P>Minden elemzett cikkhez létrejön egy interaktív gráf. A <b style={{color:"#e8ffe8"}}>középső csomópont</b> maga a cikk; a körülötte lévők a kapcsolódó szereplők, dokumentumok, vállalatok és szabadalmak.</P>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start", marginBottom: 16 }}>
          <MockBoardMini />
          <div style={{ flex: 1, minWidth: 200 }}>
            <H>Csomópontok (node-ok)</H>
            <Row label="ARTICLE" color="#00ff88">A kiindulópontot, az elemzett cikket jelöli. Zöld.</Row>
            <Row label="FOIA / CIA" color="#ff3333">FOIA-lekéréssel szerzett dokumentum, titkosított irat. Piros.</Row>
            <Row label="PERSON" color="#00bb66">Kulcsfigura, szemtanú, tisztviselő. Sötétzöld.</Row>
            <Row label="COMPANY" color="#ffaa00">Érintett vállalat vagy kormányzati ügynökség. Sárga.</Row>
            <Row label="PATENT" color="#ff3333">USPTO-ból hozzárendelt releváns szabadalom. Piros.</Row>
            <Row label="THEORY" color="#c94dff">GPT-4o által azonosított összeesküvés-hipotézis. Lila.</Row>
            <H>Navigáció</H>
            <Row label="PAN" color="#5a8068">A háttérre kattintva húzhatod a gráfot.</Row>
            <Row label="ZOOM" color="#5a8068">Egér-görgő / touchpad pinch zoom.</Row>
            <Row label="CLICK NODE" color="#5a8068">Csomópontra kattintva a jobb oldali panelben megjelenik a részletes leírás, forrás URL és a kapcsolódó bizonyítékok.</Row>
          </div>
        </div>
        <H>Jobb oldali panel</H>
        <P>A kiválasztott csomópont részleteit tartalmazza: leírás, forrástier (A/B/C), forráslink, threat score, kulcsállítások, bizonytalanságok, ellenérvek, timeline és szereplők.</P>
      </div>
    ),
  },
  {
    id: "oracle",
    icon: "◎",
    title: "Oracle Analysis — AI-nyomozó",
    color: "#00ff88",
    content: (
      <div>
        <P>Az Oracle a <b style={{color:"#e8ffe8"}}>GPT-4o</b>-ra épülő elemzőmodul. Ha rákattintasz a <InlineCode>◈ ORACLE ANALYSIS ▶</InlineCode> gombra, az AI valós időben elemzi a cikket, keresztreferenciázza a FOIA-indexszel és USPTO-adatbázissal, majd visszaad egy strukturált vizsgálatot.</P>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start", marginBottom: 16 }}>
          <MockOracle />
          <div style={{ flex: 1, minWidth: 200 }}>
            <H>Verdict (ítélet)</H>
            <Row label="TRUE" color="#00ff88">Az állítás bizonyítottan megalapozott, elsődleges forrásokkal alátámasztva.</Row>
            <Row label="PARTIALLY TRUE" color="#00bb66">Részben igaz, de egyes részletei vitatottak vagy hiányosak.</Row>
            <Row label="QUESTIONABLE" color="#ffaa00">Az állítás kétséges, közvetett bizonyítékok léteznek, de nincs döntő bizonyíték.</Row>
            <Row label="DISINFORMATION" color="#ff3333">Az Oracle szerint az információ szándékosan megtévesztő vagy manipulált.</Row>
            <H>Egyéb mezők</H>
            <Row label="CONSPIRACY ANGLE" color="#c94dff">Az AI által azonosított lehetséges összeesküvési szál vagy titkolt program, amire az adatok mutatnak.</Row>
            <Row label="KEY CONNECTIONS" color="#5a8068">A legfontosabb összefüggések rövid listája (személy ↔ szervezet ↔ esemény).</Row>
            <Row label="THEORIES" color="#c94dff">Külön, valószínűséggel súlyozott hipotézisek. Minden elméletnek van forráslistája és idővonala.</Row>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "sources",
    icon: "▸",
    title: "Forrástierek & adatbázisok",
    color: "#ffaa00",
    content: (
      <div>
        <H>Forrástierek</H>
        <Row label="TIER A" color="#ffaa00">Elsődleges forrás: Government.gov, Pentagon, CIA FOIA, Guardian, Reuters. Legmegbízhatóbb.</Row>
        <Row label="TIER B" color="#5a8068">Másodlagos forrás: ismert média, kutatóintézetek, ellenőrzött NGO-k.</Row>
        <Row label="TIER C" color="#3a5040">Harmadlagos forrás: közösségi média, blogok, ellenőrizetlen bejelentők. Fenntartással kezelendő.</Row>
        <H>Aktív adatbázisok</H>
        <Row label="GUARDIAN API" color="#00ff88">A The Guardian élő hírfolyama — 6 szekció folyamatos monitorozása (world, us-news, science, politics, technology, environment).</Row>
        <Row label="GPT-4o" color="#00ff88">Az OpenAI legújabb modellje végzi az összes AI-elemzést, threat scoring-ot és verdict-generálást.</Row>
        <Row label="CIA FOIA INDEX" color="#00ff88">A FOIA-val declassifikált dokumentumok indexe — az Oracle keresztreferenciázza az aktuális hírekhez.</Row>
        <Row label="USPTO LIVE" color="#00ff88">Az Egyesült Államok szabadalmi hivatalának live adatbázisa. Releváns szabadalmakat rendel az elemzett témákhoz.</Row>
        <Row label="DARPA ████" color="#5a8068">Részlegesen titkosított forrás — szimbolikus jelzés, hogy egyes védelmi programok adatai nem publikusak.</Row>
      </div>
    ),
  },
  {
    id: "uap",
    icon: "◉",
    title: "UAP Intelligence — Titkosított incidens-adatbázis",
    color: "#00bb66",
    content: (
      <div>
        <P>A <InlineCode>/uap</InlineCode> oldal egy dedikált UAP (Unidentified Aerial Phenomena) adatbázis, ami FOIA-dokumentumok, Pentagon-közlemények, kongresszusi meghallgatások és szemtanú-vallomások alapján épül fel.</P>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start", marginBottom: 16 }}>
          <MockUAPMap />
          <div style={{ flex: 1, minWidth: 200 }}>
            <H>Klasszifikáció</H>
            <Row label="DECLASSIFIED" color="#00ff88">Hivatalosan titkosítás alól feloldott eset, nyilvánosan elérhető dokumentumokkal.</Row>
            <Row label="CONFIRMED" color="#00bb66">Megerősített eset (Pentagon / AARO-nyilatkozat vagy kongresszusi tanúvallomás alapján).</Row>
            <Row label="REPORTED" color="#ffaa00">Bejelentett eset, de még nem teljesen megerősített. Korlátozott dokumentáció.</Row>
            <Row label="ALLEGED" color="#5a8068">Állítólagos eset, elsősorban nem ellenőrzött forrásból.</Row>
            <H>Evidence Level (bizonyítéki szint)</H>
            <Row label="HIGH" color="#ff3333">Radar-adatok, több független tanú, kormányzati visszaigazolás.</Row>
            <Row label="MEDIUM" color="#ffaa00">Részleges dokumentáció, néhány ellenőrzött tanú.</Row>
            <Row label="LOW" color="#00bb66">Elsősorban szemtanú-vallomások, korlátozott fizikai bizonyíték.</Row>
          </div>
        </div>
        <H>Incidens Investigation Board</H>
        <P>Minden incidenshez megnyitható egy teljes <InlineCode>◈ OPEN INVESTIGATION BOARD ▶</InlineCode> — ez az ismertetett Investigation Board UAP-specifikus változata. A hálón a szemtanúk, érintett szervezetek (AARO, CIA, DoD stb.) és a kapcsolódó dokumentumok jelennek meg.</P>
        <H>Polymarket widget</H>
        <P>Az egyes incidensoknál megjelenik a kapcsolódó Polymarket-piac, ahol valódi fogadásokkal megjósolják az esemény hivatalos elismerésének valószínűségét. Ez külső piaci konszenzust mutat, nem az app saját véleménye.</P>
      </div>
    ),
  },
  {
    id: "outbreaks",
    icon: "⬤",
    title: "Outbreaks — Járványkövető",
    color: "#ff3333",
    content: (
      <div>
        <P>Az <InlineCode>/outbreaks</InlineCode> oldal valós idejű járvány- és kitörésriasztókat jelenít meg WHO, CDC és ProMED forrásokból. Az oldal a fő navban pirosan villog — figyelemfelhívó design.</P>
        <H>Riasztásszintek</H>
        <Row label="CRITICAL" color="#ff3333">Aktív, gyorsan terjedő kitörés, WHO-figyelmeztetéssel vagy halálesetek megerősítve.</Row>
        <Row label="HIGH" color="#ff6600">Magas kockázatú eset, több ország érintett vagy szokatlan ágens.</Row>
        <Row label="MODERATE" color="#ffaa00">Megfigyelés alatt álló, kontroll alatt tartott eset.</Row>
        <Row label="LOW" color="#00bb66">Alacsony kockázatú, lokalizált eset, nem terjed.</Row>
        <H>Adatforrások</H>
        <P>WHO Disease Outbreak News, CDC Alerts, ProMED mailings, ECDC Rapid Risk Assessments — mindezeket automatikusan scraper gyűjti és kategorálja az AI.</P>
      </div>
    ),
  },
  {
    id: "search",
    icon: "⌕",
    title: "Keresés",
    color: "#5a8068",
    content: (
      <div>
        <P>A <InlineCode>/search</InlineCode> oldal Supabase full-text kereséssel keres az összes eltárolt hírben, Oracle-elemzésben és FOIA-dokumentumban. Kereshetsz névre, kulcsszóra, szervezetre, személyre.</P>
        <H>Tippek</H>
        <Row label="KULCSSZÓ" color="#5a8068">Bármilyen szó beírható — az AI-elemzett cikkek leírásaiban és az Oracle-összefoglalókban is keres.</Row>
        <Row label="SZERVEZET" color="#5a8068">Pl. CIA, DARPA, Lockheed — a kapcsolódó cikkeket és investigation board-okat hozza fel.</Row>
        <Row label="ESEMÉNY" color="#5a8068">Pl. Roswell, Nimitz — az UAP-incidenseket és a rájuk hivatkozó cikkeket egyaránt visszaadja.</Row>
      </div>
    ),
  },
  {
    id: "pro",
    icon: "◐",
    title: "PRO fiók",
    color: "#c94dff",
    content: (
      <div>
        <H>Ingyenes vs. PRO</H>
        <Row label="INGYENES" color="#5a8068">A feed megtekinthető, a hírkártyák láthatók. Oracle-elemzés és Investigation Board korlátozott.</Row>
        <Row label="PRO ▶" color="#c94dff">Korlátlan Oracle-elemzés, teljes Investigation Board hozzáférés, Polymarket-integráció, archiválás és exportálás. Stripe-on keresztüli fizetés.</Row>
        <P>A <InlineCode>SIGN IN</InlineCode> gombbal Supabase Auth-on keresztül lehet belépni (email/jelszó vagy OAuth). A <InlineCode>PRO ▶</InlineCode> gomb megnyitja a Stripe Checkout-ot.</P>
      </div>
    ),
  },
];

// ── Main page ────────────────────────────────────────────────────

export default function GuidePage() {
  const [openSection, setOpenSection] = useState<string>("feed");

  function toggle(id: string) {
    setOpenSection(prev => (prev === id ? "" : id));
  }

  return (
    <div style={{ minHeight: "100vh", background: "#050c07", color: "#c8e8d0", fontFamily: FONT }}>
      <div className="scanline" />
      <style>{`
        @keyframes guide-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>

      <div style={{ position: "relative", zIndex: 1 }}>
        {/* NAV */}
        <div style={{ height: 44, background: "#050c07", borderBottom: "1px solid #1a3320", display: "flex", alignItems: "center", padding: "0 16px", gap: 12 }}>
          <Link href="/" style={{ fontSize: 10, color: "#5a8068", textDecoration: "none", letterSpacing: 2, border: "1px solid #1a3320", padding: "4px 10px", borderRadius: 3 }}>← FEED</Link>
          <div style={{ width: 1, height: 20, background: "#1a3320" }} />
          <div style={{ fontFamily: RAJ, fontSize: 14, fontWeight: 700, color: "#00ff88", letterSpacing: 2 }}>THE THEORIST</div>
          <div style={{ width: 1, height: 20, background: "#1a3320" }} />
          <div style={{ fontFamily: RAJ, fontSize: 11, color: "#5a8068", letterSpacing: 2 }}>ÚTMUTATÓ</div>
        </div>

        <div style={{ maxWidth: 900, margin: "0 auto", padding: "2rem 1.25rem 5rem" }}>

          {/* HEADER */}
          <div style={{ marginBottom: "2rem", paddingBottom: "1.25rem", borderBottom: "1px solid #1a3320" }}>
            <div style={{ fontFamily: RAJ, fontSize: 9, letterSpacing: 5, color: "#3a5040", marginBottom: 6, textTransform: "uppercase" }}>■ INTELLIGENCE PLATFORM DOCUMENTATION ■</div>
            <h1 style={{ fontFamily: RAJ, fontSize: 28, fontWeight: 700, color: "#00ff88", letterSpacing: 2, margin: "0 0 8px", textShadow: "0 0 20px rgba(0,255,136,0.2)" }}>
              Útmutató
            </h1>
            <div style={{ fontSize: 11, color: "#5a8068", lineHeight: 1.8, maxWidth: 620 }}>
              Ez az oldal elmagyarázza a platform minden funkcióját. Kattints egy szekció fejlécére a részletes leírásért és vizuális illusztrációért.
            </div>

            {/* Quick links */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
              {SECTIONS.map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggle(s.id)}
                  style={{
                    background: openSection === s.id ? `${s.color}10` : "transparent",
                    border: `1px solid ${openSection === s.id ? s.color : "#1a3320"}`,
                    color: openSection === s.id ? s.color : "#5a8068",
                    fontFamily: RAJ,
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: 1,
                    padding: "5px 12px",
                    borderRadius: 2,
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  {s.icon} {s.title.split("—")[0].trim()}
                </button>
              ))}
            </div>
          </div>

          {/* SECTIONS */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {SECTIONS.map(s => (
              <GuideSection
                key={s.id}
                section={s}
                open={openSection === s.id}
                onToggle={() => toggle(s.id)}
              />
            ))}
          </div>

          {/* FOOTER NOTE */}
          <div style={{ marginTop: 32, padding: "14px 18px", border: "1px solid #1a3320", borderRadius: 4, background: "#090f0b", fontSize: 10, color: "#3a5040", lineHeight: 1.8 }}>
            <span style={{ color: "#5a8068" }}>◈ PLATFORM VERSION</span>{" "}
            <span style={{ color: "#00ff88" }}>1.0</span>
            {"  ·  "}
            <span style={{ color: "#5a8068" }}>ADATFORRÁSOK</span>{" "}
            <span style={{ color: "#c8e8d0" }}>Guardian · CIA FOIA · USPTO · AARO · WHO</span>
            {"  ·  "}
            <span style={{ color: "#5a8068" }}>AI</span>{" "}
            <span style={{ color: "#c8e8d0" }}>GPT-4o</span>
            {"  ·  "}
            Az adatok tájékoztatás céljából szolgálnak, nem minősülnek szakmai tanácsnak.
          </div>
        </div>
      </div>
    </div>
  );
}
