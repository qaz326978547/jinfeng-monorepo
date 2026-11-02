#!/usr/bin/env bash
# new-app-cnf.sh — write a chmod-600 option file for a least-privilege backend account, with a random
# 32-character password that is never printed. Host / port / ssl-ca are copied from the admin file.
#
#   docs/change/tools/new-app-cnf.sh <admin-cnf> <out-cnf> <app-user> <database>
#
# Then create the account with create-app-user.ts (it reads the password from <out-cnf>).
set -euo pipefail
umask 077

if [[ $# -ne 4 ]]; then
  echo "usage: $0 <admin-cnf> <out-cnf> <app-user> <database>" >&2
  exit 2
fi
ADMIN=$1 OUT=$2 APP_USER=$3 DB=$4
[[ -f "$ADMIN" ]] || { echo "admin cnf not found: $ADMIN" >&2; exit 2; }
[[ -e "$OUT" ]] && { echo "refusing to overwrite: $OUT" >&2; exit 2; }
[[ "$APP_USER" =~ ^[A-Za-z0-9_]{3,32}$ ]] || { echo "app user must be 3-32 chars [A-Za-z0-9_]" >&2; exit 2; }
[[ "$DB" =~ ^[A-Za-z0-9_]{1,64}$ ]] || { echo "database name must be [A-Za-z0-9_]" >&2; exit 2; }

PW=$(openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | head -c 32)
{
  echo "# Backend account for ${DB}: SELECT / INSERT / UPDATE / DELETE only."
  echo "# chmod 600, keep in ~/secure, never commit."
  echo "[client]"
  grep -E '^(host|port|ssl-ca)=' "$ADMIN"
  echo "user=${APP_USER}"
  echo "password=${PW}"
  echo "database=${DB}"
  echo "ssl-mode=VERIFY_IDENTITY"
} > "$OUT"
unset PW
chmod 600 "$OUT"
echo "wrote $OUT (600) for ${APP_USER}@${DB}; password not shown"
