"""
Run all Amsterdam data imports sequentially, then compute the safety grid.

Lighting and incidents are fetched in memory during grid computation —
they are NOT stored in Supabase. Only safety_grid (the output) is persisted.

Usage:
    cd backend && source venv/bin/activate
    python import_all.py [--dry-run]
    python compute_grid.py [--dry-run]   # run separately after this completes
"""

import argparse
import sys
import traceback

from data_import import import_overlast_zones, import_gebieden, import_bag, import_veiligheidsindex, import_unsafe_areas
from scripts import import_pointer_data

STEPS = [
    ("Overlast / camera zones → Supabase", import_overlast_zones),
    ("Buurt polygons → data/buurt_polygons.json", import_gebieden),
    ("BAG building density → data/bag_density.json", import_bag),
    ("Veiligheidsindex baseline → Supabase buurt_baseline", import_veiligheidsindex),
    ("Unsafe areas (survey seed) → Supabase unsafe_areas", import_unsafe_areas),
    ("Pointer/KRO-NCRV crowdsourced pins → Supabase unsafe_areas", import_pointer_data),
]


def main() -> None:
    parser = argparse.ArgumentParser(description="Import supporting data layers.")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    failures = []
    for name, module in STEPS:
        print(f"\n{'='*60}")
        print(f"  {name}")
        print(f"{'='*60}")
        try:
            original_argv = sys.argv
            sys.argv = ["import"] + (["--dry-run"] if args.dry_run else [])
            module.main()
            sys.argv = original_argv
        except Exception as exc:
            print(f"ERROR in {name}: {exc}")
            traceback.print_exc()
            failures.append(name)
            sys.argv = original_argv

    print(f"\n{'='*60}")
    if failures:
        print(f"COMPLETED WITH ERRORS in: {', '.join(failures)}")
        sys.exit(1)
    else:
        print("ALL IMPORTS COMPLETE")
        print("\nNext step: python compute_grid.py")


if __name__ == "__main__":
    main()
