import assert from 'node:assert/strict';
import {PrismaClient} from '@prisma/client';
import {createHash,randomUUID} from 'node:crypto';
import {hashPassword} from '../lib/passwords.mjs';
const base=process.env.TEST_URL || 'http://127.0.0.1:3004';
if (!['127.0.0.1','localhost'].includes(new URL(base).hostname) || !['127.0.0.1','localhost'].includes(new URL(process.env.DATABASE_URL).hostname) || process.env.GMAIL_APP_PASSWORD) throw new Error('Local email-disabled tests only');
const db=new PrismaClient(),prefix=`activity-${randomUUID()}`, ids=[`${prefix}-owner`,`${prefix}-renter`,`${prefix}-other`],password='Local activity test password 123';
let listingId;
async function call(route,{cookie='',method='GET',body}={}){
 const response=await fetch(base+'/api/'+route,{method,headers:{Origin:base,'Content-Type':'application/json',Cookie:cookie},body:body===undefined?undefined:JSON.stringify(body)});
 const data=await response.json();return {response,data};
}
async function login(id){const {response,data}=await call('auth/password-login',{method:'POST',body:{email:`${id}@gatech.edu`,password}});assert.equal(response.status,200,JSON.stringify(data));const header=response.headers.get('set-cookie');assert.match(header,/Max-Age=2592000/i);assert.match(header,/HttpOnly/i);assert.match(header,/SameSite=lax/i);return header.split(';')[0];}
const request=(cookie,route,body)=>call(route,{cookie,method:'POST',body});
try{
 const passwordHash=await hashPassword(password);
 for(const id of ids)await db.user.create({data:{id,email:`${id}@gatech.edu`,name:'Local activity check',phone:'4045550100',passwordHash}});
 let owner=await login(ids[0]);const renter=await login(ids[1]),other=await login(ids[2]);
 const sessionId=createHash('sha256').update(owner.split('=')[1]).digest('hex');
 let session=await db.session.findUnique({where:{id:sessionId}});assert.ok(Math.abs(+session.expiresAt-Date.now()-30*86400000)<10000);
 await db.session.update({where:{id:sessionId},data:{expiresAt:new Date(Date.now()+28*86400000)}});
 const renewal=await call('me',{cookie:owner});assert.equal(renewal.data.user.id,ids[0]);assert.match(renewal.response.headers.get('set-cookie'),/Max-Age=2592000/i);
 session=await db.session.findUnique({where:{id:sessionId}});assert.ok(+session.expiresAt>Date.now()+29.99*86400000);
 await db.session.update({where:{id:sessionId},data:{expiresAt:new Date(Date.now()-1000)}});
 assert.equal((await call('me',{cookie:owner})).data.user,null);owner=await login(ids[0]);
 const listing=await db.listing.create({data:{ownerId:ids[0],title:'Local notification check',description:'Temporary local check',category:'Formal',size:'M',condition:'Good',retailValue:50,price:5,photos:'[]'}});listingId=listing.id;
 const startDate=new Date(Date.now()+2*86400000).toISOString().slice(0,10),endDate=new Date(Date.now()+3*86400000).toISOString().slice(0,10);
 assert.equal((await request(renter,'requests',{listingId,startDate,endDate})).response.status,200);
 const rental=await db.rentalRequest.findFirst({where:{listingId}});
 const pending=(await call('activity',{cookie:owner})).data;assert.equal(pending.unreadCount,1);assert.match(pending.items[0].message,/New request/);
 assert.equal((await call('activity',{cookie:other})).data.unreadCount,0);
 await request(other,'activity/read',{ids:[pending.items[0].id]});assert.equal((await call('activity',{cookie:owner})).data.unreadCount,1);
 assert.equal((await request(owner,`requests/${rental.id}/accept`,{})).response.status,200);
 assert.equal((await call('activity',{cookie:renter})).data.unreadCount,1);
 assert.equal((await request(renter,`requests/${rental.id}/pickup`,{})).response.status,200);
 await request(owner,'activity/read',{ids:[pending.items[0].id]});
 const changed=(await call('activity',{cookie:owner})).data;assert.equal(changed.unreadCount,1);assert.match(changed.items[0].message,/Active Rental/);
 const otherDevice=await login(ids[0]);assert.equal((await call('activity',{cookie:otherDevice})).data.unreadCount,1);
 await request(renter,`requests/${rental.id}/return`,{});assert.equal((await call('activity',{cookie:owner})).data.unreadCount,2);
 await db.rentalRequest.create({data:{listingId,renterId:ids[1],lenderId:ids[0],startDate:new Date(startDate),endDate:new Date(endDate),createdAt:new Date(Date.now()-49*3600000)}});
 await call('requests',{cookie:owner});assert.ok((await call('activity',{cookie:owner})).data.items.some(x=>/expired/.test(x.message)));
 assert.equal((await call('activity')).response.status,401);
 await request(owner,'auth/logout',{});assert.equal((await call('me',{cookie:owner})).data.user,null);
 console.log('PASS: 30-day session creation/renewal, expiry/logout; incoming/status/expiry activity; cross-user isolation; cross-device unread persistence; marking displayed IDs preserves newer updates.');
}finally{
 await db.email.deleteMany({where:{to:{in:ids.map(id=>`${id}@gatech.edu`)}}});
 if(listingId){await db.rentalRequest.deleteMany({where:{listingId}});await db.listing.deleteMany({where:{id:listingId}});}
 await db.user.deleteMany({where:{id:{in:ids}}});await db.$disconnect();console.log('Local fixtures removed.');
}
