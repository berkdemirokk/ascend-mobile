"""Set pricing on monthly + yearly subscriptions in App Store Connect.

Strategy: pick the price point closest to target USD price for the USA
territory, then attach it as the subscription's base price. Apple
auto-converts to other territories.

Targets:
- Monthly: $4.99
- Yearly:  $39.99 (best-value: ~$3.33/mo equivalent)

Run: python scripts/set_asc_pricing.py
"""
import jwt
import time
import requests
import os
import json
import sys

KEY_ID = os.environ.get("ASC_KEY_ID")
ISSUER_ID = os.environ.get("ASC_ISSUER_ID")
KEY_PATH = os.environ.get("ASC_KEY_PATH")
API = "https://api.appstoreconnect.apple.com/v1"

MONTHLY_ID = "6762008657"
YEARLY_ID = "6764869393"
MONTHLY_TARGET_USD = 4.99
YEARLY_TARGET_USD = 39.99
TERRITORY = "USA"


def make_token():
    if not KEY_ID or not ISSUER_ID or not KEY_PATH:
        raise RuntimeError(
            "Set ASC_KEY_ID, ASC_ISSUER_ID and ASC_KEY_PATH before running this script."
        )
    with open(KEY_PATH) as f:
        pk = f.read()
    return jwt.encode(
        {
            "iss": ISSUER_ID,
            "iat": int(time.time()),
            "exp": int(time.time()) + 1200,
            "aud": "appstoreconnect-v1",
        },
        pk,
        algorithm="ES256",
        headers={"alg": "ES256", "kid": KEY_ID, "typ": "JWT"},
    )


def req(method, path, token, body=None):
    r = requests.request(
        method,
        f"{API}{path}",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        json=body,
    )
    try:
        return r.status_code, r.json()
    except Exception:
        return r.status_code, {"raw": r.text}


def fetch_all_price_points(token, sub_id):
    """Page through all USA price points for a subscription."""
    points = []
    url = f"{API}/subscriptions/{sub_id}/pricePoints?filter[territory]={TERRITORY}&limit=200"
    while url:
        r = requests.get(url, headers={"Authorization": f"Bearer {token}"})
        if r.status_code != 200:
            return points
        d = r.json()
        points.extend(d.get("data", []))
        url = d.get("links", {}).get("next")
    return points


def closest_price_point(points, target_usd):
    best = None
    best_diff = float("inf")
    for p in points:
        attr = p["attributes"]
        try:
            price = float(attr.get("customerPrice"))
        except (TypeError, ValueError):
            continue
        diff = abs(price - target_usd)
        if diff < best_diff:
            best_diff = diff
            best = p
    return best


def set_subscription_price(token, sub_id, price_point_id, name):
    """Attach a price point to a subscription as its base price."""
    body = {
        "data": {
            "type": "subscriptionPrices",
            "attributes": {
                "startDate": None,
                "preserveCurrentPrice": False,
            },
            "relationships": {
                "subscription": {
                    "data": {
                        "type": "subscriptions",
                        "id": sub_id,
                    }
                },
                "subscriptionPricePoint": {
                    "data": {
                        "type": "subscriptionPricePoints",
                        "id": price_point_id,
                    }
                },
                "territory": {
                    "data": {
                        "type": "territories",
                        "id": TERRITORY,
                    }
                },
            },
        }
    }
    code, data = req("POST", "/subscriptionPrices", token, body=body)
    if code in (200, 201):
        print(f"    ✓ {name} pricing set")
        return True
    err = (data.get("errors") or [{}])[0]
    print(f"    ✗ {name} pricing failed: {err.get('detail', 'HTTP ' + str(code))}")
    return False


def main():
    print(">>> Setting pricing on subscriptions\n")
    token = make_token()

    for sub_id, name, target in [
        (MONTHLY_ID, "Monthly", MONTHLY_TARGET_USD),
        (YEARLY_ID, "Yearly", YEARLY_TARGET_USD),
    ]:
        print(f"=== {name} (target ${target:.2f}) ===")
        points = fetch_all_price_points(token, sub_id)
        print(f"  Fetched {len(points)} price points for {TERRITORY}")
        if not points:
            print(f"  ✗ No price points available — skip {name}")
            continue
        chosen = closest_price_point(points, target)
        if not chosen:
            print(f"  ✗ Could not pick a price point — skip")
            continue
        chosen_price = chosen["attributes"].get("customerPrice")
        print(f"  Chosen: ${chosen_price} (id={chosen['id']})")
        set_subscription_price(token, sub_id, chosen["id"], name)
        print()

    print(">>> Pricing pass complete")
    print()
    print("Note: This sets pricing for USA only. Apple will auto-convert to")
    print("other territories using their current exchange rates. To customize")
    print("a specific territory's price, edit it in the ASC dashboard.")


if __name__ == "__main__":
    main()
