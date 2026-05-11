-- Curated declassified / official primary-source links for the Search page index.
-- Rows are external canonical URLs (no file mirroring in-app).

create table if not exists public.reference_documents (
  id uuid primary key default gen_random_uuid(),
  agency text not null,
  title text not null,
  canonical_url text not null,
  excerpt text,
  year smallint,
  created_at timestamptz not null default now(),
  constraint reference_documents_url_unique unique (canonical_url)
);

create index if not exists reference_documents_title_idx on public.reference_documents (lower(title));
create index if not exists reference_documents_agency_idx on public.reference_documents (agency);

alter table public.reference_documents enable row level security;

create policy "reference_documents_select_public"
  on public.reference_documents for select
  using (true);

-- Seed: stable .gov / official portals and well-known vault collections (alphabetical by title in UI via ORDER BY).
insert into public.reference_documents (agency, title, canonical_url, excerpt, year) values
('DOD', 'All-domain Anomaly Resolution Office (AARO)', 'https://www.aaro.mil/', 'Official DoD office for unidentified anomalous phenomena — reports and FAQs.', null),
('NASA', 'Apollo Program historical reference', 'https://www.nasa.gov/history/', 'NASA History Office — mission documentation and archives.', null),
('ARCHIVES', 'Archives.gov FOIA overview', 'https://www.archives.gov/foia', 'National Archives — how to request records and reading rooms.', null),
('ARCHIVES', 'National Archives online catalog', 'https://www.archives.gov/research/catalog', 'Search the National Archives catalog for federal records including declassified releases.', null),
('SENATE', 'Church Committee publications (Intelligence oversight)', 'https://www.intelligence.senate.gov/publications', 'U.S. Senate Select Committee on Intelligence — historical reports and publications.', 1975),
('CIA', 'CIA Electronic Reading Room (FOIA)', 'https://www.cia.gov/readingroom/', 'Declassified electronic documents released under FOIA and mandatory declassification review.', null),
('CIA', 'CIA Reading Room — CREST archive collection', 'https://www.cia.gov/readingroom/collection/crest-25-year-program-archive', 'CREST 25-year program archive — bulk declassified CIA records.', null),
('DARPA', 'DARPA — Research and programs', 'https://www.darpa.mil/research', 'Defense Advanced Research Projects Agency — public program pages and announcements.', null),
('DOD', 'Defense.gov FOIA', 'https://www.defense.gov/Resources/FOIA/', 'Office of the Secretary of Defense — FOIA resources.', null),
('DTIC', 'DTIC STI (public technical reports)', 'https://apps.dtic.mil/sti/', 'Defense Technical Information Center — public scientific and technical information.', null),
('DOE', 'DOE Openness (Human Radiation Experiments)', 'https://www.energy.gov/ehss/human-radiation-experiments', 'U.S. Department of Energy — openness initiative on human radiation experiments.', 1995),
('FBI', 'FBI FOIA Library', 'https://www.fbi.gov/services/information-management/foipa', 'Federal Bureau of Investigation — FOIA reading room and guidance.', null),
('FBI', 'FBI Vault — COINTELPRO', 'https://vault.fbi.gov/cointelpro', 'Declassified FBI field office files on COINTELPRO.', null),
('FBI', 'FBI Vault — MKULTRA', 'https://vault.fbi.gov/mkultra', 'Declassified materials related to MKULTRA.', null),
('FBI', 'FBI Vault — UFO / Unexplained Phenomena', 'https://vault.fbi.gov/UFO', 'FBI Vault section on unidentified flying objects (historical files).', null),
('GAO', 'Government Accountability Office — Reports', 'https://www.gao.gov/', 'GAO public reports and testimonies on programs and spending.', null),
('GPO', 'GovInfo (U.S. Government Publishing Office)', 'https://www.govinfo.gov/', 'Official publications — statutes, hearings, and federal reports.', null),
('DNI', 'ODNI — Declassification and FOIA', 'https://www.dni.gov/index.php/what-we-do/declassification', 'Office of the Director of National Intelligence — declassification policy and FOIA.', null),
('NSA', 'NSA/CSS FOIA and declassification', 'https://www.nsa.gov/Helpful-Links/NSA-Freedom-of-Information-Act/', 'National Security Agency — FOIA reading room and declassified releases.', null),
('NARA', 'National Declassification Center', 'https://www.archives.gov/declassification', 'National Archives — bulk declassification and prioritized review.', null),
('NARA', 'NARA JFK Assassination Records Collection', 'https://www.archives.gov/research/jfk', 'President John F. Kennedy Assassination Records Collection.', null),
('NARA', 'Project BLUE BOOK (U.S. Air Force UFO investigation)', 'https://www.archives.gov/research/military/air-force/ufos', 'National Archives guide to Project BLUE BOOK records.', null),
('DOD', 'DoD Office of Inspector General — Public reports', 'https://www.dodig.mil/reports.html', 'Independent oversight reports on DoD programs and operations.', null),
('DOD', 'Washington Headquarters Services — FOIA', 'https://www.esd.whs.mil/FOID/', 'DoD FOIA requests for OSD/JS records (WHS FOIA division).', null),
('EPA', 'EPA reading room (environmental records)', 'https://www.epa.gov/foia', 'U.S. Environmental Protection Agency — FOIA and reading room.', null),
('STATE', 'State Department FOIA', 'https://www.state.gov/foia/', 'U.S. Department of State — Freedom of Information Act.', null),
('USSS', 'U.S. Secret Service FOIA', 'https://www.secretservice.gov/foia', 'United States Secret Service — FOIA program.', null),
('USPTO', 'USPTO Patent Public Search', 'https://ppubs.uspto.gov/pubwebapp/static/pages/landing.html', 'U.S. Patent and Trademark Office — public patent full-text search.', null),
('VA', 'Veterans Affairs FOIA', 'https://www.va.gov/foia/', 'U.S. Department of Veterans Affairs — FOIA requests.', null),
('HOUSE', 'House Intelligence Committee — Public site', 'https://intelligence.house.gov/', 'U.S. House Permanent Select Committee on Intelligence — hearings and public materials.', null),
('LOC', 'Library of Congress — CRS reports (Congress.gov)', 'https://www.congress.gov/crs-product/browse', 'Congressional Research Service reports via Congress.gov.', null),
('NARA', 'Federal Register — Executive orders & presidential documents', 'https://www.federalregister.gov/presidential-documents/executive-orders', 'Official daily journal of U.S. government rules, proposed rules, and presidential documents.', null)
on conflict (canonical_url) do nothing;
