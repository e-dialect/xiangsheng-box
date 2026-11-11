# Box phone-code login gate validation

Checkout: `e-dialect/xiangsheng-box`, branch `fix/hide-unavailable-phone-code-login`.
Base commit: `bde136f8763452cf95d18cd2605b997fd0263e00` (GitHub `main` SHA checked before clone).

## Behavior checks

- `VITE_PHONE_CODE_LOGIN_ENABLED=false yarn vitest run --no-cache tests/unit/LoginPage.test.js` — 8 passed.
- `VITE_PHONE_CODE_LOGIN_ENABLED=true yarn vitest run --no-cache tests/unit/LoginPage.test.js` — 8 passed.
- With the flag off, the test supplies phone-mode URL query values, requests a mode switch, and directly calls both phone-code handlers with valid-looking phone/code data. The page remains in password mode; neither `requestPhoneCode` nor `loginWithPhone` is called.
- Existing login-page unit coverage confirms the email registration and password-reset entry buttons remain visible and route to their existing handlers.
- `yarn vitest run --no-cache` — 83 files, 607 tests passed with the flag off.
- `yarn lint` — passed.
- `python scripts/test_release_scripts.py` — 15 tests passed, including the production build-argument and release-manifest contract.
- `yarn build:h5:checked` — passed with the flag unset/off; warning audit reported no tracked notices.
- `VITE_PHONE_CODE_LOGIN_ENABLED=true yarn build:h5:checked` — passed; warning audit reported no tracked notices.
- Ruby Psych parsed `docker-compose.yml` and `docker-compose.traefik.yml`; `git diff --check` passed. The enabled-mode E2E test now checks the initially visible phone form before switching to password and back; E2E itself was not run because no local backend/browser fixture was started.

Vitest emitted a sandbox `EPERM` warning while trying to open its optional WebSocket listener; test runs completed successfully. No Docker image build, E2E run, GitHub mutation, or production operation was performed.

## Release build contract

`frontend/Dockerfile` sets the Vite build argument default to `false`. The current `.github/workflows/release.yml` and CI production image build now pass `VITE_PHONE_CODE_LOGIN_ENABLED=false` explicitly, and the release manifest records the string value `false`. Enabling it later requires changing the GHCR publisher build argument and manifest contract/tests to `true`, followed by a new image build. For the separate COS H5 workflow, the same value belongs in its build step environment. A runtime container environment variable cannot change this Vite-compiled UI.

## Changed files

- `.env.example`
- `.github/workflows/ci.yml`
- `.github/workflows/release.yml`
- `docker-compose.yml`
- `docker-compose.traefik.yml`
- `docs/DEVELOPMENT.md`
- `docs/PRODUCTION_IMAGES.md`
- `frontend/Dockerfile`
- `frontend/src/pages/login/login.vue`
- `frontend/tests/e2e/base-field-unmount.spec.js`
- `frontend/tests/e2e/phone-auth.spec.js`
- `frontend/tests/unit/LoginPage.test.js`
- `scripts/create-release-manifest.mjs`
- `scripts/test_release_scripts.py`

## 2026-11-11 review follow-up: exercise both flag states in CI

The earlier eight-pass LoginPage totals included early-return tests with no assertions in
one flag state. Those totals are not evidence that all eight behaviors ran. The tests now
explicitly skip inapplicable cases. The Frontend Unit CI job explicitly runs the full suite
with the flag `false`, then the login-page regression suite with `true` in a separate process.
Production build flags remain unchanged.

Actual local checks on the follow-up based on `98e77941961eb54e48919528bc25c7c882c8bb69`:

- Node 22.22.2, Yarn 1.22.22; `yarn install --frozen-lockfile --production=false` passed.
- `VITE_PHONE_CODE_LOGIN_ENABLED=false yarn test:unit`: 83 files passed, 604 tests passed,
  3 explicitly skipped (607 total).
- `VITE_PHONE_CODE_LOGIN_ENABLED=true yarn vitest run tests/unit/LoginPage.test.js`:
  7 tests passed, 1 explicitly skipped. Phone-login payload, mode switching and both
  server-error paths executed.
- CI YAML parsed and the two steps' string-valued false/true environment contracts checked.
- Independent static review found no blocking issue in the CI/test-only changes.

No application code, production flag, authentication API or release behavior changed.
No browser E2E, Docker build, real SMS delivery, production deployment, or human journey
acceptance was performed for this follow-up. Remote CI must be checked against the published
commit separately; local results do not claim remote CI success.

`yarn lint` (the configured `src` lint scope) passed. An additional direct ESLint run on
`LoginPage.test.js` reported six pre-existing import-format/order errors; running the same
command on the unmodified HEAD file produced the same six errors. They are not introduced
by this follow-up and no claim is made that this extra, non-CI lint scope passed.
