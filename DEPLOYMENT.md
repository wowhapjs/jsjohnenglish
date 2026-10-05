# Deployment policy

GitHub `main` is the single source of truth for this site. ChatGPT performs coding and deployment orchestration; GitHub Actions / automatic deployment is intentionally not used.

Production flow:

1. Commit the change to GitHub `main`.
2. Identify the full commit SHA.
3. Run `site-deploy juwon-english <sha>` on the server.
4. The runner verifies the SHA belongs to `origin/main`, runs `docker compose config -q`, resets the production tree to that SHA, applies `docker compose up -d --remove-orphans`, and checks local/public health.
5. Deployment state is recorded in the Manager DB. Failed activation or health checks automatically roll back to the previous SHA.

Do not edit production source directly on the server. Do not use `git pull` as the production deployment primitive.
