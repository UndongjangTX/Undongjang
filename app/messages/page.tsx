"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/user-profile";
import {
  getConversationsForUser,
  getConversationById,
  getMessages,
  sendMessage,
  markConversationRead,
  type ConversationListItem,
  type MessageWithSender,
} from "@/lib/messenger";
import { t } from "@/lib/i18n";

export default function MessagesPage() {
  const router = useRouter();
  const [userId, setUserId] = React.useState<string | null>(null);
  const [conversations, setConversations] = React.useState<ConversationListItem[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [conversation, setConversation] = React.useState<Awaited<ReturnType<typeof getConversationById>>>(null);
  const [messages, setMessages] = React.useState<MessageWithSender[]>([]);
  const [nextCursor, setNextCursor] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [threadLoading, setThreadLoading] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [input, setInput] = React.useState("");

  React.useEffect(() => {
    getCurrentUserProfile().then((profile) => {
      if (!profile?.id) {
        router.replace("/login?redirect=/messages");
        return;
      }
      setUserId(profile.id);
      getConversationsForUser(profile.id).then((list) => {
        setConversations(list);
        setLoading(false);
      });
    });
  }, [router]);

  React.useEffect(() => {
    if (!selectedId || !userId) {
      setConversation(null);
      setMessages([]);
      setNextCursor(null);
      return;
    }
    setThreadLoading(true);
    Promise.all([getConversationById(selectedId), getMessages(selectedId)]).then(
      ([conv, { messages: msgs, nextCursor: cursor }]) => {
        setConversation(conv);
        setMessages(msgs);
        setNextCursor(cursor);
        setThreadLoading(false);
        markConversationRead(userId, selectedId);
      }
    );
  }, [selectedId, userId]);

  async function loadMore() {
    if (!selectedId || !nextCursor) return;
    const { messages: older, nextCursor: cursor } = await getMessages(selectedId, { cursor: nextCursor });
    setMessages((prev) => [...older, ...prev]);
    setNextCursor(cursor);
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || !selectedId || !userId || sending) return;
    setSending(true);
    setInput("");
    const result = await sendMessage(selectedId, userId, text);
    setSending(false);
    if (result.ok) {
      const profile = await getCurrentUserProfile();
      setMessages((prev) => [
        ...prev,
        {
          id: result.messageId,
          conversation_id: selectedId,
          sender_id: userId,
          content: text,
          created_at: new Date().toISOString(),
          sender_name: profile?.full_name ?? null,
        },
      ]);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <p className="text-muted-foreground">{t("common.loading")}</p>
      </main>
    );
  }

  const title = conversation
    ? conversation.group_name
      ? `${t("messenger.organizersOf")} ${conversation.group_name}`
      : conversation.event_title
        ? `${t("messenger.organizersOf")} ${conversation.event_title}`
        : t("messenger.conversation")
    : "";

  return (
    <main className="min-h-screen container px-4 py-6 md:py-8">
      <h1 className="font-heading text-xl font-semibold mb-4">{t("messenger.messages")}</h1>
      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4 max-w-4xl">
        <ul className="border rounded-2xl divide-y max-h-[60vh] overflow-y-auto">
          {conversations.length === 0 ? (
            <li className="p-4 text-sm text-muted-foreground">{t("messenger.noConversations")}</li>
          ) : (
            conversations.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(c.id)}
                  className={`w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors ${selectedId === c.id ? "bg-primary-green/10" : ""}`}
                >
                  <p className="font-medium text-sm truncate">{c.label}</p>
                  {c.last_message_preview && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{c.last_message_preview}</p>
                  )}
                </button>
              </li>
            ))
          )}
        </ul>
        <div className="border rounded-2xl flex flex-col min-h-[400px]">
          {!selectedId ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm p-6">
              {t("messenger.selectConversation")}
            </div>
          ) : (
            <>
              <div className="px-4 py-3 border-b font-medium text-sm">{title}</div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-[200px]">
                {threadLoading ? (
                  <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
                ) : (
                  <>
                    {nextCursor && (
                      <button
                        type="button"
                        onClick={loadMore}
                        className="text-xs text-primary-green hover:underline"
                      >
                        {t("admin.loadOlder")}
                      </button>
                    )}
                    {messages.map((m) => (
                      <div
                        key={m.id}
                        className={`text-sm ${m.sender_id === userId ? "text-right" : "text-left"}`}
                      >
                        <span className="text-muted-foreground text-xs">{m.sender_name ?? t("common.someone")}</span>
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
                  placeholder={t("admin.typeMessage")}
                  className="flex-1 min-w-0 rounded-full border bg-background px-4 py-2 text-sm"
                  disabled={sending}
                />
                <button
                  type="submit"
                  className="rounded-full bg-primary-green text-primary-green-foreground px-4 py-2 text-sm font-medium disabled:opacity-50"
                  disabled={!input.trim() || sending}
                >
                  {t("common.send")}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
