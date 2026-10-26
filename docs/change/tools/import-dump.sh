#!/usr/bin/env bash
# import-dump.sh — import NewData.sql into a DigitalOcean database, only if it is the expected,
# EMPTY database. Stops (exit 3) on any doubt; never overwrites.
#
#   docs/change/tools/import-dump.sh <admin-cnf> <ca-file> <expected-db> <dump.sql>
set -euo pipefail
if [[ $# -ne 4 ]]; then
  echo "usage: $0 <admin-cnf> <ca-file> <expected-db> <dump.sql>" >&2
  exit 2
fi
CNF=$1 CA=$2 EXPECT=$3 DUMP=$4
HERE=$(cd "$(dirname "$0")" && pwd)
[[ -f "$DUMP" ]] || { echo "dump not found: $DUMP" >&2; exit 2; }

DB=$("$HERE/mysql-do.sh" "$CNF" "$CA" -N -e 'SELECT DATABASE()' || true)
TABLES=$("$HERE/mysql-do.sh" "$CNF" "$CA" -N -e \
  "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()" || true)
echo "target database=${DB:-?} tables=${TABLES:-?}"
if [[ "$DB" != "$EXPECT" || "$TABLES" != "0" ]]; then
  echo "STOP: target is not the empty database '$EXPECT' — nothing imported" >&2
  exit 3
fi

start=$(date +%s)
"$HERE/mysql-do.sh" "$CNF" "$CA" < "$DUMP"
echo "imported in $(( $(date +%s) - start ))s"
"$HERE/mysql-do.sh" "$CNF" "$CA" -N -e \
  "SELECT COUNT(*), GROUP_CONCAT(DISTINCT ENGINE) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()"
