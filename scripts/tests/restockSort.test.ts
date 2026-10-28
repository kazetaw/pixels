import assert from 'node:assert/strict';
import {test} from 'node:test';
import {sortRestockProducts,defaultRestockSort} from '../../frontend/src/components/Store/restockSort';
const products=[{item_id:'z',name:'Zinc',stock:0},{item_id:'t2',name:'ข้าว',stock:5},{item_id:'a10',name:'Apple 10',stock:8},{item_id:'t1',name:'กาว',stock:0},{item_id:'a2',name:'Apple 2',stock:5}];
test('defaults to Latin A-Z then Thai ก-ฮ with natural numbers without mutating source',()=>{
 assert.deepEqual(sortRestockProducts(products,defaultRestockSort,{}).map(p=>p.item_id),['a2','a10','z','t1','t2']);assert.equal(products[0].item_id,'z');
});
test('sorts empty/available first, with alphabetical ties in both directions',()=>{
 assert.deepEqual(sortRestockProducts(products,{key:'status',order:'ascend'},{}).map(p=>p.item_id),['z','t1','a2','a10','t2']);
 assert.deepEqual(sortRestockProducts(products,{key:'status',order:'descend'},{}).map(p=>p.item_id),['a2','a10','t2','z','t1']);
});
test('sorts stock and entered amounts numerically and preserves quantity association',()=>{
 assert.equal(sortRestockProducts(products,{key:'stock',order:'descend'}, {})[0].item_id,'a10');
 const qty={t1:50,z:3};assert.equal(sortRestockProducts(products,{key:'qty',order:'descend'},qty)[0].item_id,'t1');assert.deepEqual(qty,{t1:50,z:3});
 assert.deepEqual(sortRestockProducts(products,{key:'name',order:'descend'},{}).map(p=>p.item_id),['t2','t1','z','a10','a2']);
});
