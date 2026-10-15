"""Collect deployment secrets locally without echoing them or using shell history."""
from getpass import getpass
from pathlib import Path
from urllib.parse import quote, urlsplit, urlunsplit
import os
import re
import sys

root = Path(__file__).resolve().parent.parent
target = root / ".env.production.local"
if not target.exists():
    raise SystemExit("Create .env.production.local from the production example first.")

content = target.read_text()

def read_value(name):
    match = re.search(rf'^{name}="([^"\n]*)"$', content, re.MULTILINE)
    if not match:
        raise SystemExit(f"Missing quoted {name} setting; no changes saved.")
    return match.group(1)

print("Enter secrets here, not in chat. Input is hidden. Press Enter to keep an existing value.")
gmail_only = "--gmail-only" in sys.argv
password = "" if gmail_only else getpass("Supabase database password: ")
storage_key = "" if gmail_only else getpass("Supabase service_role key (not the anon/publishable key): ")
mail_key = getpass("Gmail App Password for jointoga@gmail.com (16 characters): ").replace(" ", "")
updates = {}
if mail_key:
    if not re.fullmatch(r"[A-Za-z]{16}", mail_key):
        raise SystemExit("Expected the 16-letter Gmail App Password, not your Google account password. No changes saved.")
    updates.update(EMAIL_PROVIDER="gmail", GMAIL_USER="jointoga@gmail.com", EMAIL_FROM="jointoga@gmail.com", GMAIL_APP_PASSWORD=mail_key)
if password:
    for name in ("DATABASE_URL", "DIRECT_URL"):
        url = urlsplit(read_value(name))
        if not url.username or not url.hostname or url.scheme not in ("postgres", "postgresql"):
            raise SystemExit(f"Invalid {name}; no changes saved.")
        host = url.hostname
        if ":" in host:
            host = f"[{host}]"
        port = f":{url.port}" if url.port else ""
        netloc = f"{url.username}:{quote(password, safe='')}@{host}{port}"
        updates[name] = urlunsplit(url._replace(netloc=netloc))
for name, value in (("SUPABASE_SERVICE_ROLE_KEY", storage_key),):
    if value:
        if any(c.isspace() for c in value) or any(c in value for c in '\"\'\\'):
            raise SystemExit(f"Unexpected characters in {name}; no changes saved.")
        read_value(name)
        updates[name] = value
for name, value in updates.items():
    if re.search(rf'^{name}=', content, re.MULTILINE):
        content = re.sub(rf'^{name}=.*$', lambda _: f'{name}="{value}"', content, flags=re.MULTILINE)
    else:
        content += f'\n{name}="{value}"\n' 
if updates:
    temporary = target.with_name(target.name + ".tmp")
    fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "w") as handle:
        handle.write(content)
    os.replace(temporary, target)
    print("Saved privately to .env.production.local. No secrets were printed or uploaded.")
else:
    print("No changes made.")
