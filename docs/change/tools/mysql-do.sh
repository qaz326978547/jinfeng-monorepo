#!/usr/bin/env bash
# mysql-do.sh — mysql 8.4 client (Docker) against a DigitalOcean cluster with full TLS verification.
#
#   docs/change/tools/mysql-do.sh <cnf> <ca-file> [mysql args...]   (stdin is passed through)
#
# The cnf and CA are mounted read-only. --ssl-ca must point at the in-container path: the macOS path
# written in the cnf does not exist inside the container (fails with
# "SSL_CTX_set_default_verify_paths failed").
set -euo pipefail
if [[ $# -lt 2 ]]; then
  echo "usage: $0 <cnf> <ca-file> [mysql args...]" >&2
  exit 2
fi
CNF=$1 CA=$2
shift 2
exec docker run --rm -i \
  -v "$CNF:/c.cnf:ro" -v "$CA:/ca.crt:ro" \
  mysql:8.4 mysql --defaults-extra-file=/c.cnf --ssl-ca=/ca.crt --ssl-mode=VERIFY_IDENTITY "$@" \
  2> >(grep -v 'Using a password on the command line' >&2)
