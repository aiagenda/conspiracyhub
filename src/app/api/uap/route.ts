import { NextRequest, NextResponse } from "next/server";
import { callOpenAIJSON } from "@/lib/openai";

// ── SEED DATA ────────────────────────────────────────────────────
const INCIDENTS = [
  { id:"nimitz", name:"USS Nimitz / Tic-Tac", date:"2004-11-14", location:"San Diego, Pacific Ocean", lat:32.5, lng:-117.5, classification:"DECLASSIFIED", evidenceLevel:"HIGH", description:"F/A-18 pilots from USS Nimitz encountered a 40-foot white object with no wings, rotors, or exhaust. It moved at hypersonic speeds and outmaneuvered advanced fighter jets. The FLIR1 video was declassified by the Pentagon in 2020.", witnesses:["David Fravor","Jim Slaight","Alex Dietrich","Chad Underwood"], documents:["FLIR1 Video (Pentagon 2020)","TTSA Release 2017","UAP Task Force Report 2021"], relatedOrgs:["USS Nimitz Strike Group","AATIP","To The Stars Academy"], tags:["military","verified","video","pentagon"] },
  { id:"roosevelt", name:"USS Roosevelt / Gimbal & GoFast", date:"2015-01-01", location:"US East Coast, Atlantic Ocean", lat:34.0, lng:-74.0, classification:"DECLASSIFIED", evidenceLevel:"HIGH", description:"Multiple encounters by F/A-18 pilots over months. The Gimbal video shows a rotating object with no visible propulsion. Ryan Graves reported near-daily encounters. Two videos declassified by Pentagon in 2020.", witnesses:["Ryan Graves","Danny Accoin"], documents:["Gimbal Video (Pentagon 2020)","GoFast Video (Pentagon 2020)","Ryan Graves Congressional Testimony 2023"], relatedOrgs:["USS Theodore Roosevelt CVN-71","AARO","US Navy"], tags:["military","verified","video","pentagon","congress"] },
  { id:"rendlesham", name:"Rendlesham Forest Incident", date:"1980-12-26", location:"Suffolk, United Kingdom", lat:52.09, lng:1.45, classification:"REPORTED", evidenceLevel:"MEDIUM", description:"US Air Force personnel stationed at RAF Bentwaters/Woodbridge witnessed a triangular craft in Rendlesham Forest. Lt. Col. Charles Halt made an audio recording and filed an official memo. Radiation levels above normal were measured at the landing site.", witnesses:["Charles Halt","Jim Penniston","John Burroughs"], documents:["Halt Memorandum (1981)","UK MoD Release 2001","Halt Audio Recording"], relatedOrgs:["RAF Bentwaters","USAF 81st Tactical Fighter Wing","UK Ministry of Defence"], tags:["military","radio","radiation","uk"] },
  { id:"phoenix", name:"Phoenix Lights", date:"1997-03-13", location:"Phoenix, Arizona, USA", lat:33.44, lng:-112.07, classification:"REPORTED", evidenceLevel:"MEDIUM", description:"Thousands of witnesses across Arizona and Nevada reported a massive V-shaped formation of lights. Arizona Governor Fife Symington initially mocked the incident but later admitted he saw something inexplicable. Two separate events occurred that night.", witnesses:["Fife Symington (Governor)","Frances Barwood (City Councilwoman)","Thousands of civilians"], documents:["NUFORC Reports","Phoenix City Council Records","Discovery Channel Documentary 2007"], relatedOrgs:["Luke Air Force Base","Phoenix Police Department","Arizona State Government"], tags:["mass-sighting","civilian","government"] },
  { id:"grusch", name:"David Grusch Whistleblower Testimony", date:"2023-07-26", location:"Washington DC, USA", lat:38.89, lng:-77.03, classification:"CONFIRMED", evidenceLevel:"HIGH", description:"Former NRO intelligence officer David Grusch testified under oath before Congress that the US government possesses non-human craft and biological remains. He was granted whistleblower protections. Multiple corroborating witnesses have since come forward.", witnesses:["David Grusch","Ryan Graves","David Fravor"], documents:["Congressional Testimony July 2023","IC Inspector General Complaint","DOPSR Cleared Statements"], relatedOrgs:["NRO","AARO","DIA","Congressional UAP Caucus","ICIG"], tags:["congress","whistleblower","oath","nro","biological"] },
  { id:"ohare", name:"O'Hare Airport UFO", date:"2006-11-07", location:"Chicago, Illinois, USA", lat:41.97, lng:-87.90, classification:"REPORTED", evidenceLevel:"MEDIUM", description:"Dozen United Airlines employees witnessed a metallic disc hovering over Gate C17 at O'Hare International Airport. The object shot upward through cloud cover at high speed, leaving a circular hole in the clouds. United Airlines and FAA initially denied the incident.", witnesses:["United Airlines Gate Supervisors","Ramp Workers","Pilots"], documents:["FOIA-Released FAA Radio Tapes","Chicago Tribune Investigation 2007","NARCAP Report"], relatedOrgs:["United Airlines","FAA","NARCAP"], tags:["civilian","airport","faa","foia"] },
  { id:"belgian", name:"Belgian UFO Wave", date:"1989-11-29", location:"Belgium, Europe", lat:50.85, lng:4.35, classification:"CONFIRMED", evidenceLevel:"HIGH", description:"Over 13,500 witnesses including police officers reported large triangular craft with bright lights over Belgium. The Belgian Air Force scrambled F-16s twice. Radar confirmed unknown objects performing impossible maneuvers. The Belgian government officially acknowledged the incidents.", witnesses:["Belgian Gendarmerie Officers","Belgian Air Force Pilots","13,500+ civilians"], documents:["Belgian Air Force Official Report","SOBEPS Investigation Files","NATO Radar Data"], relatedOrgs:["Belgian Air Force","Belgian Government","SOBEPS","NATO"], tags:["military","radar","government","mass-sighting","europe"] },
  { id:"roswell", name:"Roswell Incident", date:"1947-07-08", location:"Roswell, New Mexico, USA", lat:33.39, lng:-104.52, classification:"ALLEGED", evidenceLevel:"LOW", description:"A ranch foreman found unusual debris on a ranch 75 miles north of Roswell. The RAAF initially announced recovery of a 'flying disc' before retracting to 'weather balloon'. Major Jesse Marcel photographed the debris. The 1994 Air Force investigation attributed it to Project Mogul.", witnesses:["Mac Brazel","Jesse Marcel","Glenn Dennis","Frank Kaufmann"], documents:["RAAF Press Release July 8 1947","1994 USAF Report on Roswell","1997 USAF Report","MJ-12 Documents (disputed)"], relatedOrgs:["Roswell Army Air Field (RAAF)","Project Mogul","USAF","CIA"], tags:["historical","military","cover-up","debris"] },
];

const PEOPLE = [
  { id:"grusch", name:"David Grusch", role:"Intelligence Officer / Whistleblower", affiliation:"NRO / AARO", clearance:"TS/SCI", bio:"Former NRO representative to AARO. Testified under oath before Congress in July 2023 that the US government possesses non-human craft and biologics. Filed complaint with IC Inspector General who found his claims credible and urgent.", significance:"HIGH", linkedIncidents:["grusch"], linkedOrgs:["NRO","AARO","DIA"] },
  { id:"elizondo", name:"Luis Elizondo", role:"Former AATIP Director", affiliation:"US Army Counterintelligence / TTSA", clearance:"TS/SCI (former)", bio:"Led the Pentagon's Advanced Aerospace Threat Identification Program from 2010-2017. Resigned in protest over excessive secrecy. Co-founded To The Stars Academy with Tom DeLonge. Instrumental in declassifying the Nimitz and Roosevelt videos.", significance:"HIGH", linkedIncidents:["nimitz","roosevelt"], linkedOrgs:["AATIP","TTSA","DoD"] },
  { id:"fravor", name:"David Fravor", role:"US Navy Commander (Ret.)", affiliation:"US Navy", clearance:"Former Military", bio:"Primary witness to the USS Nimitz Tic-Tac encounter in 2004. Described a 40-foot white object with no wings or exhaust that mirrored his aircraft. Testified before Congress in 2023. One of the most credible military witnesses on record.", significance:"HIGH", linkedIncidents:["nimitz"], linkedOrgs:["USS Nimitz Strike Group","US Navy"] },
  { id:"graves", name:"Ryan Graves", role:"F/A-18 Pilot (Ret.) / UAP Researcher", affiliation:"Americans for Safe Aerospace", clearance:"Former Military", bio:"Former US Navy F/A-18 pilot who reported near-daily UAP encounters off the US East Coast in 2014-2015. Founded Americans for Safe Aerospace. Testified before Congress in July 2023. Believes UAP pose a genuine aviation safety risk.", significance:"HIGH", linkedIncidents:["roosevelt"], linkedOrgs:["US Navy","Americans for Safe Aerospace","AARO"] },
  { id:"mellon", name:"Christopher Mellon", role:"Former Deputy Asst Secretary of Defense", affiliation:"DoD / TTSA", clearance:"Former TS/SCI", bio:"Served as Deputy Assistant Secretary of Defense for Intelligence 1997-2002. Played key role in getting Pentagon UAP videos declassified. Advisor to To The Stars Academy. Strong advocate for UAP congressional oversight.", significance:"HIGH", linkedIncidents:["nimitz","roosevelt"], linkedOrgs:["DoD","TTSA","Senate Intelligence Committee"] },
  { id:"nolan", name:"Gary Nolan", role:"Stanford Professor / Immunologist", affiliation:"Stanford University", clearance:"None", bio:"Professor of Pathology at Stanford School of Medicine. Has analyzed alleged UAP-related biological effects on humans for CIA. Published peer-reviewed research on anomalous brain structures in UAP witnesses. Briefed members of Congress.", significance:"MEDIUM", linkedIncidents:[], linkedOrgs:["Stanford","CIA","TTSA"] },
];

const ORGANIZATIONS = [
  { id:"aaro", name:"AARO", fullName:"All-domain Anomaly Resolution Office", type:"Government", founded:"2022", status:"ACTIVE", description:"The Pentagon's official office for detecting, identifying and attributing UAP. Established by National Defense Authorization Act 2022. Reports to Deputy Secretary of Defense and Director of National Intelligence.", transparency:"LOW", url:"https://www.aaro.mil" },
  { id:"aatip", name:"AATIP", fullName:"Advanced Aerospace Threat Identification Program", type:"Government", founded:"2007", status:"DISSOLVED", description:"Secret Pentagon program funded by $22 million through Senator Harry Reid. Ran from 2007-2012 officially, continued informally. Produced reports on UAP propulsion, materials, and biological effects. Led by Luis Elizondo.", transparency:"VERY LOW", url:"https://en.wikipedia.org/wiki/Advanced_Aerospace_Threat_Identification_Program" },
  { id:"ttsa", name:"To The Stars Academy", fullName:"To The Stars Academy of Arts & Science", type:"Private", founded:"2017", status:"ACTIVE", description:"Founded by Tom DeLonge with former government officials including Luis Elizondo, Christopher Mellon, and Jim Semivan. Instrumental in releasing Nimitz and Roosevelt videos. Acquired alleged UAP metamaterial samples.", transparency:"MEDIUM", url:"https://www.tothestarsacademy.com" },
  { id:"dia", name:"DIA", fullName:"Defense Intelligence Agency", type:"Government", founded:"1961", status:"ACTIVE", description:"Primary US military intelligence agency. Funded AATIP program. Produced classified reports on UAP propulsion and materials. Possesses significant classified UAP research according to David Grusch.", transparency:"VERY LOW", url:"https://www.dia.mil" },
  { id:"bigelow", name:"Bigelow Aerospace", fullName:"Bigelow Aerospace Advanced Space Studies", type:"Private", founded:"1999", status:"DORMANT", description:"Founded by Robert Bigelow, funded by $22M AATIP contract through BAASS subsidiary. Investigated Skinwalker Ranch. Reportedly warehoused UAP-related materials. Bigelow publicly stated ETs are here on 60 Minutes.", transparency:"LOW", url:"https://bigelowaerospace.com" },
  { id:"nro", name:"NRO", fullName:"National Reconnaissance Office", type:"Government", founded:"1961", status:"ACTIVE", description:"US agency responsible for spy satellites. David Grusch served as NRO representative to AARO. According to Grusch testimony, NRO has significant UAP-related programs. Budget classified.", transparency:"VERY LOW", url:"https://www.nro.gov" },
];

const DOCUMENTS = [
  { id:"flir1", name:"FLIR1 Video", year:2020, type:"Video", classification:"DECLASSIFIED", url:"https://www.defense.gov/Newsroom/Releases/Release/Article/2165713/statement-by-the-department-of-defense-on-the-release-of-historical-navy-videos/", description:"Pentagon-released infrared video from USS Nimitz encounter 2004. Shows Tic-Tac object performing impossible maneuvers at hypersonic speed." },
  { id:"gimbal", name:"Gimbal Video", year:2020, type:"Video", classification:"DECLASSIFIED", url:"https://www.defense.gov/Newsroom/Releases/Release/Article/2165713/", description:"Shows rotating object off US East Coast. Pilots audible on recording noting the object is rotating. No known propulsion system." },
  { id:"uaptf2021", name:"UAP Task Force Report", year:2021, type:"Report", classification:"PARTIALLY DECLASSIFIED", url:"https://www.dni.gov/files/ODNI/documents/assessments/Prelimary-Assessment-UAP-20210625.pdf", description:"Preliminary Assessment by ODNI. Examined 144 UAP reports. Could not explain 143. Raised concerns about national security and flight safety." },
  { id:"grusch2023", name:"Grusch Congressional Testimony", year:2023, type:"Testimony", classification:"PUBLIC", url:"https://www.youtube.com/watch?v=KQ7Dw-739VY", description:"David Grusch testifies under oath that US has non-human craft and biologics. Ryan Graves and David Fravor corroborate UAP encounters. Watched by millions worldwide." },
  { id:"aaro2024", name:"AARO Historical Record Report Vol.1", year:2024, type:"Report", classification:"PARTIALLY DECLASSIFIED", url:"https://www.aaro.mil/Portals/136/PDFs/FY2024/Historical_Record_Report_Volume_1_2024.pdf", description:"AARO's official historical review of US government UAP programs. Reviewed 70 years of records. Found no evidence of hidden programs, contradicting Grusch's testimony." },
  { id:"bluebook", name:"Project Blue Book Files", year:1969, type:"Archive", classification:"DECLASSIFIED", url:"https://www.fold3.com/title/471/project-blue-book-ufo-investigations", description:"12,618 UAP sightings investigated 1952-1969. 701 remain 'unidentified'. Officially closed but critics allege cases were misclassified." },
];

// Fetch live UAP news from Google News RSS
async function fetchUAPNews(): Promise<Array<{title:string;url:string;source:string;pubDate:string}>> {
  const queries = ["UAP UFO sighting 2025","Pentagon UFO disclosure","David Grusch UAP","alien craft government"];
  const results: Array<{title:string;url:string;source:string;pubDate:string}> = [];
  for (const q of queries.slice(0,2)) {
    try {
      const rss = await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`, { headers:{"User-Agent":"TheTheorist/1.0"}, signal:AbortSignal.timeout(6000) });
      if (!rss.ok) continue;
      const xml = await rss.text();
      for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
        const x=m[1];
        const title=x.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/)?.[1]?.trim()??"";
        const link=x.match(/<link>(.*?)<\/link>/)?.[1]?.trim()??"";
        const pub=x.match(/<pubDate>(.*?)<\/pubDate>/)?.[1]?.trim()??"";
        const source=x.match(/<source[^>]*>(.*?)<\/source>/)?.[1]?.trim()??"";
        if (title&&link&&!/sponsored|advertisement/i.test(title)) results.push({title,url:link,source,pubDate:pub});
      }
    } catch {}
  }
  return results.slice(0,10);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? "all";
  const id   = searchParams.get("id") ?? "";

  // Single incident analysis
  if (type === "analyze" && id) {
    const incident = INCIDENTS.find(i => i.id === id);
    if (!incident) return NextResponse.json({ error:"not_found" }, { status:404 });
    try {
      const analysis = await callOpenAIJSON<{ summary:string; conspiracy_angle:string; probability:number; key_connections:string[]; verdict:string }>({
        apiKey: process.env.OPENAI_API_KEY!,
        system: `You are a UAP intelligence analyst. Analyze the given UAP incident and return ONLY valid JSON: {"summary":"3-4 sentences factual analysis","conspiracy_angle":"What government cover-up or hidden truth might this suggest","probability":45,"key_connections":["connection1","connection2","connection3"],"verdict":"NATURAL_PHENOMENON|CLASSIFIED_TECHNOLOGY|NON-HUMAN_ORIGIN|UNKNOWN"}`,
        user: `Incident: ${incident.name}\nDate: ${incident.date}\nLocation: ${incident.location}\nDescription: ${incident.description}\nWitnesses: ${incident.witnesses.join(", ")}\nDocuments: ${incident.documents.join(", ")}`,
        maxTokens: 600, model: "gpt-4o-mini",
      });
      return NextResponse.json({ incident, analysis });
    } catch(e) {
      return NextResponse.json({ incident, analysis:null, error:String(e) });
    }
  }

  const news = await fetchUAPNews();
  return NextResponse.json({ incidents:INCIDENTS, people:PEOPLE, organizations:ORGANIZATIONS, documents:DOCUMENTS, news, generated_at:new Date().toISOString() });
}
