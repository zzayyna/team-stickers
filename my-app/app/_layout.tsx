import { Stack, Redirect, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { AiAssistantProvider } from '../context/AiAssistantContext';
import { PatientProfileProvider } from '../context/PatientProfileContext';
import { IntakeProvider } from '../context/IntakeContext';
import { supabase } from '../lib/supabase';

function AuthGate() {
  const [loading, setLoading] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const segments = useSegments();

  useEffect(() => {
    const loadSession = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        console.error('Error checking session:', error);
      }

      setHasSession(!!data.session);
      setLoading(false);
    };

    loadSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('AUTH CHANGE:', session);
      setHasSession(!!session);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  if (loading) return null;

  const inAuthGroup = segments[0] === '(auth)';
  console.log('segments:', segments, 'hasSession:', hasSession, 'inAuthGroup:', inAuthGroup);

  if (!hasSession && !inAuthGroup) {
    return <Redirect href="/(auth)/login" />;
  }

  if (hasSession && inAuthGroup) {
    return <Redirect href="/" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AiAssistantProvider>
      <PatientProfileProvider>
        <IntakeProvider>
          <AuthGate />
        </IntakeProvider>
      </PatientProfileProvider>
    </AiAssistantProvider>
  );
}
