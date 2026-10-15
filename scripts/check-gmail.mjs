import {gmailTransport,emailConfigured} from '../lib/mail-provider.mjs';
if (!emailConfigured()) { console.error('Gmail is not configured. Run the local secrets script first.');process.exitCode=1; }
else {
 const transport=gmailTransport();
 try {await transport.verify();console.log('Gmail SMTP authentication and TLS connection succeeded. No email sent.');}
 catch {console.error('Gmail SMTP verification failed. Confirm 2-Step Verification, the App Password, and any Google security alert. No credentials were printed.');process.exitCode=1;}
 finally{transport.close();}
}
