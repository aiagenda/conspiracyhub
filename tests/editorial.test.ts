import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalSourceUrl, assessEditorialQuality, articleCitationUrls } from '../src/lib/editorialQuality';
import { sourceIdentity, storySlug } from '../src/lib/server/storyIdentity';
import { displayReaderReaction } from '../src/lib/readerReactionVote';
const now = new Date('2026-10-15T12:00:00Z');
const evidence = ['https://nasa.gov/report', 'https://reuters.com/report'].map(url => ({ title: 'Evidence', url, text: 'evidence '.repeat(100), publishedAt: '2026-10-14' }));
const content = 'Useful reporting '.repeat(60) + '[NASA](https://nasa.gov/report) and [Reuters](https://reuters.com/report)';
const assess = (changes = {}) => assessEditorialQuality({ title: 'An investigation', content, evidence, now, ...changes });
test('canonical URLs discard trackers and fragments but preserve meaningful queries', () => {
 assert.equal(canonicalSourceUrl('https://www.nasa.gov/report/?utm_source=x&id=2#top'), 'https://nasa.gov/report?id=2');
 assert.equal(canonicalSourceUrl('javascript:alert(1)'), '');
 assert.equal(canonicalSourceUrl('https://user:secret@example.com'), '');
});
test('long common RSS prefixes do not collide', () => {
 const a = 'https://news.google.com/rss/articles/story-a'; const b = 'https://news.google.com/rss/articles/story-b';
 assert.notEqual(sourceIdentity('gnews', a), sourceIdentity('gnews', b));
 assert.equal(sourceIdentity('rss', a), sourceIdentity('rss', a+'?utm_source=feed'));
});
test('story slugs remain stable between runs', () => {
 assert.equal(storySlug('A story', evidence[0].url), storySlug('A story', evidence[0].url+'?utm_campaign=x'));
 assert.notEqual(storySlug('A story', evidence[0].url), storySlug('A story', evidence[1].url));
});
test('citations exclude images and canonicalize tracking parameters', () => {
 assert.deepEqual(articleCitationUrls('![image](https://example.com/photo) [source](https://nasa.gov/report?utm_source=x)'), ['https://nasa.gov/report']);
});
test('readable cited evidence passes structural checks', () => assert.equal(assess().passed, true));
test('snippets cannot count as evidence', () => assert.equal(assess({ evidence: evidence.map(e => ({...e,text:'search snippet'})) }).passed, false));
test('two pages on the same domain do not satisfy distinct source requirement', () => assert.equal(assess({ evidence: [evidence[0], evidence[0]] }).passed, false));
test('unretrieved inline citation fails closed', () => assert.equal(assess({ content: content+' [invented](https://example.com/invented)' }).passed, false));
test('historical sources cannot support latest-news framing', () => assert.equal(assess({title:'Latest update',evidence:evidence.map(e=>({...e,publishedAt:'2023-12-09'}))}).passed,false));
test('unknown or future source date cannot substantiate breaking news', () => {
 assert.equal(assess({title:'Breaking update',evidence:evidence.map(e=>({...e,publishedAt:null}))}).passed,false);
 assert.equal(assess({evidence:evidence.map(e=>({...e,publishedAt:'2027-01-01'}))}).passed,false);
});
test('a sourced brief can use one source only when explicitly configured', () => assert.equal(assess({content:content.replace(' and [Reuters](https://reuters.com/report)',''),evidence:[evidence[0]],minimumSources:1}).passed,true));
test('reader reaction counts never invent votes', () => {
 assert.deepEqual(displayReaderReaction(undefined,'story',99),{up:0,down:0,score:0});
 assert.deepEqual(displayReaderReaction({up:2,down:1,score:500}),{up:2,down:1,score:1});
});

test('research source networking rejects private, loopback and metadata addresses', async () => {
 const {isPublicSourceAddress}=await import('../src/lib/server/sourceFetch');
 for(const ip of ['127.0.0.1','10.0.0.1','172.16.0.1','192.168.1.1','169.254.169.254','100.64.0.1','0.0.0.0','::1','::ffff:127.0.0.1','fe80::1','fc00::1']) assert.equal(isPublicSourceAddress(ip),false,ip);
 assert.equal(isPublicSourceAddress('8.8.8.8'),true);
 assert.equal(isPublicSourceAddress('2606:4700:4700::1111'),true);
});
test('absence of a documented theory does not cause another model call or invented filler', async () => {
 const {ensureOracleTheoriesAtLeastOne}=await import('../src/lib/oracleTheories');
 const result=await ensureOracleTheoriesAtLeastOne({theories:[]} as never,'No evidence',{apiKey:'unused'});
 assert.deepEqual(result.theories,[]);
});
