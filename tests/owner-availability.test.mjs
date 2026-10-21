import test from 'node:test';
import assert from 'node:assert/strict';
import { blockedRanges, listingUnavailableRanges, rangeAvailable, selectRentalDate } from '../lib/availability.mjs';
import { needsSupplyPrompt } from '../lib/profile.mjs';
const d=n=>`2026-10-${n}`;
test('single owner block leaves neighbours rentable',()=>{
 const r=listingUnavailableRanges([],blockedRanges([{start:d(31),end:d(31)}]));
 assert.equal(rangeAvailable(d(31),d(31),r),false);
 assert.equal(rangeAvailable(d(30),d(30),r),true);
 assert.equal(rangeAvailable('2026-11-01','2026-11-01',r),true);
 assert.ok(selectRentalDate({},d(31),r).error);
 assert.ok(selectRentalDate(selectRentalDate({},d(29),r),'2026-11-01',r).error,'cannot cross a block');
});
test('ranges, multiple ranges, merge, removal and rental union',()=>{
 const b=blockedRanges([{start:d(31),end:'2026-11-01'},{start:d(24)},{start:d(30),end:d(30)}]);
 assert.deepEqual(b,[{start:d(24),end:d(24)},{start:d(30),end:'2026-11-01'}]);
 for(const day of [d(24),d(30),d(31),'2026-11-01'])assert.equal(rangeAvailable(day,day,b),false);
 assert.equal(rangeAvailable(d(25),d(29),b),true);
 const reopened=b.filter(r=>r.start!==d(24));assert.equal(rangeAvailable(d(24),d(24),reopened),true);
 const u=listingUnavailableRanges([{startDate:new Date(d(20)),endDate:new Date(d(21))}],b);
 assert.equal(rangeAvailable(d(20),d(20),u),false);assert.equal(rangeAvailable(d(24),d(24),u),false);assert.equal(rangeAvailable(d(22),d(23),u),true);
 assert.deepEqual(blockedRanges(undefined),[]);
});
test('invalid owner ranges are rejected',()=>{
 for(const bad of ['x',[{start:'2026-02-30'}],[{start:d(31),end:d(30)}],[{start:'2026-01-01',end:'2027-06-01'}],Array(61).fill({start:d(20)})])assert.throws(()=>blockedRanges(bad));
});
test('supply prompt: once, not for contributors or admins',()=>{
 const u={email:'a@gatech.edu',role:'user',supplyPromptHandledAt:null};
 assert.equal(needsSupplyPrompt(u,0),true);
 assert.equal(needsSupplyPrompt({...u,supplyPromptHandledAt:new Date()},0),false);
 assert.equal(needsSupplyPrompt(u,1),false);
 assert.equal(needsSupplyPrompt({...u,role:'admin'},0),false);
 assert.equal(needsSupplyPrompt({...u,email:'jointoga@gmail.com'},0),false);
 assert.equal(needsSupplyPrompt(null,0),false);
});
