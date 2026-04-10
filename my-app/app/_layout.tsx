import { Slot } from 'expo-router';
import { AiAssistantProvider } from '../context/AiAssistantContext';
import { PatientProfileProvider } from '../context/PatientProfileContext';
import { IntakeProvider } from '../context/IntakeContext';

export default function RootLayout() {
  return (
    <AiAssistantProvider>
      <PatientProfileProvider>
        <IntakeProvider>
          <Slot />
        </IntakeProvider>
      </PatientProfileProvider>
    </AiAssistantProvider>
  );
}
