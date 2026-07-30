'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { socialApi, CollabMessage } from '@/lib/api';

const POLL_MS = 4000;

export default function CollabChat({
    collaborationId,
    otherArtistName,
    onClose,
}: {
    collaborationId: number;
    otherArtistName: string;
    onClose: () => void;
}) {
    const [messages, setMessages] = useState<CollabMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);

    const load = useCallback(async () => {
        try {
            const page = await socialApi.getCollabMessages(collaborationId);
            setMessages(page.items);
        } catch {
            // non-fatal — will retry on next poll
        } finally {
            setLoading(false);
        }
    }, [collaborationId]);

    useEffect(() => {
        load();
        const id = setInterval(load, POLL_MS);
        return () => clearInterval(id);
    }, [load]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async () => {
        const content = input.trim();
        if (!content || sending) return;
        setSending(true);
        setInput('');
        try {
            const msg = await socialApi.sendCollabMessage(collaborationId, content);
            setMessages((prev) => [...prev, msg]);
        } catch {
            setInput(content);
        } finally {
            setSending(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-end bg-black/70 backdrop-blur-sm"
            onClick={onClose}
        >
            <motion.div
                initial={{ x: 40, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 40, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="h-full w-full max-w-md bg-[#0a0a0b] border-l border-white/10 shadow-2xl flex flex-col"
            >
                <div className="p-5 flex items-center justify-between border-b border-white/5 shrink-0">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Collab Chat</p>
                        <h3 className="text-lg font-black text-white">{otherArtistName}</h3>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
                        <X className="size-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-3">
                    {loading ? (
                        <div className="flex items-center justify-center h-full">
                            <Loader2 className="size-6 text-primary animate-spin" />
                        </div>
                    ) : messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center gap-2">
                            <p className="text-sm text-slate-500 font-medium">No messages yet.</p>
                            <p className="text-xs text-slate-600">Say hi to {otherArtistName} and get the collab moving.</p>
                        </div>
                    ) : (
                        <AnimatePresence initial={false}>
                            {messages.map((m) => (
                                <motion.div
                                    key={m.id}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={cn('flex', m.is_mine ? 'justify-end' : 'justify-start')}
                                >
                                    <div
                                        className={cn(
                                            'max-w-[75%] px-4 py-2.5 rounded-2xl text-sm font-medium',
                                            m.is_mine
                                                ? 'bg-primary text-white rounded-br-sm'
                                                : 'bg-white/5 border border-white/10 text-slate-200 rounded-bl-sm'
                                        )}
                                    >
                                        {m.content}
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    )}
                    <div ref={bottomRef} />
                </div>

                <div className="p-4 border-t border-white/5 flex items-center gap-3 shrink-0">
                    <input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="Type a message..."
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary/50"
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || sending}
                        className="size-11 rounded-xl bg-primary text-white flex items-center justify-center hover:scale-105 transition-transform active:scale-95 disabled:opacity-40 disabled:hover:scale-100 shrink-0"
                    >
                        {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
}
