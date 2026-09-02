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
EXPECTED_VERSION = os.environ.get("ASC_EXPECTED_VERSION", "1.0.44")
EXPECTED_BUILD = os.environ.get("ASC_EXPECTED_BUILD", "127")


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


def print_subscription_details(subscription, token):
    sub_id = subscription["id"]
    attributes = subscription["attributes"]
    product_id = attributes.get("productId")
    print(
        f"    ✓ Sub: {product_id} | {attributes.get('subscriptionPeriod')} "
        f"| state={attributes.get('state')} | name={attributes.get('name')}"
    )

    code, data = get(
        f"/subscriptions/{sub_id}/subscriptionLocalizations?limit=200", token
    )
    if code == 200:
        locales = sorted(
            item["attributes"].get("locale") for item in data.get("data", [])
        )
        print(f"      Localizations: {', '.join(locales) if locales else 'none'}")
    else:
        print(f"      ⚠ Localizations unavailable (HTTP {code})")

    code, data = get(f"/subscriptions/{sub_id}/introductoryOffers?limit=200", token)
    if code == 200:
        offers = data.get("data", [])
        if offers:
            offer_labels = [
                f"{item['attributes'].get('offerMode')} "
                f"{item['attributes'].get('duration')}"
                for item in offers
            ]
            print(f"      Intro offers: {', '.join(offer_labels)}")
        else:
            print("      Intro offers: none")
    else:
        print(f"      ⚠ Intro offers unavailable (HTTP {code})")

    code, data = get(
        f"/subscriptions/{sub_id}/prices?filter[territory]=USA"
        "&include=subscriptionPricePoint&limit=200",
        token,
    )
    if code == 200:
        customer_prices = sorted(
            {
                item["attributes"].get("customerPrice")
                for item in data.get("included", [])
                if item.get("type") == "subscriptionPricePoints"
                and item.get("attributes", {}).get("customerPrice")
            }
        )
        print(
            "      USA customer price points: "
            + (", ".join(customer_prices) if customer_prices else "configured")
        )
    else:
        print(f"      ⚠ Pricing unavailable (HTTP {code})")


def main():
    token = make_token()
    print(f"Token len: {len(token)}\n")

    # 1) App
    print("=== 1. App lookup ===")
    code, data = get(f"/apps/{APP_ID}", token)
    if code == 200:
        attr = data["data"]["attributes"]
        print(f"  ✓ App: {attr.get('name')} | bundle: {attr.get('bundleId')} | sku: {attr.get('sku')}")
        if attr.get("bundleId") != BUNDLE_ID or attr.get("name") != "Ascend: Daily Discipline":
            print("  ✗ App identity does not match the canonical red-white release")
            return
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
                        print_subscription_details(s, token)
    else:
        print(f"  ✗ HTTP {code}: {data}")

    # 3) Uploaded release build
    print("\n=== 3. Uploaded release build ===")
    # Apple documents `version` as the marketing version filter, while the
    # numeric upload/build number lives in the build resource's `version`
    # attribute. Fetch recent builds and match both values locally so a
    # misleading empty filtered response cannot hide a processed build.
    code, data = get(
        f"/builds?filter[app]={APP_ID}&sort=-uploadedDate"
        "&include=preReleaseVersion&limit=50",
        token,
    )
    if code == 200:
        included = {
            (item.get("type"), item.get("id")): item
            for item in data.get("included", [])
        }
        builds = []
        for candidate in data.get("data", []):
            attrs = candidate.get("attributes", {})
            rel = candidate.get("relationships", {}).get("preReleaseVersion", {})
            rel_data = rel.get("data") or {}
            pre = included.get((rel_data.get("type"), rel_data.get("id")), {})
            pre_version = pre.get("attributes", {}).get("version")
            if str(attrs.get("version")) == str(EXPECTED_BUILD) and (
                pre_version is None or str(pre_version) == EXPECTED_VERSION
            ):
                builds.append(candidate)
        if builds:
            build = builds[0]
            ba = build["attributes"]
            print(
                f"  ✓ Build {EXPECTED_BUILD}: processing={ba.get('processingState')} "
                f"| expired={ba.get('expired')} | uploaded={ba.get('uploadedDate')}"
            )
            code2, groups_data = get(
                f"/builds/{build['id']}/betaGroups?limit=200", token
            )
            if code2 == 200:
                groups = groups_data.get("data", [])
                group_names = [
                    item.get("attributes", {}).get("name", item.get("id", "unknown"))
                    for item in groups
                ]
                if groups:
                    print(f"    ✓ TestFlight groups: {', '.join(group_names)}")
                else:
                    print("    ⚠ Build is not assigned to any TestFlight group")
            else:
                print(f"    ⚠ TestFlight group lookup unavailable (HTTP {code2})")
        else:
            print(f"  ⚠ Build {EXPECTED_BUILD} is not visible yet")
    else:
        print(f"  ⚠ Build lookup unavailable (HTTP {code})")

    # 4) Store version status
    print("\n=== 4. App Store version ===")
    code, data = get(
        f"/apps/{APP_ID}/appStoreVersions?filter[platform]=IOS&limit=200", token
    )
    if code == 200:
        versions = [
            item
            for item in data.get("data", [])
            if item.get("attributes", {}).get("versionString") == EXPECTED_VERSION
        ]
        if versions:
            va = versions[0]["attributes"]
            print(
                f"  ✓ Version {EXPECTED_VERSION}: "
                f"state={va.get('appStoreState')}"
            )
        else:
            print(f"  ⚠ Version {EXPECTED_VERSION} is not visible yet")
    else:
        print(f"  ⚠ Version lookup unavailable (HTTP {code})")

    # 5) Bundle capabilities (Sign in with Apple etc)
    print("\n=== 5. Bundle ID + Capabilities ===")
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
