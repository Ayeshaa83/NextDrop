import json
import os
import numpy as np

INSIGHT_TEMPLATES = [
    {
        "type": "VIRAL_UGC_DRIVEN",
        "category": "platform_dynamics",
        "headline": "TikTok UGC Explosion Driving Stream Spikes",
        "explanation": "Streams jumped {wow_growth:.0%} week-over-week, directly fueled by a {wow_ugc:.0%} surge in short-form UGC creations.",
        "tip": "Capitalize on social traction: pin top viral clips to your profile and run a targeted TikTok ad campaign."
    },
    {
        "type": "BREAKOUT_MOMENTUM",
        "category": "growth_trajectory",
        "headline": "Breakout Stream Velocity Across Platforms",
        "explanation": "Stream volume accelerated by {wow_growth:.0%} week-over-week with strong multi-platform adoption.",
        "tip": "Submit the track for official editorial playlist consideration and increase digital marketing budget."
    },
    {
        "type": "HIGH_RETENTION_PASSION",
        "category": "engagement_quality",
        "headline": "Exceptional Listener Library Save Rate",
        "explanation": "Outstanding listener loyalty with a {save_rate:.1%} save rate (significantly above industry averages).",
        "tip": "Your audience loves this track. Target these engaged fans with direct merch and tour announcements."
    }
]


def generate_dataset(output_path: str = "data/insights_sft_dataset.jsonl", num_samples: int = 1000):
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    np.random.seed(42)
    entries = []

    for _ in range(num_samples):
        tpl = np.random.choice(INSIGHT_TEMPLATES)
        
        wow_growth = np.random.uniform(0.35, 1.80)
        wow_ugc = np.random.uniform(0.50, 2.50)
        save_rate = np.random.uniform(0.05, 0.15)
        
        metrics = {
            "wow_stream_growth": round(wow_growth, 3),
            "wow_ugc_growth": round(wow_ugc, 3),
            "save_rate_current": round(save_rate, 3)
        }

        explanation = tpl["explanation"].format(
            wow_growth=wow_growth,
            wow_ugc=wow_ugc,
            save_rate=save_rate
        )

        system_msg = "You are NextDrop's AI Music Strategist. Convert analytics metrics into a concise, professional headline, explanation, and actionable strategy tip in valid JSON."
        
        user_msg = f"Track Title: 'Neon Drive'\nInsight Type: {tpl['type']}\nCategory: {tpl['category']}\nMetrics: {json.dumps(metrics)}"

        assistant_msg = json.dumps({
            "headline": tpl["headline"],
            "explanation_nl": explanation,
            "actionable_tip": tpl["tip"]
        })

        entry = {
            "messages": [
                {"role": "system", "content": system_msg},
                {"role": "user", "content": user_msg},
                {"role": "assistant", "content": assistant_msg}
            ]
        }
        entries.append(entry)

    with open(output_path, "w", encoding="utf-8") as f:
        for entry in entries:
            f.write(json.dumps(entry) + "\n")

    print(f"Generated {num_samples} SFT dataset samples -> '{output_path}'")


if __name__ == "__main__":
    generate_dataset()