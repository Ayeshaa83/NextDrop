'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Music2, PlayCircle, Users, Activity, Loader2 } from 'lucide-react';
import { spotifyApi, SpotifyTopItemsResponse } from '@/lib/api';

export default function SpotifyAnalyticsPanel() {
    const [topTracks, setTopTracks] = useState<SpotifyTopItemsResponse | null>(null);
    const [topArtists, setTopArtists] = useState<SpotifyTopItemsResponse | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSpotifyData = async () => {
            try {
                const [tracks, artists] = await Promise.all([
                    spotifyApi.getTopTracks(5, 'short_term'),
                    spotifyApi.getTopArtists(5, 'short_term')
                ]);
                setTopTracks(tracks);
                setTopArtists(artists);
            } catch (err) {
                console.error("Failed to fetch Spotify analytics:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchSpotifyData();
    }, []);

    if (loading) {
        return (
            <div className="card-premium p-8 flex flex-col items-center justify-center min-h-[300px]">
                <Loader2 className="size-8 text-[#1DB954] animate-spin mb-4" />
                <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Loading Spotify Insights...</p>
            </div>
        );
    }

    if (!topTracks || !topArtists) {
        return null; // Or show error state
    }

    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card-premium p-8 border border-white/5 relative overflow-hidden"
        >
            <div className="absolute top-0 right-0 p-32 bg-[#1DB954]/5 rounded-full blur-[100px] pointer-events-none" />
            
            <div className="flex items-center gap-3 mb-8">
                <div className="size-10 rounded-xl bg-[#1DB954]/10 border border-[#1DB954]/20 flex items-center justify-center">
                    <Music2 className="size-5 text-[#1DB954]" />
                </div>
                <div>
                    <h2 className="text-xl font-black text-white">Spotify Insights</h2>
                    <p className="text-xs font-medium text-slate-400">Your listener profile based on recent activity</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Top Tracks */}
                <div>
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 flex items-center gap-2 mb-4">
                        <PlayCircle className="size-4" /> Top Tracks (Last 4 Weeks)
                    </h3>
                    <div className="space-y-3">
                        {topTracks.items.map((track, i) => (
                            <div key={track.id} className="flex items-center gap-3 group">
                                <span className="text-xs font-black text-slate-600 w-4 text-center">{i + 1}</span>
                                {track.album && (track.album as any).images?.[0] && (
                                    <img 
                                        src={(track.album as any).images[0].url} 
                                        className="size-10 rounded-md object-cover"
                                        alt="album art" 
                                    />
                                )}
                                <div>
                                    <p className="text-sm font-bold text-white group-hover:text-[#1DB954] transition-colors line-clamp-1">{track.name}</p>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 line-clamp-1">
                                        {(track.artists as any[])?.map(a => a.name).join(', ')}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Top Artists */}
                <div>
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 flex items-center gap-2 mb-4">
                        <Users className="size-4" /> Top Artists (Last 4 Weeks)
                    </h3>
                    <div className="space-y-3">
                        {topArtists.items.map((artist, i) => (
                            <div key={artist.id} className="flex items-center gap-3 group">
                                <span className="text-xs font-black text-slate-600 w-4 text-center">{i + 1}</span>
                                {(artist.images as any[])?.[0] ? (
                                    <img 
                                        src={(artist.images as any)[0].url} 
                                        className="size-10 rounded-full object-cover"
                                        alt="artist profile" 
                                    />
                                ) : (
                                    <div className="size-10 rounded-full bg-slate-800 flex items-center justify-center">
                                        <Users className="size-4 text-slate-500" />
                                    </div>
                                )}
                                <div>
                                    <p className="text-sm font-bold text-white group-hover:text-[#1DB954] transition-colors">{artist.name}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1">
                                            <Activity className="size-3" /> {(artist.popularity as number)} Popularity
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
