import {PrismaClient} from '@prisma/client';
import {createHash,randomBytes} from 'node:crypto';
import assert from 'node:assert/strict';
if(process.env.APP_URL!=='https://toga-ecru.vercel.app' || !process.argv.includes('--allow-hosted-check')) throw new Error('Explicit hosted session check required');
const db=new PrismaClient(),id=`session-check-${randomBytes(12).toString('hex')}`,token=randomBytes(32).toString('hex'),sessionId=createHash('sha256').update(token).digest('hex');
const headers={Cookie:`toga_session=${token}`,Origin:process.env.APP_URL,'Content-Type':'application/json'};
try{
 await db.user.create({data:{id,email:`${id}@gatech.edu`,name:'Temporary session check'}});
 await db.session.create({data:{id:sessionId,userId:id,expiresAt:new Date(Date.now()+28*86400000)}});
 const renewed=await fetch(process.env.APP_URL+'/api/me',{headers});assert.equal(renewed.status,200);assert.equal((await renewed.json()).user.id,id);
 const cookie=renewed.headers.get('set-cookie');assert.match(cookie,/Max-Age=2592000/i);assert.match(cookie,/HttpOnly/i);assert.match(cookie,/Secure/i);assert.match(cookie,/SameSite=lax/i);
 const session=await db.session.findUnique({where:{id:sessionId}});assert.ok(+session.expiresAt>Date.now()+29.99*86400000);
 // A new HTTP request with the same persisted cookie needs no new email or login.
 assert.equal((await (await fetch(process.env.APP_URL+'/api/me',{headers})).json()).user.id,id);
 await db.session.update({where:{id:sessionId},data:{expiresAt:new Date(Date.now()-1000)}});
 assert.equal((await (await fetch(process.env.APP_URL+'/api/me',{headers})).json()).user,null);
 await db.session.update({where:{id:sessionId},data:{expiresAt:new Date(Date.now()+30*86400000)}});
 assert.equal((await fetch(process.env.APP_URL+'/api/auth/logout',{method:'POST',headers,body:'{}'})).status,200);
 assert.equal((await (await fetch(process.env.APP_URL+'/api/me',{headers})).json()).user,null);
 console.log('PASS: live persistent cookie, Secure/HttpOnly/SameSite, rolling 30-day renewal, expiration and logout; no emails sent.');
}finally{await db.user.deleteMany({where:{id}});await db.$disconnect();console.log('Temporary hosted session test records removed.');}
