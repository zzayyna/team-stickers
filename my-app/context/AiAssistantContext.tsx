import React, { createContext, useContext, useMemo, useState } from 'react';

type AiAssistantContextValue = {
  isAiEnabled: boolean;
  hasAcceptedPrivacy: boolean;
  enableAi: () => void;
  disableAi: () => void;
  acceptPrivacy: () => void;
  resetPrivacyReview: () => void;
};

const AiAssistantContext = createContext<AiAssistantContextValue | undefined>(undefined);

export function AiAssistantProvider({ children }: { children: React.ReactNode }) {
  const [isAiEnabled, setIsAiEnabled] = useState(true);
  const [hasAcceptedPrivacy, setHasAcceptedPrivacy] = useState(false);

  const value = useMemo<AiAssistantContextValue>(
    () => ({
      isAiEnabled,
      hasAcceptedPrivacy,
      enableAi: () => {
        setIsAiEnabled(true);
        setHasAcceptedPrivacy(false);
      },
      disableAi: () => {
        setIsAiEnabled(false);
        setHasAcceptedPrivacy(false);
      },
      acceptPrivacy: () => {
        setIsAiEnabled(true);
        setHasAcceptedPrivacy(true);
      },
      resetPrivacyReview: () => {
        setHasAcceptedPrivacy(false);
      },
    }),
    [hasAcceptedPrivacy, isAiEnabled]
  );

  return <AiAssistantContext.Provider value={value}>{children}</AiAssistantContext.Provider>;
}

export function useAiAssistant() {
  const context = useContext(AiAssistantContext);
  if (!context) {
    throw new Error('useAiAssistant must be used inside AiAssistantProvider');
  }
  return context;
}
