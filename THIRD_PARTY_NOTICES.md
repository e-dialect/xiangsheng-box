# Third-Party Notices

Third-party software remains governed by its own copyright and license terms.
The repository's AGPL declaration does not replace those terms.

| Component / path | Upstream | Copyright | License | Local status |
|---|---|---|---|---|
| `frontend/src/colorui/**` | [`weilanwl/coloruicss`](https://github.com/weilanwl/coloruicss), audited revision `ce1a7feb765f2d89b56577c5a9df96e214ed23ba`; local header identifies ColorUI for uni-app v2.1.6 | Copyright (c) 2018 weilanwl | MIT; full text at `frontend/src/colorui/LICENSE.ColorUI` | Vendored UI component; original attribution retained |
| `frontend/src/uni_modules/luch-audio/**` | [`lei-mu/luch-audio`](https://github.com/lei-mu/luch-audio), package version 1.0.5 | Copyright (c) 2022 luch | MIT; authoritative text at `frontend/src/uni_modules/luch-audio/LICENSE.txt` | Vendored UniApp component |
| `frontend/scripts/incremental-diff.sh` | Existing repository script | Copyright 2022 Charlie Chiang | Apache-2.0; authoritative notice and license URL are in the file header | Path-level license exception; retained as published |

Python, JavaScript, container, and operating-system dependencies installed from
the repository manifests retain their respective upstream licenses and
copyright notices. Their inclusion in a build does not transfer copyright to
e-dialect or Beijing Taju Technology Co., Ltd.

When adding or updating a vendored component, preserve its adjacent notices and
update this table with the exact source, version/commit, license, and local
modification status.
