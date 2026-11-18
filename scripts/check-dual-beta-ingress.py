#!/usr/bin/env python3
"""Read-only, anonymous acceptance for both H5 origins and their shared API."""

import argparse
import hashlib
from html.parser import HTMLParser
import json
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlsplit
from urllib.request import build_opener, HTTPRedirectHandler, Request
from uuid import uuid4


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class EntryModules(HTMLParser):
    def __init__(self):
        super().__init__()
        self.paths = []

    def handle_starttag(self, name, attrs):
        attrs = dict(attrs)
        if name == "script" and attrs.get("type") == "module" and attrs.get("src"):
            self.paths.append(attrs["src"])


def check_site(origin, key, other_origin, other_key):
    client = build_opener(NoRedirect())

    def get(path, status=200):
        # Only request resources on the explicit site, even if the HTML is stale.
        if not path.startswith("/") or path.startswith("//") or urlsplit(path).netloc:
            raise ValueError(f"unexpected asset path {path!r}")
        request = Request(
            origin + path, headers={"Accept": "*/*", "Cache-Control": "no-cache"}
        )
        try:
            response = client.open(request, timeout=12)
        except HTTPError as error:
            response = error
        with response:
            if response.status != status:
                raise ValueError(
                    f"{path} returned {response.status}, expected {status}"
                )
            return response.headers, response.read()

    def modules_at(path):
        headers, body = get(path)
        if headers.get_content_type() != "text/html":
            raise ValueError(f"{path} did not return H5 HTML")
        parser = EntryModules()
        parser.feed(body.decode("utf-8"))
        if not parser.paths:
            raise ValueError(f"{path} has no H5 entry module")
        return parser.paths

    modules = modules_at("/")
    if modules_at("/pages/search") != modules:
        raise ValueError("cold search route did not return the same entry modules")
    digests = {}
    for path in modules:
        headers, data = get(path)
        if (
            headers.get_content_type()
            not in ("application/javascript", "text/javascript")
            or not data
        ):
            raise ValueError(f"{path} did not return JavaScript")
        digests[path] = hashlib.sha256(data).hexdigest()

    headers, image = get("/static/share-cover.png")
    if headers.get_content_type() != "image/png" or not image.startswith(
        b"\x89PNG\r\n\x1a\n"
    ):
        raise ValueError("missing H5 share image")
    headers, body = get("/site-settings/product-profile")
    profile = json.loads(body)
    if (
        headers.get_content_type() != "application/json"
        or profile["profile"]["key"] != key
    ):
        raise ValueError(f"expected site profile {key}")
    if not any(
        t["key"] == other_key and t["origin"] == other_origin
        for t in profile["switch_targets"]
    ):
        raise ValueError("peer station is missing from the registered switch targets")
    headers, body = get("/local-tools/?" + urlencode({"dialect": "闽.莆仙"}))
    if headers.get_content_type() != "application/json" or not isinstance(
        json.loads(body)["packs"], dict
    ):
        raise ValueError("local tool API did not return its packs object")
    headers, _ = get(f"/files/recording-media/{uuid4()}/", 404)
    if (
        "no-store" not in headers.get("Cache-Control", "")
        or headers.get_content_type() != "application/json"
    ):
        raise ValueError("private media lookup did not reach the uncached API")
    return {"profile": key, "origin": origin, "entryModulesSHA256": digests}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--box", default="https://box.test.edialect.top")
    parser.add_argument("--pxm", default="https://pxm.test.edialect.top")
    args = parser.parse_args()
    origins = [origin.rstrip("/") for origin in (args.box, args.pxm)]
    if origins[0] == origins[1]:
        parser.error("use two distinct site origins")
    for origin in origins:
        url = urlsplit(origin)
        if (
            not url.hostname
            or url.scheme not in ("http", "https")
            or url.username
            or url.password
            or url.path
            or url.query
            or url.fragment
        ):
            parser.error("provide a full HTTP(S) origin for each site")
    receipts = []
    try:
        for key, origin, other_key, other_origin in (
            ("box", origins[0], "pxm", origins[1]),
            ("pxm", origins[1], "box", origins[0]),
        ):
            receipts.append(check_site(origin, key, other_origin, other_key))
        if receipts[0]["entryModulesSHA256"] != receipts[1]["entryModulesSHA256"]:
            raise ValueError("the two sites serve different H5 entry modules")
    except (OSError, URLError, ValueError, KeyError, TypeError) as error:
        sys.exit(f"Dual-site check failed: {error}")
    print(json.dumps(receipts, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
