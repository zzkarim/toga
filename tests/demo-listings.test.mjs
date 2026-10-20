import test from 'node:test';
import assert from 'node:assert/strict';
import {DEMO_IDS,demoRanges,demoBrowseWhere,HALLOWEEN_EXAMPLES} from '../lib/demo-listings.mjs';
import {rangeAvailable} from '../lib/availability.mjs';
test('only six curated admin examples are added to otherwise unchanged browse',()=>{
 assert.equal(new Set(DEMO_IDS).size,6);assert.deepEqual(demoBrowseWhere.OR[0],{isDemo:false});assert.equal(demoBrowseWhere.OR[1].owner.email,'jointoga@gmail.com');assert.deepEqual(demoBrowseWhere.OR[1].id.in,DEMO_IDS);
 for(const item of HALLOWEEN_EXAMPLES) assert.ok(item.price>=5&&item.price<=12);
});
test('demo dates are inclusive and never change real listing availability',()=>{
 for(const id of DEMO_IDS){assert.deepEqual(demoRanges({id,isDemo:false}),[]);const ranges=demoRanges({id,isDemo:true});assert.equal(rangeAvailable('2026-10-29','2026-11-01',ranges),false);assert.equal(rangeAvailable('2026-11-02','2026-11-02',ranges),true);}
 assert.deepEqual(demoRanges({id:'other',isDemo:true}),[]);
});
