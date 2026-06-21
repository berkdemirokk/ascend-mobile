"""Configure App Store Connect:
1. Create yearly subscription if missing (com.ascend.premium.yearly)
2. Add localizations (en, tr) to monthly + yearly
3. Add 7-day intro offer (FREE_TRIAL) to monthly + yearly

Run: python scripts/configure_asc.py
"""
import jwt
import time
import requests
import json
import sys
import os

KEY_ID = "CV8FXZNAR8"
ISSUER_ID = "875b8c0f-3adb-4175-b5d4-334257c02837"
KEY_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "..", "credentials", "AuthKey_CV8FXZNAR8.p8"
)
APP_ID = "6761607644"
GROUP_ID = "22025739"

MONTHLY_PRODUCT_ID = "com.ascend.premium.monthly"
YEARLY_PRODUCT_ID = "com.ascend.premium.yearly"

API = "https://api.appstoreconnect.apple.com/v1"


def make_token():
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


def req(method, path, token, body=None, params=None):
    url = f"{API}{path}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    r = requests.request(method, url, headers=headers, json=body, params=params)
    text = r.text
    try:
        data = r.json()
    except Exception:
        data = {"raw": text}
    return r.status_code, data


# ─── Lookup helpers ──────────────────────────────────────────────────────────
def list_subscriptions(token):
    code, data = req("GET", f"/subscriptionGroups/{GROUP_ID}/subscriptions", token)
    if code != 200:
        print(f"  ✗ List subs failed: HTTP {code}: {data}")
        return []
    return data.get("data", [])


def get_subscription_by_product_id(subs, product_id):
    for s in subs:
        if s["attributes"].get("productId") == product_id:
            return s
    return None


def list_localizations(token, sub_id):
    code, data = req(
        "GET",
        f"/subscriptions/{sub_id}/subscriptionLocalizations",
        token,
    )
    if code != 200:
        return []
    return data.get("data", [])


def list_intro_offers(token, sub_id):
    code, data = req(
        "GET",
        f"/subscriptions/{sub_id}/introductoryOffers",
        token,
    )
    if code != 200:
        return []
    return data.get("data", [])


# ─── Mutations ───────────────────────────────────────────────────────────────
def create_yearly_subscription(token):
    body = {
        "data": {
            "type": "subscriptions",
            "attributes": {
                "name": "Ascend Premium Yearly",
                "productId": YEARLY_PRODUCT_ID,
                "subscriptionPeriod": "ONE_YEAR",
                "familySharable": False,
                "groupLevel": 1,
            },
            "relationships": {
                "group": {
                    "data": {
                        "type": "subscriptionGroups",
                        "id": GROUP_ID,
                    }
                }
            },
        }
    }
    code, data = req("POST", "/subscriptions", token, body=body)
    if code in (200, 201):
        sub = data.get("data", {})
        print(f"  ✓ Created yearly subscription: {sub.get('id')}")
        return sub
    print(f"  ✗ Create yearly failed: HTTP {code}")
    print(f"     {json.dumps(data, indent=2)[:500]}")
    return None


def add_localization(token, sub_id, locale, name, description):
    body = {
        "data": {
            "type": "subscriptionLocalizations",
            "attributes": {
                "locale": locale,
                "name": name,
                "description": description,
            },
            "relationships": {
                "subscription": {
                    "data": {
                        "type": "subscriptions",
                        "id": sub_id,
                    }
                }
            },
        }
    }
    code, data = req("POST", "/subscriptionLocalizations", token, body=body)
    if code in (200, 201):
        print(f"    ✓ Localization {locale} added")
        return True
    print(f"    ✗ Localization {locale} failed: HTTP {code}")
    print(f"       {json.dumps(data, indent=2)[:400]}")
    return False


def add_free_trial_offer(token, sub_id, duration="ONE_WEEK", territory="USA"):
    """Add a 7-day free trial as an introductory offer for one territory.
    Apple requires `territory` for intro offers; we pick USA as base. After
    pricing is set in dashboard, you can replicate the offer to other
    territories or rely on Apple's automatic conversion.
    """
    body = {
        "data": {
            "type": "subscriptionIntroductoryOffers",
            "attributes": {
                "duration": duration,
                "offerMode": "FREE_TRIAL",
                "numberOfPeriods": 1,
            },
            "relationships": {
                "subscription": {
                    "data": {
                        "type": "subscriptions",
                        "id": sub_id,
                    }
                },
                "territory": {
                    "data": {
                        "type": "territories",
                        "id": territory,
                    }
                },
            },
        }
    }
    code, data = req("POST", "/subscriptionIntroductoryOffers", token, body=body)
    if code in (200, 201):
        print(f"    ✓ 7-day free trial offer added (territory={territory})")
        return True
    err = data.get("errors", [{}])[0] if isinstance(data, dict) else {}
    print(f"    ⚠ Free trial offer skipped: {err.get('detail', 'HTTP ' + str(code))}")
    return False


# ─── Main flow ────────────────────────────────────────────────────────────────
def main():
    print(">>> Configuring App Store Connect for Ascend: Daily Discipline\n")
    token = make_token()

    print("=== STEP 1: Inventory existing subscriptions ===")
    subs = list_subscriptions(token)
    monthly = get_subscription_by_product_id(subs, MONTHLY_PRODUCT_ID)
    yearly = get_subscription_by_product_id(subs, YEARLY_PRODUCT_ID)
    print(f"  Monthly: {'✓ exists (id=' + monthly['id'] + ')' if monthly else '✗ MISSING'}")
    print(f"  Yearly:  {'✓ exists (id=' + yearly['id'] + ')' if yearly else '✗ MISSING'}")

    if not monthly:
        print("\n✗ Cannot proceed — monthly subscription missing.")
        sys.exit(1)

    print("\n=== STEP 2: Create yearly subscription if missing ===")
    if not yearly:
        yearly = create_yearly_subscription(token)
        if not yearly:
            print("✗ Could not create yearly. Stop.")
            sys.exit(1)
    else:
        print("  ✓ Already exists, skipping.")

    yearly_id = yearly["id"]
    monthly_id = monthly["id"]

    print("\n=== STEP 3: Add localizations ===")
    # Description max 55 chars (Apple limit).
    LOCALES = [
        {
            "locale": "en-US",
            "monthly_name": "Daily Discipline Premium (Monthly)",
            "monthly_desc": "Unlimited hearts, all paths, ad-free.",
            "yearly_name": "Daily Discipline Premium (Yearly)",
            "yearly_desc": "Unlimited hearts, all paths, ad-free. Best value.",
        },
        {
            "locale": "tr",
            "monthly_name": "Daily Discipline Premium (Aylık)",
            "monthly_desc": "Sınırsız kalp, tüm yollar, reklamsız.",
            "yearly_name": "Daily Discipline Premium (Yıllık)",
            "yearly_desc": "Sınırsız kalp, tüm yollar, reklamsız. En iyi fiyat.",
        },
    ]

    for sub_id, sub_name in [(monthly_id, "monthly"), (yearly_id, "yearly")]:
        print(f"  --- {sub_name} ({sub_id}) ---")
        existing = list_localizations(token, sub_id)
        existing_locales = {loc["attributes"]["locale"] for loc in existing}
        for loc in LOCALES:
            if loc["locale"] in existing_locales:
                print(f"    ✓ {loc['locale']} already present")
                continue
            name = loc[f"{sub_name}_name"]
            desc = loc[f"{sub_name}_desc"]
            add_localization(token, sub_id, loc["locale"], name, desc)

    print("\n=== STEP 4: Add 7-day intro offers ===")
    for sub_id, sub_name in [(monthly_id, "monthly"), (yearly_id, "yearly")]:
        print(f"  --- {sub_name} ({sub_id}) ---")
        existing_offers = list_intro_offers(token, sub_id)
        if existing_offers:
            print(f"    ✓ {len(existing_offers)} intro offer(s) already exist, skipping.")
            continue
        add_free_trial_offer(token, sub_id, "ONE_WEEK")

    print("\n=== DONE ===")
    print("Verify with: python scripts/verify_asc.py")
    print()
    print("⚠ Manual steps still required:")
    print("  1. Set base price for yearly in ASC dashboard (Pricing tab)")
    print("     — App Store Connect requires manual pricing input via UI.")
    print("  2. Localizations may need 'Submit for Review' approval.")


if __name__ == "__main__":
    main()
