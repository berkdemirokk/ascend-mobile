"""Verify App Store Connect: app + subscriptions + capabilities."""
import jwt
import time
import requests
import json
import sys
import os

KEY_ID = os.environ.get("ASC_KEY_ID")
ISSUER_ID = os.environ.get("ASC_ISSUER_ID")
KEY_PATH = os.environ.get("ASC_KEY_PATH")
APP_ID = os.environ.get("ASC_APP_ID", "6761607644")
BUNDLE_ID = "com.ascend.growth"


def make_token():
    if not KEY_ID or not ISSUER_ID or not KEY_PATH:
        raise RuntimeError(
            "Set ASC_KEY_ID, ASC_ISSUER_ID and ASC_KEY_PATH before running this script."
        )
    with open(KEY_PATH, 'r') as f:
        private_key = f.read()
    headers = {"alg": "ES256", "kid": KEY_ID, "typ": "JWT"}
    payload = {
        "iss": ISSUER_ID,
        "iat": int(time.time()),
        "exp": int(time.time()) + 1200,
        "aud": "appstoreconnect-v1",
    }
    return jwt.encode(payload, private_key, algorithm="ES256", headers=headers)


def get(path, token):
    r = requests.get(
        f"https://api.appstoreconnect.apple.com/v1{path}",
        headers={"Authorization": f"Bearer {token}"},
    )
    return r.status_code, r.json() if r.text else {}


def main():
    token = make_token()
    print(f"Token len: {len(token)}\n")

    # 1) App
    print("=== 1. App lookup ===")
    code, data = get(f"/apps/{APP_ID}", token)
    if code == 200:
        attr = data["data"]["attributes"]
        print(f"  ✓ App: {attr.get('name')} | bundle: {attr.get('bundleId')} | sku: {attr.get('sku')}")
    else:
        print(f"  ✗ HTTP {code}: {data}")
        return

    # 2) Subscriptions
    print("\n=== 2. Subscription Groups ===")
    code, data = get(f"/apps/{APP_ID}/subscriptionGroups", token)
    if code == 200:
        groups = data.get("data", [])
        if not groups:
            print("  ⚠ No subscription groups yet — needs creation")
        else:
            for g in groups:
                print(f"  ✓ Group: {g['attributes']['referenceName']} (id={g['id']})")
                # Get subscriptions in this group
                code2, d2 = get(f"/subscriptionGroups/{g['id']}/subscriptions", token)
                if code2 == 200:
                    subs = d2.get("data", [])
                    if not subs:
                        print(f"    ⚠ No subscriptions in this group yet")
                    for s in subs:
                        sa = s["attributes"]
                        print(f"    ✓ Sub: {sa.get('productId')} | {sa.get('subscriptionPeriod')} | name={sa.get('name')}")
    else:
        print(f"  ✗ HTTP {code}: {data}")

    # 3) Bundle capabilities (Sign in with Apple etc)
    print("\n=== 3. Bundle ID + Capabilities ===")
    code, data = get(f"/bundleIds?filter[identifier]={BUNDLE_ID}", token)
    if code == 200:
        bids = data.get("data", [])
        if bids:
            bid = bids[0]
            print(f"  ✓ Bundle: {bid['attributes'].get('identifier')} (id={bid['id']})")
            code2, d2 = get(f"/bundleIds/{bid['id']}/bundleIdCapabilities", token)
            if code2 == 200:
                caps = d2.get("data", [])
                cap_types = [c['attributes']['capabilityType'] for c in caps]
                print(f"  ✓ Capabilities: {', '.join(cap_types) if cap_types else 'none'}")
                if 'APPLE_ID_AUTH' in cap_types:
                    print(f"    ✓ Sign In with Apple ENABLED")
                else:
                    print(f"    ⚠ Sign In with Apple NOT enabled")
        else:
            print(f"  ✗ Bundle ID {BUNDLE_ID} not found")
    else:
        print(f"  ✗ HTTP {code}: {data}")


if __name__ == "__main__":
    main()
