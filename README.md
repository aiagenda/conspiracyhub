# 🕵️ Conspiracy Oracle

AI-kurált összeesküvés hírportál — csak azok a hírek jelennek meg, amelyekhez valós összeesküvés-dokumentáció is létezik.

## Mit csinál?

1. **Valós híreket tölt le** a Guardian API-n keresztül (tech, tudomány, politika, környezet, társadalom)
2. **GPT-4o batch-szűrő** pontozza az összes headlinet "összeesküvés potenciál" alapján (0-100%)
3. **Csak a 55% feletti hírek** kerülnek a feedbe — automatikusan előnézeti conspiracy angle-lel
4. **Kattintásra teljes Oracle elemzés**: 3 összeesküvés-elmélet valós bizonyítékokkal, CIA FOIA/USPTO hivatkozásokkal, Bayes-alapú valószínűséggel
5. **Polymarket-stílusú fogadás** minden elméletre

## Gyors indítás

### GitHub Pages (ajánlott)

1. Fork-old ezt a repót
2. Menj: **Settings → Pages → Source: main branch / root**
3. Az oldal elérhető lesz: `https://[felhasználóneved].github.io/conspiracy-oracle`

### Lokális futtatás

Egyszerűen nyisd meg a böngészőben:
```bash
# Python 3
python -m http.server 8080

# Node.js
npx serve .
```

Majd navigálj: `http://localhost:8080`

## API kulcsok

Az app beállítóképernyőn kér két API kulcsot:

### 1. Guardian API (ingyenes)
- Regisztrálj: https://open-platform.theguardian.com/access/
- "Register for Developer Access" — azonnal kapsz kulcsot
- **Teljesen ingyenes**, nincs limit az alaphasználathoz

### 2. OpenAI API (GPT-4o)
- Platform: https://platform.openai.com/api-keys
- Körülbelül **$0.01-0.05 per elemzés** (feed betöltés ~$0.02, teljes Oracle ~$0.03)

> ⚠️ **Biztonság**: A kulcsok kizárólag a böngésző `localStorage`-ában tárolódnak. Soha nem kerülnek szerverre. Az app teljesen kliens-oldali, nincs backend.

## Cache

A feed eredmények **30 percig cache-elődnek** a localStorage-ban, így nem terheli feleslegesen az API-t újratöltésnél.

## Tech stack

- **React 18** (CDN, build step nélkül)
- **Guardian Open Platform API** — hírek
- **OpenAI GPT-4o** — szűrés + elemzés
- **Vanilla CSS** — nulla dependency
- **GitHub Pages** — hosting

## Fejlesztési ötletek

- [ ] Polymarket valódi API integráció
- [ ] CIA FOIA közvetlen keresés (foia.cia.gov)
- [ ] USPTO szabadalom közvetlen lekérés
- [ ] Push értesítések magas-threat híreken
- [ ] Felhasználói fogadások mentése
- [ ] Több hírágazat (Reuters, AP, Politico)

## Licenc

MIT
