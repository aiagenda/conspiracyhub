import http from 'node:http';
import { readFileSync } from 'node:fs';
const titles=['The public record behind the next generation of AI','What satellite data can — and cannot — tell us','Inside the debate over digital surveillance','Reading the evidence behind UAP reports','The hidden cost of storing the world’s data','A closer look at climate monitoring','Why the details of a public contract matter','How scientists check extraordinary claims','Who owns the infrastructure of tomorrow?','Tracing the history of an intelligence programme','The limits of a single headline','When a prediction becomes a policy','What changes when records become public','How to read an AI benchmark'];
const sources=[{title:'Primary documentation',url:'https://science.nasa.gov/research/',description:'Original documentation and background for checking the claims.'},{title:'Independent reporting',url:'https://www.reuters.com/technology/',description:'Reporting that adds independent context.'}];
const body='## What the record shows\n\nThis is a local preview article used to check the publication layout. It demonstrates how an evidence-led story separates a documented event from interpretation, and makes its original sources easy to inspect. No claims in this preview have been published to the live site.\n\nA clear article begins with a specific question. The answer should explain what is known, which source supports it, and where the available evidence ends. A source link is useful only when its contents support the statement beside it.\n\n## Why it matters\n\nReaders need context, rather than a longer version of the headline. That means identifying who is affected, describing the underlying mechanism, and acknowledging meaningful uncertainty. The aim is to make a complex subject easier to understand without making the evidence sound stronger than it is.\n\nSee the [primary documentation](https://science.nasa.gov/research/) and [independent reporting](https://www.reuters.com/technology/) for context.\n\n## What remains open\n\nA good investigation leaves room for correction. New records may change the picture, while an old source should retain its original date. The review process checks these distinctions before publication.\n';
let news=titles.map((title,i)=>({id:`preview-${i+1}`,guardian_id:`preview-${i+1}`,title,summary:'A closer look at the evidence, the people affected, and the questions that remain unanswered.',url:sources[0].url,image:`http://127.0.0.1:55888/image/${i%3}`,published_at:new Date(Date.now()-i*3600000).toISOString(),section:['technology','science','surveillance'][i%3],source:'public records',score:90-i,angle:'',rewrite_status:'ready',body_html:body}));
// A read-only copy of the owner's public feed makes design comparisons meaningful.
// The article bodies remain explicitly marked preview content; nothing is published.
try {
 const snapshot=JSON.parse(readFileSync(new URL('./preview-news.json',import.meta.url),'utf8'));
 const captured=Date.parse(snapshot.capturedAt);
 const capturedNews=snapshot.items.map((item,i)=>{
   const age=item.meta?.match(/(\d+)h ago/i)?.[1];
   const sourceImage=new URL(item.image);sourceImage.searchParams.set('w','640');
   return {id:new URL(item.href).pathname.split('/').pop(),guardian_id:`public-preview-${i}`,title:item.title,summary:'',url:item.href,image:sourceImage.href,published_at:new Date(captured-Number(age??i)*3600000).toISOString(),section:item.meta?.split(' · ')[0]||'latest',source:'Public site snapshot',score:Number(item.priority)||0,angle:item.angle,rewrite_status:'ready',body_html:body};
 });
 news=[...capturedNews,...news.map(row=>({...row,published_at:new Date(captured-30*86400000).toISOString()}))];
} catch { /* The synthetic fixtures still work without a captured public feed. */ }
const generated=Array.from({length:22},(_,i)=>({id:`analysis-${i+1}`,slug:`preview-investigation-${i+1}`,title:titles[i%titles.length],excerpt:'An evidence-led guide to what we know, what is contested, and what deserves a closer look.',meta_description:'A preview of the new investigation reader.',focus_keyword:'technology',category:'ai',tags:['technology'],content:body,sources,mode:'tech_brief',status:'published',published_at:news[0].published_at,created_at:news[0].published_at,updated_at:news[0].published_at,source_published_at:'2026-10-12T12:00:00Z',verified_at:news[0].published_at,editorial_checks:{passed:true}}));
http.createServer((req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1:55888');
 res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Headers','*');
 if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Preview fixture is read-only'}));return;}
 if(url.pathname.startsWith('/image/')){const i=Number(url.pathname.split('/').pop());res.setHeader('Content-Type','image/svg+xml');res.end(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="700" viewBox="0 0 1200 700"><defs><linearGradient id="b" x2="1" y2="1"><stop stop-color="${['#243f40','#3e4458','#433b30'][i]}"/><stop offset="1" stop-color="#0a1119"/></linearGradient></defs><rect width="1200" height="700" fill="url(#b)"/><g fill="none" stroke="#afc4c7" opacity=".35">${Array.from({length:12},(_,n)=>`<ellipse cx="${620+n*22}" cy="350" rx="${90+n*36}" ry="${110+n*24}" transform="rotate(-30 600 350)"/>`).join('')}</g><circle cx="780" cy="230" r="95" fill="#c4d6ca" opacity=".8"/><text x="65" y="625" fill="#d7ded8" font-family="sans-serif" font-size="20" letter-spacing="5">THE THEORIST / PREVIEW</text></svg>`);return;}
 const table=url.pathname.split('/').pop();let rows=table==='news_items'?news:table==='generated_articles'?generated:[];
 for(const [key,v] of url.searchParams){if(v.startsWith('eq.'))rows=rows.filter(r=>String(r[key])===v.slice(3));if(v.startsWith('neq.'))rows=rows.filter(r=>String(r[key])!==v.slice(4));if(v.startsWith('gte.'))rows=rows.filter(r=>String(r[key])>=v.slice(4));if(v.startsWith('in.('))rows=rows.filter(r=>v.slice(4,-1).split(',').includes(String(r[key])));}
 const ors=url.searchParams.get('or');if(ors){const q=ors.match(/ilike\.%([^%]*)%/)?.[1]?.toLowerCase();if(q) rows=rows.filter(r=>(r.title+' '+r.summary+' '+r.excerpt).toLowerCase().includes(q));}
 for(const [key,value] of url.searchParams){
   if(value.startsWith('ilike.')){const term=value.slice(6).replaceAll('%','').toLowerCase();rows=rows.filter(row=>String(row[key]??'').toLowerCase().includes(term));}
   if(value.startsWith('not.ilike.')){const term=value.slice(10).replaceAll('%','').toLowerCase();rows=rows.filter(row=>!String(row[key]??'').toLowerCase().includes(term));}
   if(value.startsWith('not.in.(')){const excluded=value.slice(8,-1).split(',');rows=rows.filter(row=>!excluded.includes(String(row[key])));}
 }
 const orders=(url.searchParams.get('order')||'').split(',').filter(Boolean).map(order=>order.split('.'));
 rows=[...rows].sort((a,b)=>{for(const [key,direction] of orders){const av=a[key],bv=b[key];const comparison=av===bv?0:av>bv?1:-1;if(comparison)return direction==='desc'?-comparison:comparison;}return 0;});
 const count=rows.length;const offset=Number(url.searchParams.get('offset')||0);const limit=Number(url.searchParams.get('limit')||1000);rows=rows.slice(offset,offset+limit);
 res.setHeader('Content-Type','application/json');res.setHeader('Content-Range',`${offset}-${Math.max(offset,offset+rows.length-1)}/${count}`);
 if(req.method==='HEAD'){res.end();return;}
 const single=req.headers.accept?.includes('vnd.pgrst.object');res.end(JSON.stringify(single?(rows[0]??null):rows));
}).listen(55888,'127.0.0.1',()=>console.log('Read-only preview fixtures on 55888'));
