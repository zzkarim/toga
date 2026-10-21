import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { randomBytes,createHash } from 'node:crypto';
import { TERMS_VERSION,PRIVACY_VERSION } from '../lib/legal.mjs';
const db=new PrismaClient(), base=process.env.TEST_URL||'http://127.0.0.1:3000';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname)||process.env.RESEND_API_KEY||process.env.GMAIL_APP_PASSWORD)throw Error('Local only');
const tag='supply-'+Date.now(), users=[],cookies=[];
const day=n=>new Date(Date.now()+n*86400000).toISOString().slice(0,10);
async function call(path,method='GET',body,actor=0,status=200){const r=await fetch(base+'/api/'+path,{method,headers:{Origin:process.env.APP_URL||base,'Content-Type':'application/json',Cookie:cookies[actor]},body:body?JSON.stringify(body):undefined});const data=await r.json();assert.equal(r.status,status,JSON.stringify(data));return data;}
const prompt=async a=>(await call('me',undefined,undefined,a)).user.needsSupplyPrompt;
const photo=async a=>{const id=randomBytes(16).toString('hex');await db.upload.create({data:{id,ownerId:users[a]}});return `/api/photos/${id}`;};
let item;
const request=(a,b,actor,status=200)=>call('requests','POST',{listingId:item.id,startDate:day(a),endDate:day(b),replacementValue:null,renterAcknowledged:true,termsVersion:TERMS_VERSION},actor,status);
try{
 // 0 new lister, 1 skipper/renter, 2 existing user with a listing, 3 admin
 for(let i=0;i<4;i++){const u=await db.user.create({data:{email:`${tag}-${i}@gatech.edu`,name:`Supply ${i}`,phone:'+14045550101',role:i===3?'admin':'user',passwordHash:'fixture-disabled',emailVerifiedAt:new Date(),termsAcceptedAt:new Date(),ageConfirmedAt:new Date(),termsVersion:TERMS_VERSION,privacyVersion:PRIVACY_VERSION}});users.push(u.id);const token=randomBytes(32).toString('hex');await db.session.create({data:{id:createHash('sha256').update(token).digest('hex'),userId:u.id,expiresAt:new Date(Date.now()+3600000)}});cookies.push('toga_session='+token);}
 await db.listing.create({data:{ownerId:users[2],title:tag+' existing',description:'',size:'M',condition:'Good',price:5,photos:'[]'}});
 assert.equal(await prompt(0),true,'new user after required onboarding sees prompt');
 assert.equal(await prompt(1),true,'existing user without listing sees one-time prompt');
 assert.equal(await prompt(2),false,'contributor is not prompted');
 assert.equal(await prompt(3),false,'admin is not prompted');
 await call('me/supply-prompt','POST',{},1);
 assert.equal(await prompt(1),false);assert.equal(await prompt(1),false,'skip persists');
 assert.ok((await db.user.findUnique({where:{id:users[1]}})).supplyPromptHandledAt);
 assert.equal(await db.listing.count({where:{ownerId:users[1]}}),0,'skip is not a listing');
 // Streamlined create: no description, one owner-blocked day.
 const {listing}=await call('listings','POST',{title:tag,price:8,size:'M',condition:'Good',photos:[await photo(0)],lenderConfirmed:true,categories:['Costume'],blockedRanges:[{start:day(10),end:day(10)}]},0);
 item=listing;assert.equal(await prompt(0),false,'listing completes supply onboarding');
 const browse=(await call('listings',undefined,undefined,1)).listings.find(l=>l.id===item.id);
 assert.ok(browse,'owner block keeps listing visible');assert.equal(browse.blockedRanges,undefined,'reason not exposed');
 assert.deepEqual((await call(`listings/${item.id}/availability`,undefined,undefined,1)).unavailableRanges,[{start:day(10),end:day(10)}]);
 const own=(await call('listings?mine=true',undefined,undefined,0)).listings.find(l=>l.id===item.id);
 assert.deepEqual(own.blockedRanges,[{start:day(10),end:day(10)}]);
 await request(10,10,1,409);await request(9,11,1,409);
 await request(9,9,1);await request(11,11,1);
 // Owner cannot block a reserved day; can still edit dates while requests are live.
 const edit=b=>({title:item.title,description:item.description,price:item.price,size:item.size,condition:item.condition,retailValue:item.retailValue,categories:item.categories,photos:JSON.parse(item.photos),lenderConfirmed:true,...b});
 const conflict=await call(`listings/${item.id}`,'PATCH',edit({blockedRanges:[{start:day(8),end:day(9)}]}),0,409);
 assert.match(conflict.error,/already have a rental\/request/);
 await call(`listings/${item.id}`,'PATCH',edit({blockedRanges:[{start:day(10)},{start:day(13),end:day(14)}]}),0);
 for(const n of [10,13,14])await request(n,n,1,409);await request(12,12,1);
 await call(`listings/${item.id}`,'PATCH',edit({title:tag+' renamed',blockedRanges:[]}),0,400);
 await call(`listings/${item.id}`,'PATCH',edit({blockedRanges:[]}),0);
 await request(10,10,1);
 assert.equal((await db.listing.findUnique({where:{id:item.id}})).title,tag);
 console.log('Supply + owner availability integration passed: prompt targeting, skip persistence, create completion, blocks, ranges, conflicts, API bypass, reopen.');
}finally{
 const ls=await db.listing.findMany({where:{ownerId:{in:users}},select:{id:true}}),ids=ls.map(l=>l.id);
 const rr=await db.rentalRequest.findMany({where:{listingId:{in:ids}},select:{id:true}});
 await db.rentalActivity.deleteMany({where:{requestId:{in:rr.map(r=>r.id)}}});await db.rentalRequest.deleteMany({where:{listingId:{in:ids}}});await db.listing.deleteMany({where:{id:{in:ids}}});
 await db.upload.deleteMany({where:{ownerId:{in:users}}});await db.email.deleteMany({where:{OR:[{to:{startsWith:tag}},{text:{contains:tag}}]}});await db.session.deleteMany({where:{userId:{in:users}}});await db.user.deleteMany({where:{id:{in:users}}});await db.$disconnect();
}
