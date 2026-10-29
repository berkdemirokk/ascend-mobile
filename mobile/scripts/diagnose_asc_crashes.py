"""Read TestFlight crash metadata without publishing tester data or raw logs.

Uses the same read-only credentials as verify_asc.py. Apple API reference:
https://developer.apple.com/documentation/appstoreconnectapi/beta-feedback-crash-submissions
"""
import json
import re
from urllib.parse import urlencode

from verify_asc import APP_ID, EXPECTED_BUILD, get, make_token


def safe_code(value):
    """Only emit bounded machine identifiers into potentially public CI logs."""
    value = str(value or "")
    return value if re.fullmatch(r"[A-Za-z0-9_.+() /:-]{1,120}", value) else "[omitted]"


def summarize_log(raw):
    # Modern .ips logs may have a one-line metadata JSON followed by a JSON body.
    decoder = json.JSONDecoder()
    rest = raw.lstrip()
    summary = {}
    while rest:
        try:
            item, end = decoder.raw_decode(rest)
        except (ValueError, TypeError):
            break
        rest = rest[end:].lstrip()
        if not isinstance(item, dict):
            continue
        for section, keys in {
            "exception": ("type", "signal"),
            "termination": ("namespace", "code", "indicator"),
        }.items():
            data = item.get(section, {})
            if isinstance(data, dict):
                for key in keys:
                    if key in data:
                        summary[f"{section}.{key}"] = safe_code(data[key])
        threads = item.get("threads", [])
        faulting = item.get("faultingThread")
        for index, thread in enumerate(threads if isinstance(threads, list) else []):
            if not isinstance(thread, dict):
                continue
            if thread.get("triggered") or index == faulting:
                summary["faultingSymbols"] = [
                    safe_code(frame.get("symbol"))
                    for frame in thread.get("frames", [])[:12]
                    if isinstance(frame, dict) and frame.get("symbol")
                ]
                break
    if not summary:
        # Legacy text logs: exclude identifiers, paths, and user comments.
        for label in ("Exception Type", "Exception Subtype", "Termination Reason"):
            match = re.search(rf"^{label}:\s*(.+)$", raw, re.MULTILINE)
            if match:
                summary[label] = safe_code(match.group(1))
    return summary or {"status": "Log returned; no supported diagnostic fields"}


def main():
    if not EXPECTED_BUILD or not all(part.isdigit() for part in EXPECTED_BUILD.split(".")):
        raise RuntimeError("Set ASC_EXPECTED_BUILD to an exact build number.")
    token = make_token()
    params = urlencode({
        "limit": 100,
        "sort": "-createdDate",
        "fields[betaFeedbackCrashSubmissions]": "createdDate,deviceModel,osVersion,build",
        "include": "build",
        "fields[builds]": "version",
    })
    code, response = get(f"/apps/{APP_ID}/betaFeedbackCrashSubmissions?{params}", token)
    if code != 200:
        raise RuntimeError(f"Apple crash feedback unavailable: HTTP {code}")
    builds = {row["id"]: row.get("attributes", {}).get("version")
              for row in response.get("included", []) if row.get("type") == "builds"}
    rows = response.get("data", [])
    print(json.dumps({"crashSubmissionsInPage": len(rows),
                      "hasMore": bool(response.get("links", {}).get("next")),
                      "expectedBuild": EXPECTED_BUILD}))
    matched = 0
    for row in rows:
        attributes = row.get("attributes", {})
        build_id = row.get("relationships", {}).get("build", {}).get("data") or {}
        version = builds.get(build_id.get("id"))
        if EXPECTED_BUILD and version != EXPECTED_BUILD:
            continue
        matched += 1
        code, log = get(f"/betaFeedbackCrashSubmissions/{row['id']}/crashLog", token)
        diagnostic = {"build": safe_code(version),
                      "device": safe_code(attributes.get("deviceModel")),
                      "os": safe_code(attributes.get("osVersion")),
                      "logStatus": code}
        if code == 200:
            raw = log.get("data", {}).get("attributes", {}).get("logText", "")
            diagnostic["diagnostic"] = summarize_log(raw)
        print(json.dumps(diagnostic))
        if matched >= 10:
            break
    print(json.dumps({"matchingReportsExamined": matched}))
    print("Missing feedback does not establish that the app is crash-free.")


if __name__ == "__main__":
    main()
