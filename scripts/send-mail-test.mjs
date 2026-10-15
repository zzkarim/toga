import {sendMailMessage,emailConfigured} from '../lib/mail-provider.mjs';
import {randomUUID} from 'node:crypto';
const to=process.argv[2];
if (!/^[a-z0-9._%+-]+@gatech\.edu$/i.test(to || '') || !emailConfigured()) throw new Error('Configure Gmail and provide an authorized @gatech.edu test recipient.');
const reference=randomUUID().slice(0,8);
const result=await sendMailMessage({id:`delivery-test-${reference}`,to,subject:`Toga email delivery test ${reference}`,text:`This is the Toga email delivery test you requested.\n\nReference: ${reference}\n\nThis message does not sign you in or create a rental. Please check whether Outlook placed it in Inbox or Junk.\n\nToga\nPeer-to-peer clothing rentals for Georgia Tech students.`});
console.log(JSON.stringify({reference,status:result.deliveryStatus,messageId:result.providerMessageId || null,error:result.error || null}));
if (result.deliveryStatus !== 'Accepted') process.exitCode=1;
else console.log('Accepted by Gmail SMTP only. Inbox/Junk placement still requires checking the recipient mailbox.');
