"""
Run all Amsterdam data imports sequentially.

Usage:
    cd backend && source venv/bin/activate
    python import_all.py [--dry-run]
"""

import argparse
import sys
import traceback

from data_import import import_lighting, import_incidents, import_overlast_zones, import_gebieden, import_bag

STEPS = [
    ("Street lighting points", import_lighting),
    ("Incident reports (meldingen)", import_incidents),
    ("Overlast / camera zones", import_overlast_zones),
    ("Buurt polygons (gebieden)", import_gebieden),
    ("BAG building density", import_bag),
]


def main() -> None:
    parser = argparse.ArgumentParser(description="Run all Amsterdam data import scripts.")
    parser.add_argument("--dry-run", action="store_true", help="Parse and validate without writing to DB.")
    args = parser.parse_args()

    failures = []
    for name, module in STEPS:
        print(f"\n{'='*60}")
        print(f"  {name}")
        print(f"{'='*60}")
        try:
            # Inject dry_run by patching sys.argv temporarily
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


if __name__ == "__main__":
    main()
