# Box phone-code login gate validation

Checkout: `e-dialect/xiangsheng-box`, branch `fix/hide-unavailable-phone-code-login`.
Base commit: `bde136f8763452cf95d18cd2605b997fd0263e00` (GitHub `main` SHA checked before clone).

## Behavior checks

- `VITE_PHONE_CODE_LOGIN_ENABLED=false yarn vitest run --no-cache tests/unit/LoginPage.test.js` — 7 passed.
- `VITE_PHONE_CODE_LOGIN_ENABLED=true yarn vitest run --no-cache tests/unit/LoginPage.test.js` — 7 passed.
- With the flag off, the test supplies phone-mode URL query values, requests a mode switch, and directly calls both phone-code handlers with valid-looking phone/code data. The page remains in password mode; neither `requestPhoneCode` nor `loginWithPhone` is called.
- Existing login-page unit coverage confirms the email registration and password-reset entry buttons remain visible and route to their existing handlers.
- `yarn vitest run --no-cache` — 83 files, 606 tests passed with the flag off.
- `yarn lint` — passed.
- `yarn build:h5:checked` — passed with the flag unset/off; warning audit reported no tracked notices.
- `VITE_PHONE_CODE_LOGIN_ENABLED=true yarn build:h5:checked` — passed; warning audit reported no tracked notices.
- Ruby Psych parsed `docker-compose.yml` and `docker-compose.traefik.yml`; `git diff --check` passed.

Vitest emitted a sandbox `EPERM` warning while trying to open its optional WebSocket listener; test runs completed successfully. No Docker image build, E2E run, GitHub mutation, or production operation was performed.

## Release build contract

`frontend/Dockerfile` sets the Vite build argument default to `false`. At the frozen base head, `.github/workflows/release.yml` passes only `VITE_BACKEND_URL` to the GHCR frontend build, so the phone-code UI stays hidden by the Dockerfile default. Enabling it later requires an explicit `VITE_PHONE_CODE_LOGIN_ENABLED=true` build argument in that publisher workflow and a rebuilt image. For the separate COS H5 workflow, the same value belongs in its build step environment. A runtime container environment variable cannot change this Vite-compiled UI.

## Changed files

- `.env.example`
- `docker-compose.yml`
- `docker-compose.traefik.yml`
- `docs/DEVELOPMENT.md`
- `docs/PRODUCTION_IMAGES.md`
- `frontend/Dockerfile`
- `frontend/src/pages/login/login.vue`
- `frontend/tests/e2e/base-field-unmount.spec.js`
- `frontend/tests/e2e/phone-auth.spec.js`
- `frontend/tests/unit/LoginPage.test.js`
