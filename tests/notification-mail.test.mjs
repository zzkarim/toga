import test from 'node:test';
import assert from 'node:assert/strict';
import {notificationMail, CONTACT_NOTE} from '../lib/notification-mail.mjs';
import {mailContent} from '../lib/mail-provider.mjs';
test('all rental notifications are multipart-ready, linkless, escaped and neutral',()=>{
 for(const kind of ['request','status','pickup','return']){
  const record={id:kind,to:'test@gatech.edu',...notificationMail({kind,name:'Jordan',title:'blazer',status:'Confirmed'})};
  assert.match(record.text,/Open Toga/);assert.ok(record.text.includes(CONTACT_NOTE));
  assert.doesNotMatch(record.text,/https?:|www\.|!|48 hours|urgent/i);
  const mime=mailContent(record);assert.equal(mime.text,record.text);assert.doesNotMatch(mime.html,/<a\b|<img|style=|<button/i);
 }
 assert.equal(notificationMail({kind:'request',name:'Jordan',title:'blazer'}).subject,'Jordan requested blazer on Toga');
 const dirty=notificationMail({kind:'request',name:'A\r\nB!',title:'https://bad.example <script>!'});
 assert.doesNotMatch(dirty.subject,/[\r\n!]|https:/);
 assert.doesNotMatch(mailContent({id:'x',to:'test@gatech.edu',...dirty}).html,/<script>/);
});
