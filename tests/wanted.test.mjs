import test from 'node:test';
import assert from 'node:assert/strict';
import {wantedData,publicWanted,wantedAudienceWhere,activeWantedWhere,wantedBroadcastMail,wantedResponseMail,queueWantedEmails,wantedDates} from '../lib/wanted.mjs';
import {buildAdminMarketplaceEmail,notifyAdminOfMarketplaceEvent} from '../lib/admin-notifications.mjs';
import {mailContent} from '../lib/mail-provider.mjs';
const now=new Date('2026-10-21T15:00:00Z');
test('wanted needs only an item and a day; optional fields are bounded and linkless',()=>{
 const one=wantedData({title:'  Cowboy   boots ',startDate:'2026-10-31'},now);
 assert.equal(one.title,'Cowboy boots');assert.equal(one.details,'');assert.equal(one.size,null);
 assert.equal(+one.startDate,+one.endDate,'one-day need');
 const range=wantedData({title:'Mario costume',details:'Men\'s M/L',size:'M/L',startDate:'2026-10-30',endDate:'2026-11-01'},now);
 assert.equal(wantedDates(range),'Oct 30 – Nov 1');assert.equal(wantedDates(one),'Oct 31');
 for(const bad of [{title:'ab'},{title:'x'.repeat(81)},{title:'Boots',details:'x'.repeat(301)},{title:'Boots',size:'x'.repeat(31)},{title:'Boots see https://evil.example'},{title:'Boots',details:'dm me at www.site'},{title:'Boots',details:'grab.ly/x'},{title:'Bo\u0000ots'},{title:['Boots']}])
  assert.throws(()=>wantedData({startDate:'2026-10-31',...bad},now),undefined,JSON.stringify(bad));
 assert.throws(()=>wantedData({title:'Boots',startDate:'2026-10-20'},now),/date/,'past start rejected');
 assert.throws(()=>wantedData({title:'Boots',startDate:'2026-10-31',endDate:'2026-10-30'},now));
});
test('active feed excludes past, closed, removed and inactive-account posts',()=>{
 const w=activeWantedWhere(now);
 assert.equal(w.status,'Open');assert.equal(w.moderationStatus,'Visible');assert.equal(w.user.accountStatus,'Active');
 assert.equal(w.endDate.gte.toISOString(),'2026-10-21T00:00:00.000Z','posts ending today stay; earlier ones drop');
});
test('public wanted cards expose no requester identity, contact or payment data',()=>{
 const card=publicWanted({id:'w1',userId:'u1',title:'Boots',details:'',size:null,startDate:now,endDate:now,createdAt:now,status:'Open',moderationStatus:'Visible',user:{email:'a@gatech.edu',phone:'+1404',paymentInfo:'venmo',name:'Ann'},_count:{listings:2}},'u2');
 assert.deepEqual(Object.keys(card).sort(),['createdAt','details','endDate','id','isMine','responseCount','size','startDate','title']);
 assert.equal(card.isMine,false);assert.equal(card.responseCount,2);
 assert.doesNotMatch(JSON.stringify(card),/gatech|1404|venmo|Ann|u1/);
});
test('audience excludes requester, inactive, unverified, admin and test accounts; testers stay isolated',()=>{
 const w=wantedAudienceWhere({id:'me',role:'user'});
 assert.deepEqual(w.id,{not:'me'});assert.equal(w.accountStatus,'Active');assert.equal(w.role,'user');
 assert.deepEqual(w.emailVerifiedAt,{not:null});assert.deepEqual(w.email,{endsWith:'@gatech.edu',not:'jointoga@gmail.com'});
 assert.equal(wantedAudienceWhere({id:'t',role:'tester'}).role,'tester');
 assert.equal(wantedAudienceWhere({id:'a',role:'admin'}).role,'user');
});
test('wanted emails are short, plain-text safe and link only to Toga',()=>{
 process.env.APP_URL='https://jointoga.com';
 const post={id:'w1',title:'Cowboy Boots\r\nBcc: x',startDate:new Date('2026-10-31'),endDate:new Date('2026-10-31')};
 const b=wantedBroadcastMail(post);
 assert.equal(b.subject,'Someone on Toga is looking for Cowboy Boots Bcc: x 👀');
 assert.match(b.text,/looking to rent Cowboy Boots/);assert.match(b.text,/https:\/\/jointoga\.com\/\?view=wanted&have=w1/);
 const r=wantedResponseMail(post,{id:'l1',title:'Boots <script>'});
 assert.match(r.subject,/^Someone listed Boots/);assert.match(r.text,/view=browse&listing=l1/);
 for(const m of [b,r]){assert.doesNotMatch(m.subject,/[\r\n]/);assert.doesNotMatch(mailContent({id:'x',to:'t@gatech.edu',...m}).html,/<script>/);}
});
test('queueing writes deterministic outbox ids and never duplicates a logical email',async()=>{
 const rows=new Map();let where;
 const store={user:{findMany:async q=>{where=q.where;return [{id:'b',email:'b@gatech.edu'},{id:'c',email:'c@gatech.edu'}];}},email:{createMany:async({data,skipDuplicates})=>{assert.equal(skipDuplicates,true);for(const d of data)if(!rows.has(d.id))rows.set(d.id,d);}}};
 const post={id:'w1',title:'Boots',startDate:now,endDate:now};
 const ids=await queueWantedEmails(store,post,{id:'a',role:'user'},'resend');
 await queueWantedEmails(store,post,{id:'a',role:'user'},'resend');
 assert.deepEqual(ids,['wanted-w1-b','wanted-w1-c']);assert.equal(rows.size,2);
 assert.deepEqual(where.id,{not:'a'},'requester excluded');
 assert.equal(rows.get('wanted-w1-b').provider,'resend');
});
test('admin copy includes requester, item, dates, id and details but no secrets',async()=>{
 const details={event:'wanted',wantedId:'w9',listingName:'Lab coat',actorName:'Ann Lee',actorEmail:'ann@gatech.edu',startDate:'2026-10-30',endDate:'2026-11-01',size:'M',description:'White, clean'};
 const m=buildAdminMarketplaceEmail(details);
 assert.equal(m.subject,'Toga Admin — New wanted request');
 for(const s of ['Lab coat','Ann Lee (ann@gatech.edu)','2026-10-30 to 2026-11-01','w9','White, clean','Size: M'])assert.ok(m.text.includes(s),s);
 assert.doesNotMatch(m.text,/password|token|phone/i);
 const sent=[];await notifyAdminOfMarketplaceEvent(details,async(to,subject,text,opts)=>{sent.push({to,opts});return {deliveryStatus:'Accepted'};});
 assert.deepEqual(sent,[{to:'jointoga@gmail.com',opts:{id:'admin-wanted-w9'}}]);
 assert.equal(await notifyAdminOfMarketplaceEvent(details,async()=>{throw Object.assign(Error('dup'),{code:'P2002'});}),false,'failure is swallowed');
});
