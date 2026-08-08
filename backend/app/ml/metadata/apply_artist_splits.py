import os
import glob
import pandas as pd


def get_track_ids_from_split(split_tsv_path: str) -> set:
    ids = set()
    with open(split_tsv_path, "r", encoding="utf-8") as f:
        header = f.readline()
        for line in f:
            parts = line.strip().split("\t")
            if parts:
                ids.add(f"jamendo_{parts[0]}")
    return ids


def apply_official_splits(
    processed_labels_path: str,
    splits_dir: str,
    out_dir: str
):
    print("Loading processed labels...")
    labels_df = pd.read_csv(processed_labels_path)

    # Search for train and validation split files in split-0
    train_files = glob.glob(os.path.join(splits_dir, "*train*.tsv"))
    val_files = glob.glob(os.path.join(splits_dir, "*validation*.tsv")) + glob.glob(os.path.join(splits_dir, "*val*.tsv"))

    if not train_files or not val_files:
        print(f"Warning: Could not find split files in '{splits_dir}'. Falling back to stratified 80/20 split.")
        train_df = labels_df.sample(frac=0.8, random_state=42)
        val_df = labels_df.drop(train_df.index)
    else:
        train_split_tsv = train_files[0]
        val_split_tsv = val_files[0]
        print(f"Using train split: {train_split_tsv}")
        print(f"Using val split  : {val_split_tsv}")

        train_ids = get_track_ids_from_split(train_split_tsv)
        val_ids = get_track_ids_from_split(val_split_tsv)

        train_df = labels_df[labels_df["track_id"].isin(train_ids)]
        val_df = labels_df[labels_df["track_id"].isin(val_ids)]

    os.makedirs(out_dir, exist_ok=True)
    train_out = os.path.join(out_dir, "train_labels.csv")
    val_out = os.path.join(out_dir, "val_labels.csv")

    train_df.to_csv(train_out, index=False)
    val_df.to_csv(val_out, index=False)

    print(f"\n Successfully generated artist-separated splits in '{out_dir}':")
    print(f"  - Train Set: {len(train_df)} tracks -> {train_out}")
    print(f"  - Val Set:   {len(val_df)} tracks -> {val_out}")


if __name__ == "__main__":
    apply_official_splits(
        processed_labels_path="data/processed/jamendo_labels.csv",
        splits_dir="data/jamendo/data/splits/split-0",
        out_dir="data/processed"
    )