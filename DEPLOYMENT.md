# Deployment policy

GitHub `main` is the source of truth for this site.

Production changes follow this order:

1. Change and commit files in GitHub.
2. On the server, fetch/pull `origin/main` into `/srv/sites/juwon-english`.
3. Run `docker compose up -d` if application or compose files changed.
4. Verify local and public HTTPS health.

Do not leave production-only edits uncommitted on the server.
