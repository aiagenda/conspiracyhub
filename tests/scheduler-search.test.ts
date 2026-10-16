import test from 'node:test';
import assert from 'node:assert/strict';
import { cronOccurrence, isValidCron, matchesCronNow, scheduleDueAt } from '../src/lib/server/schedulerTiming';
import { mergePublicationResults, normalizeSearchQuery, parsePublicationFilters, publicationSearchParams, type PublicationResult } from '../src/lib/publicationSearch';
const now = new Date('2026-10-15T09:03:45Z');
test('missed 07:00 job is due at 09:03 instead of lost', () => assert.equal(scheduleDueAt({schedule_cron:'0 7 * * *'},now).toISOString(),'2026-10-15T07:00:00.000Z'));
test('completed occurrence does not rerun and next occurrence is strictly future', () => {
 assert.equal(scheduleDueAt({schedule_cron:'0 7 * * *'},now,'2026-10-15T07:01:00Z').toISOString(),'2026-10-16T07:00:00.000Z');
 assert.equal(cronOccurrence('*/5 * * * *',now,'next').toISOString(),'2026-10-15T09:05:00.000Z');
});
test('retry time wins over normal schedule', () => assert.equal(scheduleDueAt({schedule_cron:'0 7 * * *',next_run_at:'2026-10-16T07:00:00Z',retry_at:'2026-10-15T09:05:00Z'},now).toISOString(),'2026-10-15T09:05:00.000Z'));
test('UTC cron lists, ranges, steps and Sunday alias work', () => {
 assert.equal(matchesCronNow('0,15,30,45 8-10 * * 1-5',new Date('2026-10-15T09:15:00Z')),true);
 assert.equal(matchesCronNow('0 9 * * 7',new Date('2026-10-18T09:00:00Z')),true);
 for(const cron of ['60 * * * *','*/0 * * * *','0 24 * * *','bad','0 9 31 13 *']) assert.equal(isValidCron(cron),false);
});
test('query grammar cannot escape into PostgREST filters', () => assert.equal(normalizeSearchQuery('uap),status.eq.draft%*'), 'uap status eq draft'));
test('filters retain unicode terms and roundtrip pagination', () => {
 const parsed=parsePublicationFilters(new URLSearchParams('q=árvíz&type=analysis&period=month&topic=science&page=2'));
 assert.deepEqual(parsePublicationFilters(publicationSearchParams(parsed)),parsed);
 assert.equal(parsePublicationFilters(new URLSearchParams('page=-1')).page,1);
 assert.equal(parsePublicationFilters(new URLSearchParams('page=99999')).page,50);
});
test('search merges published news and analyses globally before paging', () => {
 const rows: PublicationResult[]=Array.from({length:40},(_,i)=>({id:String(i),title:String(i),excerpt:'',href:'/article/'+i,kind:i%2?'news':'analysis',category:'science',publishedAt:new Date(Date.UTC(2026,9,15,0,0,40-i)).toISOString(),source:'test'}));
 const groups=[rows.filter(r=>r.kind==='news'),rows.filter(r=>r.kind==='analysis')];
 assert.deepEqual(mergePublicationResults(groups,2).map(r=>r.id),rows.slice(18,36).map(r=>r.id));
});

test('cron authentication rejects missing, empty and wrong secrets in every environment', async () => {
 const {checkCronAuth}=await import('../src/lib/server/cronAuth');
 const previous=process.env.CRON_SECRET;
 try {
  delete process.env.CRON_SECRET; assert.equal(checkCronAuth(null),false); assert.equal(checkCronAuth('Bearer anything'),false);
  process.env.CRON_SECRET=''; assert.equal(checkCronAuth('Bearer '),false);
  process.env.CRON_SECRET='test-only-secret'; assert.equal(checkCronAuth('test-only-secret'),false); assert.equal(checkCronAuth('Bearer wrong'),false); assert.equal(checkCronAuth('Bearer test-only-secret'),true);
 } finally { if(previous===undefined)delete process.env.CRON_SECRET;else process.env.CRON_SECRET=previous; }
});
