---
name: lesson-docker-welcome
type: lesson
description: Docker on the WELCOME PC, low disk space, exec format errors, WSL 1603
updated: 2026-11-12
---

- C: has little space, so Docker storage lives on `D:\Docker`. npm's cache was cleared to fit WSL.
- WSL install error 1603: check disk space in the installer log.
- "exec format error" after the first `supabase start`: images unpacked with empty programs during the parallel pull. Remove the Supabase images and `docker pull` them one at a time.
- Docker Desktop does not always start on its own after a restart.

From [[session-5]]. See [[env-welcome-pc]], [[db]].
