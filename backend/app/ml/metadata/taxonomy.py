from typing import List, Dict

CANONICAL_GENRES: Dict[str, List[str]] = {
    "rock": ["rock", "classic rock", "hard rock", "alt-rock", "alternative rock"],
    "hip_hop": ["hip hop", "hip-hop", "rap", "trap", "boom bap"],
    "electronic": ["electronic", "edm", "house", "techno", "synthwave", "electro"],
    "pop": ["pop", "synthpop", "indie pop", "dance pop"],
    "jazz": ["jazz", "smooth jazz", "bebop"],
    "classical": ["classical", "symphonic", "orchestral"],
    "ambient": ["ambient", "drone", "chillout", "downtempo"],
    "r_and_b": ["r&b", "rnb", "soul", "neo-soul"],
    "reggae": ["reggae", "dub", "roots reggae"]
}

CANONICAL_MOODS: Dict[str, List[str]] = {
    "energetic": ["energetic", "high energy", "hyped", "upbeat", "pumping"],
    "chill": ["chill", "mellow", "relaxed", "calm", "laidback"],
    "sad": ["sad", "melancholy", "gloomy", "heartbreak"],
    "happy": ["happy", "cheerful", "joyful", "feel good"],
    "dark": ["dark", "creepy", "intense", "ominous"],
    "romantic": ["romantic", "passionate", "love"]
}

CANONICAL_INSTRUMENTS: Dict[str, List[str]] = {
    "electric_guitar": ["electric guitar", "e-guitar", "lead guitar"],
    "acoustic_guitar": ["acoustic guitar", "steel guitar"],
    "piano": ["piano", "grand piano", "keys"],
    "synthesizer": ["synth", "synthesizer", "analog synth"],
    "drums": ["drums", "drum kit", "percussion", "drum machine"],
    "bass": ["bass", "bass guitar", "sub bass"],
    "strings": ["violin", "cello", "orchestral strings", "string section"]
}


class TaxonomyNormalizer:
    def __init__(self):
        self.mapping = {}
        self.tag_categories = {}
        self._build_maps()

    def _build_maps(self):
        for canonical, aliases in CANONICAL_GENRES.items():
            self.tag_categories[canonical] = "genre"
            for alias in aliases:
                self.mapping[alias.lower()] = canonical

        for canonical, aliases in CANONICAL_MOODS.items():
            self.tag_categories[canonical] = "mood"
            for alias in aliases:
                self.mapping[alias.lower()] = canonical

        for canonical, aliases in CANONICAL_INSTRUMENTS.items():
            self.tag_categories[canonical] = "instrument"
            for alias in aliases:
                self.mapping[alias.lower()] = canonical

    def normalize_tag(self, raw_tag: str) -> str:
        clean = raw_tag.strip().lower()
        return self.mapping.get(clean, clean)

    def normalize_tags(self, raw_tags: List[str]) -> List[str]:
        result = set()
        for t in raw_tags:
            norm = self.normalize_tag(t)
            result.add(norm)
        return list(result)

    def get_category(self, tag: str) -> str:
        return self.tag_categories.get(tag.lower(), "genre")