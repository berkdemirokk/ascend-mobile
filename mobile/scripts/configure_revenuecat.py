"""Configure RevenueCat project via the V2 management API:
1. Verify project + app
2. Verify products imported from App Store Connect
3. Create "premium" entitlement (or reuse existing)
4. Attach both products (monthly + yearly) to entitlement
5. Create "default" offering (current)
6. Create packages: $rc_monthly + $rc_annual
7. Attach products to packages

Run: python scripts/configure_revenuecat.py
"""
import os
import sys
import json
import requests

# Read V2 secret from .env.local
ENV_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env.local")
ENV = {}
with open(ENV_PATH) as f:
    for line in f:
        line = line.strip()
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            ENV[k] = v

V2_KEY = ENV.get("REVENUECAT_V2_SECRET")
if not V2_KEY:
    print("✗ REVENUECAT_V2_SECRET not found in .env.local")
    sys.exit(1)

API = "https://api.revenuecat.com/v2"
HEADERS = {
    "Authorization": f"Bearer {V2_KEY}",
    "Content-Type": "application/json",
}

PROJECT_NAME = "Ascend"
ENTITLEMENT_LOOKUP = "premium"
OFFERING_LOOKUP = "default"

MONTHLY_PRODUCT_ID = "com.ascend.premium.monthly"
YEARLY_PRODUCT_ID = "com.ascend.premium.yearly"


def req(method, path, body=None, params=None):
    url = f"{API}{path}"
    r = requests.request(method, url, headers=HEADERS, json=body, params=params)
    try:
        return r.status_code, r.json()
    except Exception:
        return r.status_code, {"raw": r.text}


def must(code, data, action):
    if code in (200, 201):
        return True
    print(f"✗ {action} failed (HTTP {code}): {json.dumps(data, indent=2)[:400]}")
    return False


# ─── Project / app discovery ─────────────────────────────────────────────────
def find_project():
    code, data = req("GET", "/projects")
    if code != 200:
        return None
    for p in data.get("items", []):
        if p.get("name") == PROJECT_NAME:
            return p
    return None


def list_apps(project_id):
    code, data = req("GET", f"/projects/{project_id}/apps")
    if code != 200:
        return []
    return data.get("items", [])


def list_products(project_id):
    code, data = req("GET", f"/projects/{project_id}/products")
    if code != 200:
        return []
    return data.get("items", [])


def list_entitlements(project_id):
    code, data = req("GET", f"/projects/{project_id}/entitlements")
    if code != 200:
        return []
    return data.get("items", [])


def list_offerings(project_id):
    code, data = req("GET", f"/projects/{project_id}/offerings")
    if code != 200:
        return []
    return data.get("items", [])


# ─── Mutations ───────────────────────────────────────────────────────────────
def create_entitlement(project_id, lookup_key, display_name):
    body = {"lookup_key": lookup_key, "display_name": display_name}
    code, data = req("POST", f"/projects/{project_id}/entitlements", body=body)
    if must(code, data, f"Create entitlement '{lookup_key}'"):
        print(f"  ✓ Entitlement created: {data.get('id')}")
        return data
    return None


def attach_product_to_entitlement(project_id, entitlement_id, product_ids):
    body = {"product_ids": product_ids}
    code, data = req(
        "POST",
        f"/projects/{project_id}/entitlements/{entitlement_id}/actions/attach_products",
        body=body,
    )
    return must(code, data, f"Attach products to entitlement {entitlement_id}")


def create_offering(project_id, lookup_key, display_name):
    body = {"lookup_key": lookup_key, "display_name": display_name}
    code, data = req("POST", f"/projects/{project_id}/offerings", body=body)
    if must(code, data, f"Create offering '{lookup_key}'"):
        print(f"  ✓ Offering created: {data.get('id')}")
        return data
    return None


def list_packages(project_id, offering_id):
    code, data = req("GET", f"/projects/{project_id}/offerings/{offering_id}/packages")
    if code != 200:
        return []
    return data.get("items", [])


def create_package(project_id, offering_id, lookup_key, display_name, position):
    body = {
        "lookup_key": lookup_key,
        "display_name": display_name,
        "position": position,
    }
    code, data = req(
        "POST",
        f"/projects/{project_id}/offerings/{offering_id}/packages",
        body=body,
    )
    if must(code, data, f"Create package '{lookup_key}'"):
        print(f"    ✓ Package created: {lookup_key} ({data.get('id')})")
        return data
    return None


def attach_products_to_package(project_id, package_id, app_id, product_id):
    body = {
        "products": [
            {
                "product_id": product_id,
                "eligibility_criteria": "all",
            }
        ],
    }
    code, data = req(
        "POST",
        f"/projects/{project_id}/packages/{package_id}/actions/attach_products",
        body=body,
    )
    return must(code, data, f"Attach product {product_id} to package")


def make_offering_current(project_id, offering_id):
    body = {"is_current": True}
    code, data = req(
        "PATCH",
        f"/projects/{project_id}/offerings/{offering_id}",
        body=body,
    )
    return must(code, data, "Make offering current")


# ─── Main ────────────────────────────────────────────────────────────────────
def main():
    print(">>> Configuring RevenueCat for Ascend: Daily Discipline\n")

    print("=== STEP 1: Find project ===")
    project = find_project()
    if not project:
        print(f"✗ Project '{PROJECT_NAME}' not found")
        sys.exit(1)
    pid = project["id"]
    print(f"  ✓ Project: {project['name']} (id={pid})")

    print("\n=== STEP 2: List apps ===")
    apps = list_apps(pid)
    if not apps:
        print("  ⚠ No apps configured. RC needs an iOS app to manage products.")
        print("  Manual: RC Dashboard → Apps → + New App → iOS → bundle com.ascend.growth")
        sys.exit(1)
    ios_app = next((a for a in apps if a.get("type") == "app_store"), apps[0])
    app_id = ios_app["id"]
    print(f"  ✓ iOS app: {ios_app.get('name', '?')} (id={app_id})")

    print("\n=== STEP 3: List products ===")
    products = list_products(pid)
    products_by_store_id = {
        p.get("store_identifier"): p for p in products
    }
    monthly_prod = products_by_store_id.get(MONTHLY_PRODUCT_ID)
    yearly_prod = products_by_store_id.get(YEARLY_PRODUCT_ID)
    print(f"  Monthly product: {'✓' if monthly_prod else '✗ NOT IMPORTED YET'}")
    print(f"  Yearly product:  {'✓' if yearly_prod else '✗ NOT IMPORTED YET'}")

    if not monthly_prod or not yearly_prod:
        print()
        print("  ⚠ Products not imported from App Store Connect yet.")
        print("  RC imports products automatically once App Store Connect API")
        print("  key is configured AND pricing is set on the products.")
        print("  Check RC Dashboard → Apps → Ascend → App Store Connect API")
        print("  Or wait for sync (can take 5-30 min after pricing is set).")
        # Don't fail — continue with what we have

    monthly_id = monthly_prod["id"] if monthly_prod else None
    yearly_id = yearly_prod["id"] if yearly_prod else None

    print("\n=== STEP 4: Entitlement ===")
    ents = list_entitlements(pid)
    entitlement = next((e for e in ents if e.get("lookup_key") == ENTITLEMENT_LOOKUP), None)
    if entitlement:
        print(f"  ✓ Entitlement '{ENTITLEMENT_LOOKUP}' already exists (id={entitlement['id']})")
    else:
        entitlement = create_entitlement(pid, ENTITLEMENT_LOOKUP, "Premium")
        if not entitlement:
            sys.exit(1)
    ent_id = entitlement["id"]

    if monthly_id or yearly_id:
        attach_ids = [pid_ for pid_ in [monthly_id, yearly_id] if pid_]
        print(f"  Attaching {len(attach_ids)} product(s) to entitlement...")
        attach_product_to_entitlement(pid, ent_id, attach_ids)

    print("\n=== STEP 5: Offering ===")
    offs = list_offerings(pid)
    offering = next((o for o in offs if o.get("lookup_key") == OFFERING_LOOKUP), None)
    if offering:
        print(f"  ✓ Offering '{OFFERING_LOOKUP}' already exists (id={offering['id']})")
    else:
        offering = create_offering(pid, OFFERING_LOOKUP, "Default")
        if not offering:
            sys.exit(1)
    off_id = offering["id"]

    if not offering.get("is_current"):
        print(f"  Making offering current...")
        make_offering_current(pid, off_id)

    print("\n=== STEP 6: Packages ===")
    existing_packages = list_packages(pid, off_id)
    existing_keys = {p.get("lookup_key") for p in existing_packages}

    PACKAGE_DEFS = [
        ("$rc_annual", "Yearly", 1, yearly_id),
        ("$rc_monthly", "Monthly", 2, monthly_id),
    ]

    for lookup_key, display, position, prod_id in PACKAGE_DEFS:
        if lookup_key in existing_keys:
            print(f"  ✓ Package '{lookup_key}' already exists")
            existing_pkg = next((p for p in existing_packages if p["lookup_key"] == lookup_key), None)
            if existing_pkg and prod_id:
                attach_products_to_package(pid, existing_pkg["id"], app_id, prod_id)
            continue
        new_pkg = create_package(pid, off_id, lookup_key, display, position)
        if new_pkg and prod_id:
            attach_products_to_package(pid, new_pkg["id"], app_id, prod_id)

    print("\n=== DONE ===")
    print()
    print("Status summary:")
    print(f"  Project:     {project['name']} ({pid})")
    print(f"  iOS App:     {ios_app.get('name', '?')} ({app_id})")
    print(f"  Entitlement: 'premium' ({ent_id})")
    print(f"  Offering:    'default' ({off_id}, current=true)")
    print(f"  Packages:    $rc_annual + $rc_monthly")
    print()
    if not monthly_prod or not yearly_prod:
        print("⚠ Products from App Store Connect not synced yet.")
        print("  Once pricing is set on ASC, products appear here within ~30 min,")
        print("  then re-run this script to attach them to packages.")


if __name__ == "__main__":
    main()
