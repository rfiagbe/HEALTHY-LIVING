"""Search / extract USDA SR Legacy nutrient data (local CSV dataset)."""
import csv, json, sys, re, os

BASE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "usda", "sr",
                    "FoodData_Central_sr_legacy_food_csv_2018-04")

NUTRIENTS = {
    1008: "kcal", 1003: "protein_g", 1004: "fat_g", 1258: "satfat_g",
    1005: "carb_g", 1079: "fiber_g", 2000: "sugar_g", 1093: "sodium_mg",
    1092: "potassium_mg", 1087: "calcium_mg", 1089: "iron_mg",
    1090: "magnesium_mg", 1253: "cholesterol_mg", 1162: "vitc_mg",
    1057: "caffeine_mg",
}

csv.field_size_limit(10_000_000)


def load_foods():
    foods = {}
    with open(os.path.join(BASE, "food.csv"), newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if row["data_type"] == "sr_legacy_food":
                foods[row["fdc_id"]] = row["description"]
    return foods


def load_nutrients(wanted_ids=None):
    out = {}
    with open(os.path.join(BASE, "food_nutrient.csv"), newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            nid = int(row["nutrient_id"]) if row["nutrient_id"] else 0
            if nid not in NUTRIENTS:
                continue
            fid = row["fdc_id"]
            if wanted_ids is not None and fid not in wanted_ids:
                continue
            if not row["amount"]:
                continue
            out.setdefault(fid, {})[NUTRIENTS[nid]] = float(row["amount"])
    return out


def score(desc, terms, avoid):
    d = desc.lower()
    for a in avoid:
        if a in d:
            return -1
    s = 0
    for t in terms:
        if t not in d:
            return -1
        s += 1
    # prefer short, plain descriptions
    return 1000 - len(d) - 50 * d.count(",")


def cmd_search(queries):
    foods = load_foods()
    nut = load_nutrients()
    for q in queries:
        parts = q.split("|")
        terms = [t.strip().lower() for t in parts[0].split() if t.strip()]
        avoid = [t.strip().lower() for t in (parts[1].split() if len(parts) > 1 else [])]
        hits = []
        for fid, desc in foods.items():
            sc = score(desc, terms, avoid)
            if sc > 0:
                hits.append((sc, fid, desc))
        hits.sort(reverse=True)
        print(f"\n## QUERY: {q}")
        for sc, fid, desc in hits[:6]:
            n = nut.get(fid, {})
            print(f"  {fid:>8}  kcal={n.get('kcal','?'):<6} prot={n.get('protein_g','?'):<6} {desc[:95]}")


def load_units():
    units = {}
    with open(os.path.join(BASE, "measure_unit.csv"), newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            units[row["id"]] = row["name"]
    return units


def load_portions(wanted_ids):
    units = load_units()
    out = {}
    with open(os.path.join(BASE, "food_portion.csv"), newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            fid = row["fdc_id"]
            if fid not in wanted_ids or not row["gram_weight"]:
                continue
            unit = units.get(row["measure_unit_id"], "")
            if unit in ("undetermined", ""):
                unit = ""
            label = " ".join(x for x in [row.get("amount") or "", unit,
                                         row.get("modifier") or ""] if x).strip()
            out.setdefault(fid, []).append({
                "label": label,
                "amount": float(row["amount"]) if row["amount"] else None,
                "unit": unit,
                "modifier": (row.get("modifier") or "").strip(),
                "grams": float(row["gram_weight"]),
            })
    return out


def cup_grams(portions):
    """Grams in 1 cup, from USDA portion data."""
    best = None
    for p in portions:
        mod = p["modifier"].lower()
        unit = p["unit"].lower()
        amt = p["amount"] or 0
        is_cup = unit == "cup" or (unit == "" and mod.startswith("cup"))
        if is_cup and amt:
            g = p["grams"] / amt
            # prefer plain "cup" over qualified ones (e.g. "cup, chopped")
            rank = 0 if mod in ("", "cup") else 1
            if best is None or rank < best[0]:
                best = (rank, g)
    return best[1] if best else None


def match_portion(portions, needle):
    needle = needle.lower()
    for p in portions:
        if needle in (p["label"] or "").lower() or needle in p["modifier"].lower():
            return p["grams"] / (p["amount"] or 1)
    return None


def cmd_build(picks_path, out_path):
    picks = json.load(open(picks_path, encoding="utf-8"))
    ids = {str(v["fdc_id"]) for v in picks.values()}
    foods = load_foods()
    nut = load_nutrients(ids)
    portions = load_portions(ids)
    out = {}
    problems = []
    for key, meta in picks.items():
        fid = str(meta["fdc_id"])
        if fid not in foods:
            problems.append(f"{key}: fdc_id not found")
            continue
        n = nut.get(fid, {})
        if "kcal" not in n:
            problems.append(f"{key}: no kcal")
        pts = sorted(portions.get(fid, []), key=lambda p: p["grams"])
        cg = cup_grams(pts)

        rule = meta.get("dga", {})
        serving_g = None
        if rule.get("type") == "grams":
            serving_g = float(rule["g"])
        elif rule.get("type") == "cup":
            if cg:
                serving_g = cg * float(rule.get("frac", 1))
            else:
                problems.append(f"{key}: no cup portion in USDA data")
        elif rule.get("type") == "portion":
            g = match_portion(pts, rule["match"])
            if g:
                serving_g = g * float(rule.get("mult", 1))
            else:
                problems.append(f"{key}: portion '{rule['match']}' not found")

        entry = {
            "name": meta["name"],
            "group": meta.get("group", ""),
            "fdcId": int(fid),
            "usdaDescription": foods[fid],
            "per100g": {k: round(v, 2) for k, v in sorted(n.items())},
        }
        if cg:
            entry["cupGrams"] = round(cg, 1)
        if serving_g:
            entry["dgaServingGrams"] = round(serving_g, 1)
        if meta.get("household"):
            entry["household"] = meta["household"]
        if pts:
            entry["usdaPortions"] = [
                {"label": p["label"], "grams": p["grams"]} for p in pts[:6]
            ]
        out[key] = entry

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=1, ensure_ascii=False, sort_keys=True)
    print(f"wrote {len(out)} foods -> {out_path}")
    for p in problems:
        print("  !", p)


if __name__ == "__main__":
    if sys.argv[1] == "search":
        cmd_search(json.load(open(sys.argv[2], encoding="utf-8")))
    else:
        cmd_build(sys.argv[2], sys.argv[3])
