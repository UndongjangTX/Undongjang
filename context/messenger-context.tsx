"use client";

import * as React from "react";

type MessengerContextValue = {
  openConversationId: string | null;
  setOpenConversationId: (id: string | null) => void;
  openWidget: (conversationId: string) => void;
  closeWidget: () => void;
};

const MessengerContext = React.createContext<MessengerContextValue | null>(null);

export function MessengerProvider({ children }: { children: React.ReactNode }) {
  const [openConversationId, setOpenConversationId] = React.useState<string | null>(null);
  const openWidget = React.useCallback((id: string) => setOpenConversationId(id), []);
  const closeWidget = React.useCallback(() => setOpenConversationId(null), []);
  const value = React.useMemo(
    () => ({ openConversationId, setOpenConversationId, openWidget, closeWidget }),
    [openConversationId, openWidget, closeWidget]
  );
  return (
    <MessengerContext.Provider value={value}>
      {children}
    </MessengerContext.Provider>
  );
}

export function useMessenger() {
  const ctx = React.useContext(MessengerContext);
  if (!ctx) throw new Error("useMessenger must be used within MessengerProvider");
  return ctx;
}
