/**
 * Global Audio Player State (Zustand)
 * 
 * Persists across page navigations in Next.js App Router.
 * Usage:
 *   const { play, pause, currentTrack, isPlaying } = usePlayerStore();
 *   play({ id: 1, title: "Song", artist: "Artist", url: "/audio.mp3" });
 */
import { create } from 'zustand';

export interface Track {
  id: number;
  title: string;
  artist: string;
  url: string;
  coverUrl?: string;
  duration?: number; // in seconds
}

interface PlayerState {
  // Current state
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isShuffled: boolean;
  repeatMode: 'off' | 'one' | 'all';
  
  // Queue
  queue: Track[];
  queueIndex: number;
  
  // Audio element ref (managed externally)
  audioRef: HTMLAudioElement | null;
  
  // Actions
  setAudioRef: (ref: HTMLAudioElement | null) => void;
  play: (track?: Track) => void;
  pause: () => void;
  toggle: () => void;
  stop: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  next: () => void;
  previous: () => void;
  addToQueue: (track: Track) => void;
  clearQueue: () => void;
  playQueue: (tracks: Track[], startIndex?: number) => void;
  
  // Internal state updates
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setIsPlaying: (isPlaying: boolean) => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  // Initial state
  currentTrack: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 0.7,
  isMuted: false,
  isShuffled: false,
  repeatMode: 'off',
  queue: [],
  queueIndex: -1,
  audioRef: null,
  
  // Set audio element reference
  setAudioRef: (ref) => set({ audioRef: ref }),
  
  // Play a track (or resume current)
  play: (track) => {
    const state = get();
    const audio = state.audioRef;

    if (track) {
      if (state.currentTrack?.id === track.id) {
        // Same track already loaded — resume in place rather than
        // reassigning audio.src, which resets playback to 0 even when the
        // URL is unchanged (that's how HTMLMediaElement.src works: any
        // assignment re-triggers the resource selection algorithm).
        if (audio) audio.play().catch(console.error);
        set({ isPlaying: true });
        return;
      }
      // Play new track
      set({
        currentTrack: track,
        isPlaying: true,
        currentTime: 0,
      });

      if (audio) {
        audio.src = track.url;
        audio.play().catch(console.error);
      }
    } else if (state.currentTrack && audio) {
      // Resume current track
      audio.play().catch(console.error);
      set({ isPlaying: true });
    }
  },
  
  // Pause playback
  pause: () => {
    const audio = get().audioRef;
    if (audio) {
      audio.pause();
    }
    set({ isPlaying: false });
  },
  
  // Toggle play/pause
  toggle: () => {
    const state = get();
    if (state.isPlaying) {
      state.pause();
    } else {
      state.play();
    }
  },
  
  // Stop playback completely
  stop: () => {
    const audio = get().audioRef;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    set({ 
      isPlaying: false, 
      currentTime: 0,
      currentTrack: null,
    });
  },
  
  // Seek to position
  seek: (time) => {
    const audio = get().audioRef;
    if (audio) {
      audio.currentTime = time;
    }
    set({ currentTime: time });
  },
  
  // Set volume (0-1)
  setVolume: (volume) => {
    const audio = get().audioRef;
    if (audio) {
      audio.volume = volume;
    }
    set({ volume, isMuted: volume === 0 });
  },
  
  // Toggle mute
  toggleMute: () => {
    const state = get();
    const audio = state.audioRef;
    const newMuted = !state.isMuted;
    
    if (audio) {
      audio.muted = newMuted;
    }
    set({ isMuted: newMuted });
  },
  
  // Toggle shuffle
  toggleShuffle: () => {
    set((state) => ({ isShuffled: !state.isShuffled }));
  },
  
  // Cycle repeat mode: off -> all -> one -> off
  cycleRepeat: () => {
    set((state) => {
      const modes: Array<'off' | 'one' | 'all'> = ['off', 'all', 'one'];
      const currentIndex = modes.indexOf(state.repeatMode);
      return { repeatMode: modes[(currentIndex + 1) % 3] };
    });
  },
  
  // Play next track in queue
  next: () => {
    const state = get();
    const { queue, queueIndex, repeatMode, isShuffled } = state;
    
    if (queue.length === 0) return;
    
    let nextIndex = queueIndex + 1;
    
    if (isShuffled) {
      nextIndex = Math.floor(Math.random() * queue.length);
    }
    
    if (nextIndex >= queue.length) {
      if (repeatMode === 'all') {
        nextIndex = 0;
      } else {
        // End of queue
        set({ isPlaying: false });
        return;
      }
    }
    
    const nextTrack = queue[nextIndex];
    set({ queueIndex: nextIndex });
    get().play(nextTrack);
  },
  
  // Play previous track
  previous: () => {
    const state = get();
    const { queue, queueIndex, currentTime } = state;
    
    // If more than 3 seconds in, restart current track
    if (currentTime > 3) {
      state.seek(0);
      return;
    }
    
    if (queue.length === 0 || queueIndex <= 0) return;
    
    const prevIndex = queueIndex - 1;
    const prevTrack = queue[prevIndex];
    set({ queueIndex: prevIndex });
    get().play(prevTrack);
  },
  
  // Add track to end of queue
  addToQueue: (track) => {
    set((state) => ({ queue: [...state.queue, track] }));
  },
  
  // Clear queue
  clearQueue: () => {
    set({ queue: [], queueIndex: -1 });
  },
  
  // Play a list of tracks starting from index
  playQueue: (tracks, startIndex = 0) => {
    set({ 
      queue: tracks, 
      queueIndex: startIndex,
    });
    const track = tracks[startIndex];
    if (track) {
      get().play(track);
    }
  },
  
  // Internal: update current time (called from audio events)
  setCurrentTime: (time) => set({ currentTime: time }),
  
  // Internal: update duration (called from audio events)
  setDuration: (duration) => set({ duration }),
  
  // Internal: update playing state (called from audio events)
  setIsPlaying: (isPlaying) => set({ isPlaying }),
}));


// Convenience hook for common player actions
export function usePlayer() {
  const store = usePlayerStore();
  
  return {
    // State
    currentTrack: store.currentTrack,
    isPlaying: store.isPlaying,
    currentTime: store.currentTime,
    duration: store.duration,
    volume: store.volume,
    isMuted: store.isMuted,
    
    // Quick actions
    play: store.play,
    pause: store.pause,
    toggle: store.toggle,
    next: store.next,
    previous: store.previous,
    seek: store.seek,
    setVolume: store.setVolume,
    
    // Play a single track
    playTrack: (track: Track) => {
      store.clearQueue();
      store.addToQueue(track);
      store.playQueue([track], 0);
    },
    
    // Play multiple tracks (album/playlist)
    playTracks: (tracks: Track[], startIndex = 0) => {
      store.playQueue(tracks, startIndex);
    },
  };
}
