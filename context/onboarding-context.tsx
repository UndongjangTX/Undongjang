"use client";

import * as React from "react";

export type OnboardingSource =
  | "post_signup"
  | "start_group"
  | "start_event"
  | "join_group"
  | "join_event";

type OnboardingContextValue = {
  openModal: (options: {
    source: OnboardingSource;
    onComplete?: () => void;
  }) => void;
  closeModal: () => void;
  programmaticOpen: boolean;
  programmaticSource: OnboardingSource | null;
};

const OnboardingContext = React.createContext<OnboardingContextValue | null>(
  null
);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [programmaticOpen, setProgrammaticOpen] = React.useState(false);
  const [programmaticSource, setProgrammaticSource] =
    React.useState<OnboardingSource | null>(null);
  const onCompleteRef = React.useRef<(() => void) | null>(null);

  const openModal = React.useCallback(
    (options: { source: OnboardingSource; onComplete?: () => void }) => {
      onCompleteRef.current = options.onComplete ?? null;
      setProgrammaticSource(options.source);
      setProgrammaticOpen(true);
    },
    []
  );

  const closeModal = React.useCallback(() => {
    const cb = onCompleteRef.current;
    onCompleteRef.current = null;
    setProgrammaticOpen(false);
    setProgrammaticSource(null);
    cb?.();
  }, []);

  const value = React.useMemo(
    () => ({
      openModal,
      closeModal,
      programmaticOpen,
      programmaticSource,
    }),
    [openModal, closeModal, programmaticOpen, programmaticSource]
  );

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
}

const defaultValue: OnboardingContextValue = {
  openModal: () => {},
  closeModal: () => {},
  programmaticOpen: false,
  programmaticSource: null,
};

export function useOnboarding() {
  const ctx = React.useContext(OnboardingContext);
  return ctx ?? defaultValue;
}
