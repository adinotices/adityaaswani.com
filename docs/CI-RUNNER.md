# CI runner: ci-runner-1

All CI for this repo runs on self-hosted runners (GitHub Actions no-spend rule: never `ubuntu-latest`). This repo's runner is `gcp-adityaaswani.com`, labels `[self-hosted, linux, gcp]`. It lives on **ci-runner-1**, one GCP VM (e2-standard-4, 96 GB root disk) that also hosts the runners of samvara-product (two), amberhall, pausepal and sutam: six runners, jobs from all of them run at the same time and share the CPU and the disk.

## Why there is housekeeping

On 2026-11-01/02 the root disk reached 100 % (`/var/lib/docker` 62 GB): about 700 orphaned Docker volumes left by Postgres service containers that CI removed without `-v`. Every runner went offline for about 16 h, until a manual prune brought it from 96 to 32 GB used (2026-11-02 08:02 UTC). The leak itself is being fixed per repo (amberhall #252, samvara #226, tala #39: tmpfs for test Postgres). `.github/workflows/runner-housekeeping.yml` is the safety net.

## Schedule

| Job | When (UTC) | What |
|---|---|---|
| `disk-gauge` | daily 05:00 | `df -h /`; fails when `/` is above 80 %. No pruning. |
| `prune` | Sunday 05:30 (before the 06:00 Sunday audits) | Prints `df -h /` and `docker system df`, then removes stopped containers older than 1 h, anonymous volumes no container references, dangling images older than 1 h and build cache beyond 10 GB; prints the usage again and fails when `/` is still above 80 %. |

A manual run (Actions → Runner housekeeping → Run workflow) does both. Only stopped, unreferenced or dangling resources are removed: Docker will not prune a running container, a volume any container (running or stopped) still references, or an image a container uses, so jobs from other repos running at the same time are untouched. Tagged images and named volumes are never removed (no `-a`). Commands use `sudo -n`, so if passwordless sudo for the `ci` user ever goes away the step fails straight away instead of hanging. Do not edit sudoers from a workflow.

GitHub emails scheduled-workflow failures to the person who last changed the `cron:` lines in the workflow. The failure annotation names the percentage (`ci-runner-1 disk 84%`). GitHub turns off scheduled workflows after 60 days with no repo activity; if the gauge goes quiet, check that it is still enabled.

If the disk is already full, the runners are offline and neither job can start (a queued self-hosted job waits up to 24 h, then fails). A gauge that never reports is a warning sign too.

## When the gauge fails

1. Open the failed run: `df -h /` and `docker system df` show what is using the space (volumes, images or build cache).
2. Run the workflow by hand. `prune` often brings the disk back under 80 %.
3. If it is still above 80 %, find which repo is leaking (`sudo docker volume ls -qf dangling=true | wc -l`, `sudo docker system df -v` on the VM) and fix it in that repo (for example tmpfs or `--rm -v` for service containers).
4. Last resort, if the runners are offline: from a machine with the GCP key, `ssh ci@<ci-runner-1 IP>` (gcloud gives the IP) and run the same prune by hand: `sudo docker container prune -f && sudo docker volume prune -f && sudo docker image prune -f && sudo docker builder prune -f --keep-storage 10GB`, then `df -h /`. The runner services come back on their own once there is space; check them under Settings → Actions → Runners.
