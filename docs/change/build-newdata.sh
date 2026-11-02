#!/usr/bin/env bash
# build-newdata.sh — 從 Zeabur 備份產生 DigitalOcean 用的 NewData.sql
#
# 用法：
#   docs/change/build-newdata.sh <Zeabur 備份 data.sql> <輸出 NewData.sql>
#
# 做的事（全部在一次性的本機 Docker 容器裡，不連任何遠端資料庫）：
#   1. mysql:8.0.33（與 Zeabur 同版本）還原備份
#   2. 刪除空資料庫 AppClass 與 18 張舊 Laravel 表
#   3. 6 張 MyISAM 表轉 InnoDB
#   4. 確認剩下 10 張表、全部 InnoDB、都有主鍵，否則中止
#   5. mysqldump 匯出，加上檔頭
#   6. 印出 10 張表的筆數／最大 id／AUTO_INCREMENT，供和來源、DigitalOcean 核對
#
# 需求：docker。輸入與輸出檔都含正式個資，請放在 repo 以外的受控位置。
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "usage: $0 <zeabur-backup.sql> <output NewData.sql>" >&2
  exit 2
fi
INPUT=$1
OUTPUT=$2
[[ -f "$INPUT" ]] || { echo "input not found: $INPUT" >&2; exit 2; }
[[ -e "$OUTPUT" ]] && { echo "output already exists, refusing to overwrite: $OUTPUT" >&2; exit 2; }

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
NAME="build-newdata-$$"
PW="local_build_only"

cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT

sql() { docker exec -i "$NAME" mysql -uroot -p"$PW" "$@" 2>/dev/null; }

echo "[1/6] starting mysql:8.0.33 ($NAME)"
docker run -d --name "$NAME" -e MYSQL_ROOT_PASSWORD="$PW" mysql:8.0.33 >/dev/null
for _ in $(seq 1 60); do
  sql -e 'SELECT 1' >/dev/null && break
  sleep 2
done
sql -e 'SELECT 1' >/dev/null || { echo "mysql did not start" >&2; exit 1; }

echo "[2/6] restoring $INPUT"
sql < "$INPUT"
sql -N -e "SELECT 1 FROM information_schema.schemata WHERE schema_name='zeabur'" | grep -q 1 \
  || { echo "backup does not contain schema 'zeabur'" >&2; exit 1; }

echo "[3/6] dropping legacy tables, converting to InnoDB"
sql zeabur <<'EOF'
DROP DATABASE IF EXISTS `AppClass`;
DROP TABLE IF EXISTS `admin`, `browse`, `browse_record`, `contact_img`, `faq_class`, `jobs`,
  `migrations`, `oauth_access_tokens`, `oauth_auth_codes`, `oauth_clients`,
  `oauth_personal_access_clients`, `oauth_refresh_tokens`, `page`, `page_files`, `page_pics`,
  `password_resets`, `seo_class`, `simple_setting`;
ALTER TABLE `contact`       ENGINE = InnoDB;
ALTER TABLE `contact_class` ENGINE = InnoDB;
ALTER TABLE `contact_list`  ENGINE = InnoDB;
ALTER TABLE `contact_quest` ENGINE = InnoDB;
ALTER TABLE `faq`           ENGINE = InnoDB;
ALTER TABLE `seo`           ENGINE = InnoDB;
EOF

echo "[4/6] checking result"
EXPECTED="carousel,consultations,contact,contact_class,contact_list,contact_quest,faq,node_schema_migrations,seo,users"
ACTUAL=$(sql -N -e "SELECT GROUP_CONCAT(table_name ORDER BY table_name) FROM information_schema.tables WHERE table_schema='zeabur'")
[[ "$ACTUAL" == "$EXPECTED" ]] || { echo "unexpected tables: $ACTUAL" >&2; exit 1; }
NON_INNODB=$(sql -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='zeabur' AND engine<>'InnoDB'")
[[ "$NON_INNODB" == 0 ]] || { echo "$NON_INNODB table(s) are not InnoDB" >&2; exit 1; }
NO_PK=$(sql -N -e "SELECT COUNT(*) FROM information_schema.tables t LEFT JOIN information_schema.table_constraints k ON k.table_schema=t.table_schema AND k.table_name=t.table_name AND k.constraint_type='PRIMARY KEY' WHERE t.table_schema='zeabur' AND k.constraint_name IS NULL")
[[ "$NO_PK" == 0 ]] || { echo "$NO_PK table(s) have no primary key" >&2; exit 1; }

echo "[5/6] dumping to $OUTPUT"
SOURCE_DONE=$(grep -m1 -oE 'Dump completed on .*' "$INPUT" || echo 'Dump completed on (unknown)')
{
  cat <<EOF
-- NewData.sql
--
-- 來源：$(basename "$INPUT")（Zeabur 備份，${SOURCE_DONE#Dump completed on } UTC，MySQL 8.0.33，schema \`zeabur\`）
-- 由 docs/change/build-newdata.sh 產生，產生時間 $(date -u '+%Y-%m-%d %H:%M:%S') UTC。在本機 Docker mysql:8.0.33 還原後
--   1. 刪除舊 Laravel 專用、新版 Node backend 沒有使用的 18 張表與空資料庫 \`AppClass\`
--   2. 剩下 10 張表的 6 張 MyISAM 轉成 InnoDB（欄位、索引、資料、AUTO_INCREMENT 都不變）
--   3. 用 mysqldump --single-transaction --set-gtid-purged=OFF --no-tablespaces 重新匯出
-- 說明見 docs/change/NewData報告.md
--
-- 這個檔案沒有 CREATE DATABASE / USE，匯入時自己指定目標資料庫，例如：
--   mysql --defaults-extra-file=~/secure/do.cnf <目標資料庫> < NewData.sql
-- 目標資料庫名稱要和 backend 的 DB_DATABASE 一致。
-- 檔案內含 DROP TABLE IF EXISTS，請只匯入到空的、新建的資料庫。
--
-- ⚠️ 內含正式個資（報名者姓名／電話／Email、諮詢者統編／LINE ID）與後台密碼 hash，不可 commit。

EOF
  docker exec "$NAME" mysqldump -uroot -p"$PW" --single-transaction --set-gtid-purged=OFF \
    --no-tablespaces --skip-dump-date --hex-blob zeabur 2>/dev/null
} > "$OUTPUT"
grep -q 'ENGINE=MyISAM' "$OUTPUT" && { echo "output still contains MyISAM" >&2; exit 1; }

echo "[6/6] reconciliation (compare with reconcile-counts.sql on Zeabur and DigitalOcean)"
sql -t zeabur < "$SCRIPT_DIR/reconcile-counts.sql"
shasum -a 256 "$OUTPUT"
echo "done"
