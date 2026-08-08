# backend/ml/insights/feature_extraction.py
import numpy as np
from typing import Dict
from .schemas import TrackAnalyticsTimeSeries


class AnalyticsFeatureExtractor:
    """Extracts time-series summary features including SMA (Simple Moving Average) metrics."""

    def extract_features(self, time_series: TrackAnalyticsTimeSeries) -> Dict[str, float]:
        weeks = sorted(time_series.weekly_data, key=lambda w: w.week_index)
        
        if len(weeks) < 2:
            raise ValueError("Time-series requires at least 2 weekly data points.")

        w0 = weeks[0]  # Current week
        w1 = weeks[1]  # Last week
        w2 = weeks[min(2, len(weeks) - 1)]
        w3 = weeks[min(3, len(weeks) - 1)]

        stream_values = [w.streams for w in weeks[:4]]

        # 1. Calculate Simple Moving Averages (SMA)
        sma_2w = float(np.mean(stream_values[:2]))  # 2-Week Short SMA
        sma_4w = float(np.mean(stream_values[:4]))  # 4-Week Long SMA

        # SMA Trend Ratio (Short SMA / Long SMA)
        # > 1.20 = Accelerating Momentum | < 0.80 = Decelerating Decay
        sma_ratio = sma_2w / max(1.0, sma_4w)

        # 2. Existing Growth Rates & Ratios
        wow_stream_growth = (w0.streams - w1.streams) / max(1, w1.streams)
        mow_stream_growth = (w0.streams - w3.streams) / max(1, w3.streams)
        wow_save_growth = (w0.saves - w1.saves) / max(1, w1.saves)
        wow_ugc_growth = (w0.ugc_count - w1.ugc_count) / max(1, w1.ugc_count)
        
        save_rate_current = w0.saves / max(1, w0.streams)
        save_rate_prev = w1.saves / max(1, w1.streams)
        top_platform_share = max(w0.platform_shares.values()) if w0.platform_shares else 0.0

        return {
            "current_streams": float(w0.streams),
            "sma_2w": sma_2w,
            "sma_4w": sma_4w,
            "sma_ratio": float(sma_ratio),  # <--- NEW SMA FEATURE
            "wow_stream_growth": float(wow_stream_growth),
            "mow_stream_growth": float(mow_stream_growth),
            "wow_save_growth": float(wow_save_growth),
            "wow_ugc_growth": float(wow_ugc_growth),
            "save_rate_current": float(save_rate_current),
            "save_rate_change": float(save_rate_current - save_rate_prev),
            "ugc_per_1k_streams": float((w0.ugc_count / max(1, w0.streams)) * 1000.0),
            "playlist_add_conversion": float(w0.playlist_adds / max(1, w0.streams)),
            "stream_slope_normalized": float((sma_2w - sma_4w) / max(1, sma_4w)),
            "top_platform_share": float(top_platform_share)
        }