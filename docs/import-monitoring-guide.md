# Import Campaign Monitoring Guide

Quick reference for monitoring/managing comix.to import campaign on server.

## SSH Access

```bash
ssh root@178.105.3.58
cd /var/www/comichub
```

## Start/Stop Import

```bash
# Start campaign (orchestrated batches with cooldown + Telegram alerts)
nohup ./deploy/import-campaign.sh phase1 > /var/log/comichub/campaign-$(date +%Y%m%d).log 2>&1 &

# Start single batch manually
./deploy/run-import.sh comix --from 1 --to 5 --resume --checkpoint-file /data/comix-checkpoint.json

# Stop running import container
docker ps --format "{{.Names}} {{.Status}}" | grep -v zetsu   # find container name
docker stop <container_name>

# Stop campaign (if running via nohup)
pkill -f import-campaign.sh
```

### Multi-Shard Safety

The campaign orchestrator spawns parallel shards (one per proxy endpoint, configured via `PARALLEL_SHARDS`). Each shard processes disjoint page ranges independently. Concurrent shards use advisory database locks (`withSourceLock`) to prevent duplicate manga processing if list order shifts during import — safe to run multiple shards simultaneously.

## Live Monitoring

```bash
# Tail logs of running import container
docker logs -f $(docker ps --format "{{.Names}}" | grep -v zetsu | head -1)

# Last N lines only
docker logs --tail=30 <container_name>

# Campaign log (if started via nohup)
tail -f /var/log/comichub/campaign-*.log
```

## DB Progress Stats

```bash
# Quick progress summary
./deploy/import-progress.sh

# Manual DB queries
docker exec zetsu-postgres-1 psql -U comichub -d comichub -c "
  SELECT COUNT(*) AS manga FROM manga;
  SELECT COUNT(*) AS chapters FROM chapters;
  SELECT COUNT(*) AS images FROM chapter_images;
  SELECT pg_size_pretty(pg_database_size('comichub')) AS db_size;
"

# Comix-sourced manga only
docker exec zetsu-postgres-1 psql -U comichub -d comichub -c "
  SELECT COUNT(*) FROM manga_sources WHERE source='comix';
"

# Recent imports (last 10)
docker exec zetsu-postgres-1 psql -U comichub -d comichub -c "
  SELECT m.id, m.title, ms.last_synced_at
  FROM manga m JOIN manga_sources ms ON ms.manga_id = m.id
  WHERE ms.source='comix'
  ORDER BY ms.last_synced_at DESC LIMIT 10;
"
```

## Server Health

```bash
# Disk usage (alert at 85%)
df -h /

# Memory
free -h

# Running containers
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Container resource usage
docker stats --no-stream
```

## Checkpoint Management

```bash
# View checkpoint (tracks resume position)
cat /data/comix/comix-checkpoint.json

# Campaign progress (tracks which batch/phase completed)
cat /data/comix/campaign-progress.json

# Reset checkpoint (re-import from scratch — data deduped via manga_sources)
rm /data/comix/comix-checkpoint.json
```

## Proxy & Fetch Config

Env vars in `deploy/.env.deploy`:

| Var | Effect |
|-----|--------|
| `USE_PROXY=1` | Route fetches through rotation proxy |
| `PROXY_URL=http://user:pass@ip:port` | Proxy address |
| `USE_SCRAPFLY=1` | Route through Scrapfly (backup) |
| `SCRAPFLY_KEY=...` | Scrapfly API key |

Priority: `USE_PROXY` > `USE_SCRAPFLY` > direct fetch.

```bash
# Toggle proxy on/off (edit .env.deploy)
vim deploy/.env.deploy

# Verify current setting
grep -E "PROXY|SCRAPFLY" deploy/.env.deploy
```

## Troubleshooting

### Import hangs / no progress
```bash
# Check container is still running
docker ps | grep -v zetsu

# Check for errors in logs
docker logs <container> 2>&1 | grep -i "fail\|error\|blocked" | tail -20
```

### 403/429 errors (IP blocked)
```bash
# Check error count in logs
docker logs <container> 2>&1 | grep -c "API 403\|API 429"

# Switch to proxy
# Edit deploy/.env.deploy: USE_PROXY=1
# Restart import
```

### Health check failed (exit code 2)
Signing module may have changed. Re-run to auto-refresh JS chunk cache:
```bash
./deploy/run-import.sh comix --from 1 --to 1 --resume --checkpoint-file /data/comix-checkpoint.json
```

### DB slow during import
```bash
# Run vacuum (safe during import — non-blocking)
docker exec zetsu-postgres-1 psql -U comichub -d comichub -c "VACUUM ANALYZE;"

# Check active queries
docker exec zetsu-postgres-1 psql -U comichub -d comichub -c "
  SELECT pid, now()-query_start AS duration, query
  FROM pg_stat_activity WHERE state='active' ORDER BY duration DESC LIMIT 5;
"
```

## Telegram Alerts

Campaign orchestrator auto-sends alerts for:
- Batch start/complete with stats
- Health check failures
- Consecutive failures (auto-stops at 3)
- Disk usage warnings (>70%) and critical (>85%)

Manual alert:
```bash
./deploy/telegram-notify.sh "Your message here"
```

## Log Symbols

| Symbol | Meaning |
|--------|---------|
| `→` | New manga imported |
| `↻` | Existing manga updated (resume) |
| `FAIL` | Single manga/chapter failed (non-fatal) |
| `PROXY` | Proxy mode active |
| `SCRAPFLY` | Scrapfly mode active |
