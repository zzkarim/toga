import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { randomBytes,createHash } from 'node:crypto';
import { TERMS_VERSION,PRIVACY_VERSION } from '../lib/legal.mjs';
const db=new PrismaClient(), base=process.env.TEST_URL||'http://127.0.0.1:3000';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname)||process.env.RESEND_API_KEY||process.env.GMAIL_APP_PASSWORD)throw Error('Local only');
const tag='availability-'+Date.now(), users=[],cookies=[];let item;
const day=n=>new Date(Date.now()+n*86400000).toISOString().slice(0,10);
async function call(path,method='GET',body,actor=0,status=200){const r=await fetch(base+'/api/'+path,{method,headers:{Origin:process.env.APP_URL||base,'Content-Type':'application/json',Cookie:cookies[actor]},body:body?JSON.stringify(body):undefined});const data=await r.json();assert.equal(r.status,status,JSON.stringify(data));return data;}
const request=(a,b)=>({listingId:item.id,startDate:day(a),endDate:day(b),replacementValue:50,renterAcknowledged:true,termsVersion:TERMS_VERSION});
try{
 for(let i=0;i<3;i++){const u=await db.user.create({data:{email:`${tag}-${i}@gatech.edu`,name:`Availability ${i}`,phone:'+14045550101',passwordHash:'fixture-disabled',emailVerifiedAt:new Date(),termsAcceptedAt:new Date(),ageConfirmedAt:new Date(),termsVersion:TERMS_VERSION,privacyVersion:PRIVACY_VERSION}});users.push(u.id);const token=randomBytes(32).toString('hex');await db.session.create({data:{id:createHash('sha256').update(token).digest('hex'),userId:u.id,expiresAt:new Date(Date.now()+3600000)}});cookies.push('toga_session='+token);}
 item=await db.listing.create({data:{ownerId:users[0],title:tag,description:'Availability fixture',size:'M',condition:'Good',price:10,retailValue:50,photos:'[]'}});
 await call('requests','POST',request(4,5),1);
 assert.ok((await call('listings',undefined,undefined,2)).listings.some(l=>l.id===item.id));
 const availability=await call(`listings/${item.id}/availability`,undefined,undefined,2);
 assert.deepEqual(availability,{unavailableRanges:[{start:day(4),end:day(5)}]});
 for(const [a,b]of [[4,5],[5,7],[3,6],[4,4]])await call('requests','POST',request(a,b),2,409);
 await call('requests','POST',request(8,10),2);await call('requests','POST',request(6,7),2);
 const first=await db.rentalRequest.findFirst({where:{listingId:item.id,renterId:users[1]}});
 await call(`requests/${first.id}/accept`,'POST',{},0);
 assert.equal((await db.rentalRequest.count({where:{listingId:item.id,status:'Pending'}})),2);
 await call(`requests/${first.id}/pickup`,'POST',{},1);
 assert.ok((await call(`listings/${item.id}/availability`)).unavailableRanges.some(r=>r.start===day(4)));
 await call(`requests/${first.id}/return`,'POST',{},1);
 assert.ok(!(await call(`listings/${item.id}/availability`)).unavailableRanges.some(r=>r.start===day(4)));
 for(const action of ['decline','cancel']){await call('requests','POST',request(4,5),1);const r=await db.rentalRequest.findFirst({where:{listingId:item.id,status:'Pending',renterId:users[1]}});await call(`requests/${r.id}/${action}`,'POST',{},action==='decline'?0:1);assert.ok(!(await call(`listings/${item.id}/availability`)).unavailableRanges.some(r=>r.start===day(4)));}
 await call('requests','POST',request(4,5),1);await db.rentalRequest.updateMany({where:{listingId:item.id,renterId:users[1],status:'Pending'},data:{createdAt:new Date(Date.now()-49*3600000)}});
 assert.ok(!(await call(`listings/${item.id}/availability`)).unavailableRanges.some(r=>r.start===day(4)));
 // Two different students contend for exactly the same dates on the same connection pool.
 const race=await Promise.all([1,2].map(actor=>fetch(base+'/api/requests',{method:'POST',headers:{Origin:process.env.APP_URL||base,'Content-Type':'application/json',Cookie:cookies[actor]},body:JSON.stringify(request(15,17))})));
 assert.deepEqual(race.map(r=>r.status).sort(),[200,409]);
 assert.equal(await db.rentalRequest.count({where:{listingId:item.id,startDate:new Date(day(15)),status:'Pending'}}),1);
 for(const status of ['Requested','Rented Out']){await db.listing.update({where:{id:item.id},data:{status}});assert.ok((await call('listings')).listings.some(l=>l.id===item.id));}
 await db.listing.update({where:{id:item.id},data:{moderationStatus:'Hidden'}});assert.ok(!(await call('listings')).listings.some(l=>l.id===item.id));await call(`listings/${item.id}/availability`,'GET',undefined,2,404);
 console.log('Availability integration passed: visibility, inclusive overlap, independent requests, lifecycle release, expiry, privacy, and concurrent 200/409.');
}finally{
 if(item){const rr=await db.rentalRequest.findMany({where:{listingId:item.id},select:{id:true}});await db.rentalActivity.deleteMany({where:{requestId:{in:rr.map(r=>r.id)}}});await db.rentalRequest.deleteMany({where:{listingId:item.id}});await db.listing.delete({where:{id:item.id}});}
 await db.email.deleteMany({where:{OR:[{to:{startsWith:tag}},{text:{contains:tag}}]}});await db.session.deleteMany({where:{userId:{in:users}}});await db.user.deleteMany({where:{id:{in:users}}});await db.$disconnect();
}
