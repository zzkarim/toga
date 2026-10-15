# SendGrid Single Sender setup

1. In the SendGrid dashboard, open **Settings → Sender Authentication**.
2. Under **Single Sender Verification**, select **Verify a Single Sender**.
3. Set **From Name** to **Toga**. Use the email address you own for **From Email Address**, choose a Reply To address you monitor, and fill in all required sender/contact fields with your real details.
4. Click **Create**, open the verification email in that inbox, and follow its verification link. Return to SendGrid and confirm the sender is verified.
5. Go to **Settings → API Keys → Create API Key**. Name it `Toga production`, choose restricted access, and grant **Mail Send** permission. Keep the key private.
6. Put the key in `SENDGRID_API_KEY`. Set `EMAIL_FROM` to the exact verified address (for example, `your-address@example.com`, not `Toga <...>`). Configure both in Vercel Production and your ignored `.env.production.local` file.
7. Redeploy after changing Vercel environment variables. Request a magic link for a real controlled `@gatech.edu` inbox; check SendGrid **Email Activity**, the recipient's inbox/spam folder, and the link itself.

Toga supplies the From Name, uses the v3 Mail Send API, and disables click/open tracking so sign-in URLs are not rewritten. The app's admin email table reports API acceptance, rejection, retry, or an unknown delivery outcome. Acceptance does not prove inbox delivery.

Single Sender Verification does not configure domain-level SPF/DKIM. A sender at a provider with restrictive DMARC can still be blocked or sent to spam. Test the chosen sender with Georgia Tech mail before inviting the waitlist; if it fails, choose an authenticated sending option before launch. This does not require changing the website's default Vercel URL.

Do not paste API keys into chat or commit them. Sender verification and account approval must be completed in your own SendGrid account. Any plan/sending limits still apply; the app does not purchase or upgrade a plan.

Sources: [verify a single sender](https://www.twilio.com/docs/sendgrid/ui/sending-email/sender-verification), [Mail Send API](https://www.twilio.com/docs/sendgrid/api-reference/mail-send/mail-send), [sender identity guidance](https://www.twilio.com/docs/sendgrid/for-developers/sending-email/sender-identity).
