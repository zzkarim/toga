import test from 'node:test';
import assert from 'node:assert/strict';
import { rentalBlocksAvailability, rangeAvailable, selectRentalDate, blockingWhere } from '../lib/availability.mjs';
import { rentalTotal } from '../lib/browse.mjs';
test('only live rental states block availability',()=>{
 for(const s of ['Pending','Confirmed','Active Rental']) assert.equal(rentalBlocksAvailability(s),true);
 for(const s of ['Declined','Cancelled','Expired','Completed']) assert.equal(rentalBlocksAvailability(s),false);
 assert.equal(blockingWhere(new Date('2026-10-25T12:00Z')).OR[1].createdAt.gte.toISOString(),'2026-10-23T12:00:00.000Z');
});
test('inclusive overlap includes endpoints, enclosed and enclosing intervals but allows next day',()=>{
 const r=[{start:'2026-10-23',end:'2026-10-24'}];
 for(const [a,b] of [['23','24'],['24','26'],['22','25'],['23','23']]) assert.equal(rangeAvailable('2026-10-'+a,'2026-10-'+b,r),false);
 for(const [a,b] of [['21','22'],['25','25'],['27','29']]) assert.equal(rangeAvailable('2026-10-'+a,'2026-10-'+b,r),true);
 assert.equal(rangeAvailable('2026-10-23','2026-10-24',[{start:'2026-10-22',end:'2026-10-26'}]),false);
});
test('single click is one day; second click extends; next click restarts',()=>{
 let s=selectRentalDate({},'2026-10-23');assert.equal(s.end,s.start);assert.equal(rentalTotal(10,s.start,s.end).total,10);
 s=selectRentalDate(s,'2026-10-25');assert.equal(s.end,'2026-10-25');assert.equal(rentalTotal(10,s.start,s.end).days,3);
 s=selectRentalDate(s,'2026-10-28');assert.equal(s.start,s.end);assert.equal(s.start,'2026-10-28');
});
test('range picker rejects blocked days and crossing ranges without altering selection',()=>{
 const r=[{start:'2026-10-23',end:'2026-10-24'}];let s=selectRentalDate({},'2026-10-22',r);
 for(const day of ['2026-10-23','2026-10-25']) {const next=selectRentalDate(s,day,r);assert.ok(next.error);assert.equal(next.end,s.end);}
 assert.ok(selectRentalDate(s,'2026-12-01').error);
});
