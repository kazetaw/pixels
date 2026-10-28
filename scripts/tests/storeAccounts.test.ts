import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateAccount, accountKey } from '../../api/lib/storeAccounts';
const account=()=>({email:' Example@Gmail.com ',characters:Array.from({length:3},(_,i)=>({name:`STW0${i+1}`,id:`18823${i+4}`,category:'คราฟ',items:[' ไม้ ','หิน','ไม้'],avatar:i,image_url:null}))});
test('normalizes Gmail and item tags while preserving string IDs',()=>{
 const result=validateAccount(account());assert.equal(result.email,'example@gmail.com');assert.deepEqual(result.characters[0].items,['ไม้','หิน']);assert.equal(result.characters[0].id,'188234');
 assert.equal(accountKey(' EXAMPLE@gmail.com '),accountKey('example@gmail.com'));
});
test('requires three fully specified distinct characters',()=>{
 const a=account();a.characters.pop();assert.throws(()=>validateAccount(a));
 const b=account();b.characters[1].id=b.characters[0].id;assert.throws(()=>validateAccount(b));
 const c=account();c.characters[2].items=[];assert.throws(()=>validateAccount(c));
 assert.throws(()=>validateAccount(null));
});
test('rejects invalid Gmail, avatar, category and image URL',()=>{
 for(const patch of [{avatar:6},{category:'other'},{image_url:'javascript:alert(1)'},{items:[' ']},{name:''}]) {
 const a=account();Object.assign(a.characters[0],patch);assert.throws(()=>validateAccount(a));
 }
 const a=account();a.email='person@other.test';assert.throws(()=>validateAccount(a));
});
