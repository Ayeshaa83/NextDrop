import os
import json
import argparse
import pandas as pd
from typing import Dict, List, Tuple


def load_taxonomy_map(map_path: str) -> Dict[str, str]:
    with open(map_path, "r", encoding="utf-8") as f:
        raw_map = json.load(f)
    
    # Flatten genres, moods, and instruments into a single lookup dict
    flat_map = {}
    for category in ["genres", "moods", "instruments"]:
        for raw_tag, canonical_tag in raw_map.get(category, {}).items():
            flat_map[raw_tag] = canonical_tag
    return flat_map


def parse_mtg_jamendo_tsv(
    tsv_path: str,
    taxonomy_map: Dict[str, str],
    min_tag_frequency: int = 50
) -> Tuple[pd.DataFrame, pd.DataFrame, List[str]]:
    """
    Parses Jamendo TSV line-by-line to safely handle variable-length tab-separated tags.
    """
    print(f"Reading TSV line-by-line: {tsv_path}...")

    tracks = []
    track_normalized_tags = {}
    canonical_tag_counts = {}

    with open(tsv_path, "r", encoding="utf-8") as f:
        header = f.readline()  # Skip header line

        for line in f:
            line = line.strip()
            if not line:
                continue
            
            parts = line.split("\t")
            if len(parts) < 6:
                continue

            track_id = f"jamendo_{parts[0]}"
            artist_id = parts[1]
            album_id = parts[2]
            path = parts[3]
            duration = parts[4]
            raw_tags = parts[5:]  # All remaining fields on this row are tags

            # Map raw tags to canonical tags
            canonical_tags_for_track = set()
            for raw_tag in raw_tags:
                raw_tag = raw_tag.strip()
                if raw_tag in taxonomy_map:
                    canon_tag = taxonomy_map[raw_tag]
                    canonical_tags_for_track.add(canon_tag)
                    canonical_tag_counts[canon_tag] = canonical_tag_counts.get(canon_tag, 0) + 1

            if canonical_tags_for_track:  # Only keep tracks that match at least 1 canonical tag
                tracks.append({
                    "track_id": track_id,
                    "artist_id": artist_id,
                    "album_id": album_id,
                    "duration": duration,
                    "rel_path": path
                })
                track_normalized_tags[track_id] = canonical_tags_for_track

    # Filter tags that meet the minimum instance frequency requirement
    valid_canonical_tags = sorted([
        tag for tag, count in canonical_tag_counts.items() if count >= min_tag_frequency
    ])

    print(f"\nExtracted {len(valid_canonical_tags)} canonical tags meeting min_freq >= {min_tag_frequency}:")
    for tag in valid_canonical_tags:
        print(f"  - {tag}: {canonical_tag_counts[tag]} tracks")

    # Build multi-hot binary DataFrame
    multi_hot_rows = []
    for track in tracks:
        tid = track["track_id"]
        tags_set = track_normalized_tags[tid]
        
        row_dict = {"track_id": tid}
        for tag in valid_canonical_tags:
            row_dict[tag] = 1 if tag in tags_set else 0
        multi_hot_rows.append(row_dict)

    tracks_df = pd.DataFrame(tracks)
    labels_df = pd.DataFrame(multi_hot_rows)

    return tracks_df, labels_df, valid_canonical_tags


def process_jamendo_pipeline(tsv_path: str, taxonomy_map_path: str, output_dir: str, min_freq: int):
    os.makedirs(output_dir, exist_ok=True)
    
    taxonomy_map = load_taxonomy_map(taxonomy_map_path)
    tracks_df, labels_df, active_tags = parse_mtg_jamendo_tsv(tsv_path, taxonomy_map, min_freq)

    tracks_out = os.path.join(output_dir, "jamendo_tracks.csv")
    labels_out = os.path.join(output_dir, "jamendo_labels.csv")
    manifest_out = os.path.join(output_dir, "canonical_taxonomy_manifest.json")

    tracks_df.to_csv(tracks_out, index=False)
    labels_df.to_csv(labels_out, index=False)

    manifest = {
        "active_tags": active_tags,
        "total_tracks": len(tracks_df),
        "tag_count": len(active_tags)
    }
    with open(manifest_out, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    print(f"\n Successfully generated data artifacts in '{output_dir}':")
    print(f"  - Tracks metadata: {tracks_out} ({len(tracks_df)} rows)")
    print(f"  - Multi-hot targets: {labels_out} ({labels_df.shape[1] - 1} labels)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Prepare MTG-Jamendo dataset annotations")
    parser.add_argument("--tsv", required=True, help="Path to Jamendo TSV")
    parser.add_argument("--taxonomy-map", default="backend/ml/taxonomy_map.json", help="Path to taxonomy map JSON")
    parser.add_argument("--out-dir", default="data/processed", help="Output directory")
    parser.add_argument("--min-freq", type=int, default=50, help="Minimum track frequency for a tag")
    
    args = parser.parse_args()
    process_jamendo_pipeline(args.tsv, args.taxonomy_map, args.out_dir, args.min_freq)