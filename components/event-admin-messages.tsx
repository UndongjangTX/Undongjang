"use client";

import * as React from "react";
import {
  getConversationsForEvent,
  getConversationById,
  getMessages,
  sendMessage,
  markConversationRead,
  type OrganizerConversationItem,
  type MessageWithSender,
} from "@/lib/messenger";
import { getCurrentUserProfile } from "@/lib/user-profile";
import { useMessenger } from "@/context/messenger-context";
import { t } from "@/lib/i18n";

export function EventAdminMessages({ eventId }: { eventId: string }) {
  const { openWidget } = useMessenger();
  const [conversations, setConversations] = React.useState<OrganizerConversationItem[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [conversation, setConversation] = React.useState<Awaited<ReturnType<typeof getConversationById>>>(null);
  const [messages, setMessages] = React.useState<MessageWithSender[]>([]);
  const [nextCursor, setNextCursor] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [threadLoading, setThreadLoading] = React.useState(false);
  const [userId, setUserId] = React.useState<string | null>(null);
  const [sending, setSending] = React.useState(false);
  const [input, setInput] = React.useState("");

  React.useEffect(() => {
    getConversationsForEvent(eventId).then((list) => {
      setConversations(list);
      setLoading(false);
    });
    getCurrentUserProfile().then((p) => setUserId(p?.id ?? null));
  }, [eventId]);

  React.useEffect(() => {
    if (!selectedId) {
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
        if (userId) markConversationRead(userId, selectedId);
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

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">{t("eventAdminPage.messages")}</h2>
      <p className="text-sm text-muted-foreground">
        {t("eventAdminPage.messagesDescription")}
      </p>
      {loading ? (
        <p className="text-muted-foreground">{t("eventAdminPage.loading")}</p>
      ) : conversations.length === 0 ? (
        <p className="text-muted-foreground">{t("admin.noConversationsYet")}</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-4">
          <ul className="border rounded-2xl divide-y max-h-[50vh] overflow-y-auto">
            {conversations.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(c.id)}
                  className={`w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors ${selectedId === c.id ? "bg-primary-green/10" : ""}`}
                >
                  <p className="font-medium text-sm">{c.member_name ?? t("eventAdminPage.someone")}</p>
                  {c.last_message_preview && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{c.last_message_preview}</p>
                  )}
                </button>
              </li>
            ))}
          </ul>
          <div className="border rounded-2xl flex flex-col min-h-[320px]">
            {!selectedId ? (
              <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm p-6">
                {t("eventAdminPage.selectConversation")}
              </div>
            ) : (
              <>
                <div className="px-4 py-3 border-b flex items-center justify-between">
                  <span className="font-medium text-sm">{conversation?.member_name ?? "…"}</span>
                  <button
                    type="button"
                    onClick={() => openWidget(selectedId)}
                    className="text-xs text-primary-green hover:underline"
                  >
                    {t("eventAdminPage.openInWidget")}
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-[160px]">
                  {threadLoading ? (
                    <p className="text-sm text-muted-foreground">{t("eventAdminPage.loading")}</p>
                  ) : (
                    <>
                      {nextCursor && (
                        <button type="button" onClick={loadMore} className="text-xs text-primary-green hover:underline">
                          {t("eventAdminPage.loadOlder")}
                        </button>
                      )}
                      {messages.map((m) => (
                        <div
                          key={m.id}
                          className={`text-sm ${m.sender_id === userId ? "text-right" : "text-left"}`}
                        >
                          <span className="text-muted-foreground text-xs">{m.sender_name ?? t("eventAdminPage.someone")}</span>
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
                    placeholder={t("eventAdminPage.typeMessagePlaceholder")}
                    className="flex-1 min-w-0 rounded-full border bg-background px-4 py-2 text-sm"
                    disabled={sending}
                  />
                  <button
                    type="submit"
                    className="rounded-full bg-primary-green text-primary-green-foreground px-4 py-2 text-sm font-medium disabled:opacity-50"
                    disabled={!input.trim() || sending}
                  >
                    {t("eventAdminPage.send")}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
