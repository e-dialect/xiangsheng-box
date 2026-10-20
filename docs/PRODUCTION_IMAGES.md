# Production images

The `CI` workflow preserves development Compose/H5 E2E coverage and additionally
starts the production backend and same-origin H5 images with synthetic settings,
no network, read-only root filesystems, unprivileged users, resource limits and
throwaway data. No real email, WeChat or COS request is part of this fixture.

After the exact main commit passes `CI gate`, `Publish immutable images` verifies
the triggering repository, branch, commit and successful CI run before publishing
linux/amd64 images and the release manifest. Retrying a release reuses already
published commit images and verifies their revision/platform/config identities.
Consumers should pin manifest digests/config image IDs, rather than `latest`.

The production backend requires `ENVIRONMENT=production` and uses
`config.production` with Gunicorn. Its runtime must explicitly choose an
unprivileged UID and writable `/data` and `/tmp`; `/data` holds SQLite, media and
legacy local logs. Supply dedicated strong `SECRET_KEY` and `JWT_KEY`, a single
HTTPS `PUBLIC_BACKEND_URL` origin, real required provider credentials, and a
dedicated `COS_KEY_PREFIX`. Disable all three demo authentication flags. With no
SMS provider, phone-code requests fail closed with 503. Mini-program credentials
alone do not configure H5 WeChat authorization.

Only a trusted reverse proxy may provide `X-Forwarded-Proto`; do not expose the
backend directly. Route backend API roots and `/static/` to port 8000. The
readiness path `/site-settings/capabilities` is exempt from HTTPS redirect for
local checks; it still validates Host. Health JSON does not prove login, external
provider delivery or backup recovery. Nginx runs as UID/GID 10001 on port 8080
with a bounded writable `/tmp`. Build the production H5 image with
`VITE_BACKEND_URL=` for same-origin APIs; the default placeholder build preserves
development runtime replacement.

Phone-code login is hidden by default through the frontend Dockerfile's
`VITE_PHONE_CODE_LOGIN_ENABLED=false` build argument. The GHCR release workflow
does not override it, so changing a container environment variable cannot
expose the UI. After SMS delivery has been verified, explicitly add
`VITE_PHONE_CODE_LOGIN_ENABLED=true` to the frontend `build-args` in
`.github/workflows/release.yml`; for the separate COS H5 workflow, set the same
value in the `Build H5` step environment. Rebuild and publish the frontend
artifact before expecting the option to appear.

Object storage can share a bucket only with an explicit isolated prefix. New COS
uploads and deletions use that prefix; deletion URLs outside it are rejected.
This does not enforce a provider-side IAM restriction: deploy a dedicated account
or prefix-restricted policy when stronger separation is needed. Local-media
backup does not by itself back up remote COS objects.

The manifest's Django migration digest describes the image source, not proof that
an existing database can be upgraded or rolled back. First deployment can use a
fresh database after an isolated migration rehearsal. Later deployments require a
consistent private backup and actual old→new→old compatibility evidence; never
restore an old database over live data or infer rollback safety from unchanged
migration filenames. Keep secrets and operational configuration outside Git.

Runtime references: [Django WSGI/Gunicorn](https://docs.djangoproject.com/en/6.0/howto/deployment/wsgi/gunicorn/)
and [WhiteNoise](https://whitenoise.readthedocs.io/en/stable/django.html).
