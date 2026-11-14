import sys

from pipeline.osd569 import OUTPUT, Osd569Error, build, render


def main() -> int:
    try:
        document = build()
    except (Osd569Error, OSError, KeyError) as error:
        print(f"FAILED: {error}", file=sys.stderr)
        return 1
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(render(document), encoding="utf-8")
    values = sum(len(indicator["values"]) for indicator in document["indicators"])
    print(f"{document['dataset']['id']}: {len(document['indicators'])} indicators, {values} values, "
          f"{len(document['subjects'])} subjects, {len(document['timepoints'])} timepoints")
    print(f"Wrote {OUTPUT.relative_to(OUTPUT.parents[2])}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
