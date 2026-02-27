"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getConversationById, getMessages, sendMessage, markConversationRead, type MessageWithSender } from "@/lib/messenger";
import { getCurrentUserProfile } from "@/lib/user-profile";
import { useMessenger } from "@/context/messenger-context";

export function MessengerWidget() {
  const { openConversationId, closeWidget } = useMessenger();
  const [conversation, setConversation] = React.useState<Awaited<ReturnType<typeof getConversationById>>>(null);
  const [messages, setMessages] = React.useState<MessageWithSender[]>([]);
  const [nextCursor, setNextCursor] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null);
  const [input, setInput] = React.useState("");
  const listRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!openConversationId) {
      setConversation(null);
      setMessages([]);
      setNextCursor(null);
      return;
    }
    setLoading(true);
    Promise.all([
      getConversationById(openConversationId),
      getMessages(openConversationId),
      getCurrentUserProfile(),
    ]).then(([conv, { messages: msgs, nextCursor: cursor }, profile]) => {
      setConversation(conv);
      setMessages(msgs);
      setNextCursor(cursor);
      setCurrentUserId(profile?.id ?? null);
      setLoading(false);
      if (profile?.id) markConversationRead(profile.id, openConversationId);
    });
  }, [openConversationId]);

  async function loadMore() {
    if (!openConversationId || !nextCursor) return;
    const { messages: older, nextCursor: cursor } = await getMessages(openConversationId, { cursor: nextCursor });
    setMessages((prev) => [...older, ...prev]);
    setNextCursor(cursor);
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || !openConversationId || !currentUserId || sending) return;
    setSending(true);
    setInput("");
    const result = await sendMessage(openConversationId, currentUserId, text);
    setSending(false);
    if (result.ok) {
      const profile = await getCurrentUserProfile();
      setMessages((prev) => [
        ...prev,
        {
          id: result.messageId,
          conversation_id: openConversationId,
          sender_id: currentUserId,
          content: text,
          created_at: new Date().toISOString(),
          sender_name: profile?.full_name ?? null,
        },
      ]);
    }
  }

  if (!openConversationId) return null;

  const title = conversation
    ? conversation.group_name
      ? `Organizers of ${conversation.group_name}`
      : conversation.event_title
        ? `Organizers of ${conversation.event_title}`
        : "Conversation"
    : "…";

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col w-[380px] max-h-[520px] rounded-2xl border bg-card shadow-lg">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b">
        <span className="font-semibold text-sm truncate">{title}</span>
        <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" onClick={closeWidget} aria-label="Close">
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div ref={listRef} className="flex-1 overflow-y-auto min-h-[200px] max-h-[320px] p-3 space-y-2">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            {nextCursor && (
              <Button variant="ghost" size="sm" className="w-full text-xs" onClick={loadMore}>
                Load older messages
              </Button>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={`text-sm ${m.sender_id === currentUserId ? "text-right" : "text-left"}`}
              >
                <span className="text-muted-foreground text-xs">{m.sender_name ?? "Someone"}</span>
                <p className="mt-0.5 break-words">{m.content}</p>
              </div>
            ))}
          </>
        )}
      </div>
      <form onSubmit={handleSend} className="p-3 border-t flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message…"
          className="flex-1 min-w-0 rounded-full border bg-background px-4 py-2 text-sm"
          disabled={!currentUserId || sending}
        />
        <Button type="submit" size="sm" variant="green" disabled={!input.trim() || sending}>
          Send
        </Button>
      </form>
    </div>
  );
}
