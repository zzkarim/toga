import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { randomBytes,createHash } from 'node:crypto';
import { TERMS_VERSION,PRIVACY_VERSION } from '../lib/legal.mjs';
import { campusToday } from '../lib/rules.mjs';
const db=new PrismaClient(), base=process.env.TEST_URL||'http://127.0.0.1:3000';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname)||process.env.RESEND_API_KEY||process.env.GMAIL_APP_PASSWORD)throw Error('Local only');
const tag='wanted-'+Date.now(), users=[],cookies=[];
const day=n=>new Date(Date.parse(campusToday()+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
async function call(path,method='GET',body,actor=0,status=200){const r=await fetch(base+'/api/'+path,{method,headers:{Origin:process.env.APP_URL||base,'Content-Type':'application/json',...(actor==null?{}:{Cookie:cookies[actor]})},body:body?JSON.stringify(body):undefined});const data=await r.json();assert.equal(r.status,status,path+' '+JSON.stringify(data));return data;}
const photo=async a=>{const id=randomBytes(16).toString('hex');await db.upload.create({data:{id,ownerId:users[a]}});return `/api/photos/${id}`;};
try{
 // 0 requester A, 1 lender B, 2 other student, 3 suspended, 4 admin, 5 unverified
 for(let i=0;i<6;i++){const u=await db.user.create({data:{email:`${tag}-${i}@gatech.edu`,name:`Want ${i}`,phone:'+14045550101',paymentInfo:'venmo-secret',role:i===4?'admin':'user',accountStatus:i===3?'Suspended':'Active',passwordHash:'fixture-disabled',emailVerifiedAt:i===5?null:new Date(),termsAcceptedAt:new Date(),ageConfirmedAt:new Date(),termsVersion:TERMS_VERSION,privacyVersion:PRIVACY_VERSION,supplyPromptHandledAt:new Date()}});users.push(u.id);const token=randomBytes(32).toString('hex');await db.session.create({data:{id:createHash('sha256').update(token).digest('hex'),userId:u.id,expiresAt:new Date(Date.now()+3600000)}});cookies.push('toga_session='+token);}
 // Unauthorized
 await call('wanted','POST',{title:'Cowboy Boots',startDate:day(3)},null,401);
 await call('wanted',undefined,undefined,null,401);
 // Create
 const before=await db.listing.count();
 const {post}=await call('wanted','POST',{title:tag+' Cowboy Boots',details:"Men's 10-11",startDate:day(3)},0);
 assert.equal(post.isMine,true);
 await call('wanted','POST',{title:'Boots https://x.example',startDate:day(3)},0,400);
 await call('wanted','POST',{title:'Boots',startDate:day(-1)},0,400);
 // Notifications queued: eligible others only, deterministic ids, admin copy.
 await new Promise(r=>setTimeout(r,1500));
 const queued=await db.email.findMany({where:{id:{startsWith:`wanted-${post.id}-`}}});
 const to=queued.map(e=>e.to);
 assert.ok(to.includes(`${tag}-1@gatech.edu`)&&to.includes(`${tag}-2@gatech.edu`),'eligible students queued');
 for(const i of [0,3,4,5])assert.ok(!to.includes(`${tag}-${i}@gatech.edu`),`user ${i} not emailed`);
 assert.equal(queued.length,new Set(queued.map(e=>e.id)).size);
 assert.match(queued[0].subject,/looking for .*Cowboy Boots 👀/);
 const admin=await db.email.findUnique({where:{id:`admin-wanted-${post.id}`}});
 assert.ok(admin,'admin copy queued');assert.equal(admin.to,'jointoga@gmail.com');assert.match(admin.text,new RegExp(`${tag}-0@gatech.edu`));
 // Feed + privacy
 const feedB=await call('wanted',undefined,undefined,1);
 const card=feedB.posts.find(p=>p.id===post.id);assert.ok(card,'visible to B');assert.ok(feedB.unseenCount>=1,'B sees new-demand badge');
 assert.doesNotMatch(JSON.stringify(feedB.posts),new RegExp(`${tag}-0|4045550101|venmo|Want 0|${users[0]}`));
 assert.ok(!(await call('wanted',undefined,undefined,0)).posts.some(p=>p.id===post.id),'own post in Your posts, not feed');
 await call('wanted/seen','POST',{},1);assert.equal((await call('wanted',undefined,undefined,1)).posts.length>0,true);
 // Expired excluded
 const old=await db.wantedPost.create({data:{userId:users[2],title:tag+' old',startDate:new Date(day(-3)),endDate:new Date(day(-2))}});
 assert.ok(!(await call('wanted',undefined,undefined,1)).posts.some(p=>p.id===old.id),'past request excluded');
 // Other user cannot modify; owner can
 await call(`wanted/${post.id}/close`,'POST',{},1,404);
 await call(`wanted/${post.id}/bogus`,'POST',{},0,404);
 // Response listing from "I have this"
 const {listing}=await call('listings','POST',{title:tag+' Cowboy Boots',price:7,size:'M',condition:'Good',photos:[await photo(1)],lenderConfirmed:true,categories:[],blockedRanges:[],sourceWantedId:post.id},1);
 assert.equal(listing.sourceWantedId,post.id,'relationship preserved');assert.equal(listing.status,'Active');
 assert.equal(await db.listing.count(),before+1);
 assert.equal(await db.rentalRequest.count({where:{listingId:listing.id}}),0,'no rental fabricated');
 const notice=await db.email.findUnique({where:{id:`wanted-response-${listing.id}`}});
 assert.equal(notice.to,`${tag}-0@gatech.edu`);assert.match(notice.text,new RegExp(`listing=${listing.id}`));
 const mineA=await call('wanted',undefined,undefined,0);
 const mine=mineA.mine.find(p=>p.id===post.id);
 assert.equal(mine.status,'Open','listing alone does not fulfil');assert.equal(mine.responses[0].id,listing.id);assert.equal(mine.responses[0].isNew,true);assert.ok(mineA.unseenCount>=1,'A has in-app notice');
 assert.equal((await call('wanted',undefined,undefined,2)).posts.find(p=>p.id===post.id).responseCount,1);
 // Own post / closed post never link
 const self=await call('listings','POST',{title:tag+' self',price:7,size:'M',condition:'Good',photos:[await photo(0)],lenderConfirmed:true,categories:[],blockedRanges:[],sourceWantedId:post.id},0);
 assert.equal(self.listing.sourceWantedId,null);
 // A still requests normally
 await call('requests','POST',{listingId:listing.id,startDate:day(3),endDate:day(3),replacementValue:null,renterAcknowledged:true,termsVersion:TERMS_VERSION},0);
 assert.equal((await db.rentalRequest.findFirst({where:{listingId:listing.id}})).status,'Pending');
 // Owner closes; feed drops it; status idempotent
 await call(`wanted/${post.id}/found`,'POST',{},0);await call(`wanted/${post.id}/close`,'POST',{},0);
 assert.equal((await db.wantedPost.findUnique({where:{id:post.id}})).status,'Fulfilled');
 assert.ok(!(await call('wanted',undefined,undefined,1)).posts.some(p=>p.id===post.id));
 // Admin moderation
 const spam=(await call('wanted','POST',{title:tag+' spam',startDate:day(2)},2)).post;
 await call('admin/moderate','POST',{targetType:'wanted',targetId:spam.id,action:'remove',note:'spam',confirm:true},1,403);
 await call('admin/moderate','POST',{targetType:'wanted',targetId:spam.id,action:'remove',note:'spam',confirm:true,confirmText:'REMOVE'},4);
 assert.ok(!(await call('wanted',undefined,undefined,1)).posts.some(p=>p.id===spam.id),'removed post hidden');
 assert.ok((await call('admin',undefined,undefined,4)).wanted.some(w=>w.id===spam.id),'admin sees it');
 // Notification failure never rolls back: post exists even with no provider configured.
 assert.ok(await db.wantedPost.findUnique({where:{id:spam.id}}));
 console.log('Wanted integration passed: auth, create, validation, queue/eligibility/admin copy, feed privacy, expiry, ownership, response listing link + notice, no fabricated rental, normal request, close, moderation.');
}finally{
 const ls=await db.listing.findMany({where:{ownerId:{in:users}},select:{id:true}}),ids=ls.map(l=>l.id);
 const rr=await db.rentalRequest.findMany({where:{listingId:{in:ids}},select:{id:true}});
 await db.rentalActivity.deleteMany({where:{requestId:{in:rr.map(r=>r.id)}}});await db.rentalRequest.deleteMany({where:{listingId:{in:ids}}});await db.listing.deleteMany({where:{id:{in:ids}}});
 const ws=await db.wantedPost.findMany({where:{userId:{in:users}},select:{id:true}});
 await db.email.deleteMany({where:{OR:[{to:{startsWith:tag}},{text:{contains:tag}},...ws.map(w=>({id:{contains:w.id}}))]}});
 await db.wantedPost.deleteMany({where:{userId:{in:users}}});await db.adminAudit.deleteMany({where:{adminId:{in:users}}});
 await db.upload.deleteMany({where:{ownerId:{in:users}}});await db.rateLimit.deleteMany({where:{id:{contains:users[0]}}});await db.session.deleteMany({where:{userId:{in:users}}});await db.user.deleteMany({where:{id:{in:users}}});await db.$disconnect();
}
