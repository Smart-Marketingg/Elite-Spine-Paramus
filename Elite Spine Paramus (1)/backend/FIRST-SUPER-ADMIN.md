# First super-admin password (no email needed)

Usually "Forgot password" emails a reset link, but that needs Resend. Until Resend is set up, make the link yourself. It takes about 2 minutes, and the secret part of the link never leaves your computer.

## 1. Run schema.sql
Cloudflare → D1 → **elitespine** → Console → paste all of `schema.sql` → Execute. This creates the 11 tables and the `jullien@smartmarketingg.com` user row. It's safe to run again.

## 2. Make a one-time link in your browser
Open any page (for example `https://www.elitespineparamus.com`), press **F12**, go to the **Console** tab, paste this and press Enter:

```js
(async () => {
  const a = crypto.getRandomValues(new Uint8Array(32));
  const tok = btoa(String.fromCharCode(...a)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  const h = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(tok)))].map(b=>b.toString(16).padStart(2,'0')).join('');
  console.log('1) Run this in D1 Console:\n\n' +
    "INSERT INTO auth_tokens (token_hash, email, kind, expires_at, created_by) VALUES ('" + h +
    "', 'jullien@smartmarketingg.com', 'reset', strftime('%Y-%m-%dT%H:%M:%SZ','now','+2 hours'), 'bootstrap');");
  console.log('2) Then open this link (keep it private):\n\nhttps://www.elitespineparamus.com/admin/#set=' + tok);
})();
```

## 3. Use it
1. Copy the `INSERT INTO auth_tokens …` line it prints, then run it in the D1 Console.
2. Open the printed link. Choose a password of at least 10 characters, without "jullien" in it. You're signed in.

The link works **once** and expires in **2 hours**. The database stores only its SHA-256 hash, so the SQL line is safe to paste into Cloudflare. Don't share the link itself.

## If it doesn't work
- **"This link has expired or was already used"**: run the snippet again for a new link.
- **"This account no longer exists"**: the user row is missing. Run `schema.sql` again.
- **Signed in but no admin menus**: the Worker's `SUPER_ADMINS` variable must include `jullien@smartmarketingg.com`. If it isn't set, that address is the default.

Once Resend is set up (`RESEND_API_KEY` secret), use **Forgot password** and **Invite** normally.
