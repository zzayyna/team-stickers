import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAiAssistant } from '../../context/AiAssistantContext';
import { type RelevantVisitField, useIntake } from '../../context/IntakeContext';
import { usePatientProfile } from '../../context/PatientProfileContext';

type Message = {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  plainLanguageDefinition?: string;
  whyWeAreAsking?: string;
};

type AgentSection = 'visit_context' | 'patient_information' | 'insurance_information' | 'medical_history';

type AgentResponse = {
  mode: 'intake_question' | 'clarification_needed' | 'form_review';
  display_message: string;
  plain_language_definition: string;
  why_we_are_asking: string;
  current_focus_label: string;
  patient_information?: {
    full_name?: string;
    date_of_birth?: string;
    phone_number?: string;
    email?: string;
    address?: string;
    source_note?: string;
  };
  insurance_information?: {
    provider_name?: string;
    member_id?: string;
    group_number?: string;
    source_note?: string;
  };
  medical_history?: {
    allergies?: string;
    current_medications?: string;
    past_surgeries_or_hospitalizations?: string;
    family_history?: string;
    source_note?: string;
  };
  visit_context: {
    section_title: string;
    section_subtitle: string;
    visit_category: string;
    chief_concern: string;
    summary_for_clinician: string;
    relevant_fields: RelevantVisitField[];
    source_note?: string;
  };
  additional_concerns?: {
    patient_notes?: string;
    ai_drafted_notes?: string;
  };
};

const DEFAULT_HELPER = {
  plainLanguageDefinition: 'This assistant helps organize a visit-specific intake summary from your own words.',
  whyWeAreAsking: 'The care team gets a cleaner, more relevant draft when the assistant asks only the questions that fit this visit.',
};

const DEFAULT_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

const SYSTEM_INSTRUCTION = `You are a Medical Intake Form Helper embedded inside a patient check-in interface.

Your job is to guide a patient through a medical intake conversation in a clear, supportive, and simple way. You are helping build a draft intake form behind the scenes as the patient answers questions.

High-level goal:
- Start with visit-specific intake.
- When asked to focus on another section, continue helping with that section instead of only the visit.
- Do NOT behave like a fixed questionnaire.
- Ask only the most relevant next question for the current section.

Core behavior:
- Ask only 1 main question at a time.
- Keep the visible chat question short, natural, and patient-friendly.
- Do not give diagnoses, treatment plans, urgency advice, or medical advice.
- Use the patient's meaning, but rewrite the draft in cleaner clinician-friendly wording when needed.
- Correct obvious spelling mistakes when the meaning is clear.
- Preserve uncertainty when the patient is unsure. Do not guess.
- Avoid repeating information the patient already gave.
- Switch to form_review mode as soon as the CURRENT section has enough useful information.

Section rules:
- active_section tells you what part of the intake to work on right now.
- If active_section is visit_context, build a dynamic clinician-facing visit section that changes based on the visit.
- If active_section is patient_information, only collect patient information fields.
- If active_section is insurance_information, only collect insurance fields.
- If active_section is medical_history, only collect medical history fields.
- Only update the section you are actively working on, plus optional additional_concerns when clearly relevant.

Visit drafting strategy:
- Generate a visit-specific section title and subtitle based on the appointment.
- Generate a polished summary_for_clinician in normal clinician-friendly language.
- relevant_fields should be dynamic and visit-specific, not a recycled template.
- relevant_fields should capture clinically useful details like location, onset, trigger, severity pattern, associated symptoms, visible changes, and similar details only when relevant.

Output rules:
- Return JSON only.
- display_message is the only text shown in the chat bubble.
- plain_language_definition and why_we_are_asking are hidden support fields for the interface.
- current_focus_label should be a short label describing what you are asking for right now.
- patient_information, insurance_information, and medical_history may be included when those sections are active.
- visit_context.section_title should be tailored to the visit, such as "Finger Injury Summary" or "Back Pain Summary".
- visit_context.section_subtitle should briefly explain what this generated section covers.
- visit_context.visit_category should be a concise normalized category.
- visit_context.chief_concern should be a cleaned-up concise version of the patient's main concern.
- visit_context.summary_for_clinician should be a polished summary written for a clinician, based on the patient's meaning.
- visit_context.relevant_fields should be an array of only the relevant fields for this visit.
- Each relevant field must have key, label, value, and source.
- source must be either "patient" or "ai_summary".
- additional_concerns.patient_notes can stay as the patient's own wording if they add one more thing.
- additional_concerns.ai_drafted_notes may be a cleaner version if useful.
- If information is not provided, leave the field out or use "Not provided" only when necessary.
- Never include markdown fences.`;

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function extractTextFromGemini(data: any): string {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) {
    throw new Error('No model response returned.');
  }
  return parts.map((part: any) => part?.text || '').join('').trim();
}

function stripCodeFences(text: string) {
  return text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
}

function normalizeRelevantFields(fields: any): RelevantVisitField[] {
  if (!Array.isArray(fields)) return [];
  return fields
    .map((field, index) => ({
      key: String(field?.key || `field_${index + 1}`),
      label: String(field?.label || `Detail ${index + 1}`),
      value: String(field?.value || ''),
      source: (field?.source === 'patient' ? 'patient' : 'ai_summary') as 'patient' | 'ai_summary',
    }))
    .filter((field) => field.label.trim() || field.value.trim());
}

function normalizeAgentResponse(raw: any): AgentResponse {
  return {
    mode: raw?.mode === 'clarification_needed' || raw?.mode === 'form_review' ? raw.mode : 'intake_question',
    display_message: String(raw?.display_message || 'Could you tell me a little more about what brought you in today?'),
    plain_language_definition: String(raw?.plain_language_definition || DEFAULT_HELPER.plainLanguageDefinition),
    why_we_are_asking: String(raw?.why_we_are_asking || DEFAULT_HELPER.whyWeAreAsking),
    current_focus_label: String(raw?.current_focus_label || 'Visit details'),
    patient_information: {
      full_name: String(raw?.patient_information?.full_name || ''),
      date_of_birth: String(raw?.patient_information?.date_of_birth || ''),
      phone_number: String(raw?.patient_information?.phone_number || ''),
      email: String(raw?.patient_information?.email || ''),
      address: String(raw?.patient_information?.address || ''),
      source_note: String(raw?.patient_information?.source_note || ''),
    },
    insurance_information: {
      provider_name: String(raw?.insurance_information?.provider_name || ''),
      member_id: String(raw?.insurance_information?.member_id || ''),
      group_number: String(raw?.insurance_information?.group_number || ''),
      source_note: String(raw?.insurance_information?.source_note || ''),
    },
    medical_history: {
      allergies: String(raw?.medical_history?.allergies || ''),
      current_medications: String(raw?.medical_history?.current_medications || ''),
      past_surgeries_or_hospitalizations: String(raw?.medical_history?.past_surgeries_or_hospitalizations || ''),
      family_history: String(raw?.medical_history?.family_history || ''),
      source_note: String(raw?.medical_history?.source_note || ''),
    },
    visit_context: {
      section_title: String(raw?.visit_context?.section_title || ''),
      section_subtitle: String(raw?.visit_context?.section_subtitle || ''),
      visit_category: String(raw?.visit_context?.visit_category || ''),
      chief_concern: String(raw?.visit_context?.chief_concern || ''),
      summary_for_clinician: String(raw?.visit_context?.summary_for_clinician || ''),
      relevant_fields: normalizeRelevantFields(raw?.visit_context?.relevant_fields),
      source_note: String(raw?.visit_context?.source_note || 'AI drafted from your current chat responses and tailored to this visit.'),
    },
    additional_concerns: {
      patient_notes: String(raw?.additional_concerns?.patient_notes || ''),
      ai_drafted_notes: String(raw?.additional_concerns?.ai_drafted_notes || ''),
    },
  };
}


const COMPLETION_SECTION_LABELS: Record<Exclude<AgentSection, "visit_context">, string> = {
  patient_information: "patient information",
  insurance_information: "insurance information",
  medical_history: "medical history",
};

function hasMeaningfulValue(value: unknown) {
  return String(value || '').trim().length > 0;
}

function getMissingSections(draftForm: ReturnType<typeof useIntake>['draftForm']): Exclude<AgentSection, "visit_context">[] {
  const missing: Exclude<AgentSection, "visit_context">[] = [];

  const patientInfoKeys: (keyof typeof draftForm.patient_information)[] = ['full_name', 'date_of_birth', 'phone_number', 'email', 'address'];
  const insuranceKeys: (keyof typeof draftForm.insurance_information)[] = ['provider_name', 'member_id', 'group_number'];
  const medicalKeys: (keyof typeof draftForm.medical_history)[] = ['allergies', 'current_medications', 'past_surgeries_or_hospitalizations', 'family_history'];

  if (patientInfoKeys.some((key) => !hasMeaningfulValue(draftForm.patient_information[key]))) missing.push('patient_information');
  if (insuranceKeys.some((key) => !hasMeaningfulValue(draftForm.insurance_information[key]))) missing.push('insurance_information');
  if (medicalKeys.some((key) => !hasMeaningfulValue(draftForm.medical_history[key]))) missing.push('medical_history');

  return missing;
}

function isYesResponse(text: string) {
  return /^(yes|yeah|yep|sure|ok|okay|please do|go ahead|continue|help me|lets do it|let's do it)\b/i.test(text.trim());
}

function isNoResponse(text: string) {
  return /^(no|nope|nah|not now|skip|pass|maybe later)\b/i.test(text.trim());
}

function buildCompletionOffer(section: Exclude<AgentSection, "visit_context">) {
  const label = COMPLETION_SECTION_LABELS[section];
  return `I noticed your ${label} is still incomplete. Would you like me to help you fill that out?`;
}

function compactPatch<T extends Record<string, any> | undefined>(value: T): Partial<NonNullable<T>> | undefined {
  if (!value) return undefined;
  const entries = Object.entries(value).filter(([_, entryValue]) => String(entryValue || '').trim().length > 0);
  return entries.length > 0 ? Object.fromEntries(entries) as Partial<NonNullable<T>> : undefined;
}

const AGENT_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    mode: { type: 'STRING', enum: ['intake_question', 'clarification_needed', 'form_review'] },
    display_message: { type: 'STRING' },
    plain_language_definition: { type: 'STRING' },
    why_we_are_asking: { type: 'STRING' },
    current_focus_label: { type: 'STRING' },
    patient_information: {
      type: 'OBJECT',
      properties: {
        full_name: { type: 'STRING' },
        date_of_birth: { type: 'STRING' },
        phone_number: { type: 'STRING' },
        email: { type: 'STRING' },
        address: { type: 'STRING' },
        source_note: { type: 'STRING' },
      },
    },
    insurance_information: {
      type: 'OBJECT',
      properties: {
        provider_name: { type: 'STRING' },
        member_id: { type: 'STRING' },
        group_number: { type: 'STRING' },
        source_note: { type: 'STRING' },
      },
    },
    medical_history: {
      type: 'OBJECT',
      properties: {
        allergies: { type: 'STRING' },
        current_medications: { type: 'STRING' },
        past_surgeries_or_hospitalizations: { type: 'STRING' },
        family_history: { type: 'STRING' },
        source_note: { type: 'STRING' },
      },
    },
    visit_context: {
      type: 'OBJECT',
      properties: {
        section_title: { type: 'STRING' },
        section_subtitle: { type: 'STRING' },
        visit_category: { type: 'STRING' },
        chief_concern: { type: 'STRING' },
        summary_for_clinician: { type: 'STRING' },
        source_note: { type: 'STRING' },
        relevant_fields: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              key: { type: 'STRING' },
              label: { type: 'STRING' },
              value: { type: 'STRING' },
              source: { type: 'STRING', enum: ['patient', 'ai_summary'] },
            },
            required: ['key', 'label', 'value', 'source'],
          },
        },
      },
      required: ['section_title', 'section_subtitle', 'visit_category', 'chief_concern', 'summary_for_clinician', 'relevant_fields'],
    },
    additional_concerns: {
      type: 'OBJECT',
      properties: {
        patient_notes: { type: 'STRING' },
        ai_drafted_notes: { type: 'STRING' },
      },
    },
  },
  required: ['mode', 'display_message', 'plain_language_definition', 'why_we_are_asking', 'current_focus_label', 'visit_context'],
};

function buildPayload(args: {
  profile: ReturnType<typeof usePatientProfile>['profile'];
  draftForm: ReturnType<typeof useIntake>['draftForm'];
  conversation: Message[];
  isInitialTurn: boolean;
  activeSection: AgentSection;
}) {
  const { profile, draftForm, conversation, isInitialTurn, activeSection } = args;

  return {
    is_initial_turn: isInitialTurn,
    active_section: activeSection,
    patient_profile_summary: {
      full_name: `${profile.firstName} ${profile.lastName}`.trim(),
      upcoming_provider: profile.upcomingProvider,
      upcoming_time: profile.upcomingTime,
      upcoming_visit_type: profile.upcomingVisitType,
    },
    background_sections_already_autofilled: {
      patient_information: draftForm.patient_information,
      insurance_information: draftForm.insurance_information,
      medical_history: draftForm.medical_history,
    },
    current_dynamic_visit_section: draftForm.visit_context,
    current_additional_concerns: draftForm.additional_concerns,
    conversation: conversation.map((message) => ({
      role: message.sender === 'ai' ? 'assistant' : 'patient',
      text: message.text,
    })),
  };
}

async function requestGeminiAgent(args: {
  apiKey: string;
  apiUrl: string;
  profile: ReturnType<typeof usePatientProfile>['profile'];
  draftForm: ReturnType<typeof useIntake>['draftForm'];
  conversation: Message[];
  isInitialTurn: boolean;
  activeSection: AgentSection;
}) {
  const body = {
    systemInstruction: {
      parts: [{ text: SYSTEM_INSTRUCTION }],
    },
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: JSON.stringify(buildPayload(args)),
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.45,
      topP: 0.9,
      responseMimeType: 'application/json',
      responseSchema: AGENT_RESPONSE_SCHEMA,
    },
  };

  const baseUrl = (args.apiUrl || DEFAULT_API_URL).trim();
  const url = `${baseUrl}?key=${args.apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  if (!response.ok) {
    const message = data?.error?.message || 'Gemini request failed.';
    throw new Error(message);
  }

  const rawText = stripCodeFences(extractTextFromGemini(data));
  return normalizeAgentResponse(JSON.parse(rawText));
}

export default function ChatTab() {
  const insets = useSafeAreaInsets();
  const { isAiEnabled, hasAcceptedPrivacy, acceptPrivacy, disableAi } = useAiAssistant();
  const { profile } = usePatientProfile();
  const {
    draftForm,
    applyAgentDraft,
    currentRequestedField,
    setCurrentRequestedField,
    helperInfo,
    setHelperInfo,
    resetAppointment,
  } = useIntake();

  const resetChatState = () => {
    setMessages([]);
    setInputText('');
    setInputHeight(22);
    setActiveSection('visit_context');
    setCompletionOfferSection(null);
    setIsLoading(false);
    initialTurnRequestedRef.current = false;

    resetAppointment();
  };

  useEffect(() => {
    const handler = () => resetChatState();

    // @ts-ignore
    globalThis.__RESET_CHAT__ = handler;

    return () => {
      // @ts-ignore
      delete globalThis.__RESET_CHAT__;
    };
  }, []);

  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY || process.env.EXPO_PUBLIC_API_KEY || '';
const apiUrl = process.env.EXPO_PUBLIC_API_URL || DEFAULT_API_URL;

const [messages, setMessages] = useState<Message[]>([]);
const [inputText, setInputText] = useState('');
const [isLoading, setIsLoading] = useState(false);
const [infoVisible, setInfoVisible] = useState(false);
const [activeInfo, setActiveInfo] = useState(DEFAULT_HELPER);
const [dockHeight, setDockHeight] = useState(96);
const [inputHeight, setInputHeight] = useState(22);
const [activeSection, setActiveSection] = useState<AgentSection>('visit_context');
const [completionOfferSection, setCompletionOfferSection] = useState<Exclude<AgentSection, 'visit_context'> | null>(null);

const listRef = useRef<FlatList<Message>>(null);
const inputRef = useRef<TextInput>(null);
const initialTurnRequestedRef = useRef(false);

const scrollToLatest = (animated = true) => {
  requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated }));
};

useEffect(() => {
  const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
  const showSub = Keyboard.addListener(showEvent, () => {
    setTimeout(() => scrollToLatest(true), 90);
  });
  return () => showSub.remove();
}, []);

useEffect(() => {
  if (!isAiEnabled) {
    initialTurnRequestedRef.current = false;
    setMessages([]);
    setInputText('');
    setInputHeight(22);
    setCurrentRequestedField('Main reason for visit');
    setHelperInfo(DEFAULT_HELPER.plainLanguageDefinition, DEFAULT_HELPER.whyWeAreAsking);
    setActiveSection('visit_context');
    setCompletionOfferSection(null);
    resetAppointment();
    return;
  }

  if (!hasAcceptedPrivacy) {
    initialTurnRequestedRef.current = false;
    setMessages([]);
    setInputText('');
    setInputHeight(22);
    setCurrentRequestedField('Main reason for visit');
    setHelperInfo(DEFAULT_HELPER.plainLanguageDefinition, DEFAULT_HELPER.whyWeAreAsking);
    setActiveSection('visit_context');
    setCompletionOfferSection(null);
    resetAppointment();
  }
}, [hasAcceptedPrivacy, isAiEnabled, resetAppointment, setCurrentRequestedField, setHelperInfo]);

const runAgentTurn = async (conversation: Message[], isInitialTurn: boolean, sectionOverride?: AgentSection) => {
  if (!apiKey) {
    throw new Error('Gemini API key not found. Add EXPO_PUBLIC_GEMINI_API_KEY or EXPO_PUBLIC_API_KEY to your Expo env.');
  }

  const workingSection = sectionOverride || activeSection;

  const agent = await requestGeminiAgent({
    apiKey,
    apiUrl,
    profile,
    draftForm,
    conversation,
    isInitialTurn,
    activeSection: workingSection,
  });

  const patientPatch = compactPatch(agent.patient_information);
  const insurancePatch = compactPatch(agent.insurance_information);
  const historyPatch = compactPatch(agent.medical_history);
  const additionalConcernsPatch = compactPatch(agent.additional_concerns);

  applyAgentDraft({
    patient_information: patientPatch,
    insurance_information: insurancePatch,
    medical_history: historyPatch,
    visit_context: agent.visit_context,
    additional_concerns: additionalConcernsPatch,
  });
  setCurrentRequestedField(agent.current_focus_label);
  setHelperInfo(agent.plain_language_definition, agent.why_we_are_asking);

  const aiMessage: Message = {
    id: makeId('ai'),
    sender: 'ai',
    text: agent.display_message,
    plainLanguageDefinition: agent.plain_language_definition,
    whyWeAreAsking: agent.why_we_are_asking,
  };

  const nextConversation = [...conversation, aiMessage];
  setMessages(nextConversation);

  if (agent.mode === 'form_review') {
    const mergedDraft = {
      ...draftForm,
      patient_information: { ...draftForm.patient_information, ...patientPatch },
      insurance_information: { ...draftForm.insurance_information, ...insurancePatch },
      medical_history: { ...draftForm.medical_history, ...historyPatch },
      visit_context: agent.visit_context ? { ...draftForm.visit_context, ...agent.visit_context } : draftForm.visit_context,
      additional_concerns: { ...draftForm.additional_concerns, ...additionalConcernsPatch },
    };

    if (workingSection === 'visit_context') {
      const missingSections = getMissingSections(mergedDraft);
      if (missingSections.length > 0) {
        const nextSection = missingSections[0];
        setCompletionOfferSection(nextSection);
        setCurrentRequestedField(COMPLETION_SECTION_LABELS[nextSection]);
        const offerMessage: Message = {
          id: makeId('ai-offer'),
          sender: 'ai',
          text: buildCompletionOffer(nextSection),
          plainLanguageDefinition: 'This means part of your intake form still has blank fields.',
          whyWeAreAsking: 'Completing the remaining sections helps the clinic review a more complete intake form before the visit.',
        };
        setMessages([...nextConversation, offerMessage]);
        setTimeout(() => scrollToLatest(true), 120);
        return;
      }
    } else {
      const missingSections = getMissingSections(mergedDraft).filter((section) => section !== workingSection);
      if (missingSections.length > 0) {
        const nextSection = missingSections[0];
        setCompletionOfferSection(nextSection);
        setActiveSection('visit_context');
        setCurrentRequestedField(COMPLETION_SECTION_LABELS[nextSection]);
        const offerMessage: Message = {
          id: makeId('ai-offer'),
          sender: 'ai',
          text: buildCompletionOffer(nextSection),
          plainLanguageDefinition: 'This means part of your intake form still has blank fields.',
          whyWeAreAsking: 'Completing the remaining sections helps the clinic review a more complete intake form before the visit.',
        };
        setMessages([...nextConversation, offerMessage]);
        setTimeout(() => scrollToLatest(true), 120);
        return;
      }

      setCompletionOfferSection(null);
      setActiveSection('visit_context');
      const doneMessage: Message = {
        id: makeId('ai-done'),
        sender: 'ai',
        text: 'Thanks. Your intake draft looks complete now and is ready for review.',
        plainLanguageDefinition: 'Your intake form now has information in the main sections needed for review.',
        whyWeAreAsking: 'A more complete draft helps the clinician review your visit faster.',
      };
      setMessages([...nextConversation, doneMessage]);
      setTimeout(() => scrollToLatest(true), 120);
      return;
    }
  }

  setTimeout(() => scrollToLatest(true), 120);
};

useEffect(() => {
  if (!hasAcceptedPrivacy || !isAiEnabled || initialTurnRequestedRef.current) {
    return;
  }

  initialTurnRequestedRef.current = true;
  setIsLoading(true);
  runAgentTurn([], true)
    .catch((error) => {
      setMessages([
        {
          id: makeId('ai-error'),
          sender: 'ai',
          text: `I couldn't start the assistant right now. ${error instanceof Error ? error.message : 'Please try again.'}`,
          plainLanguageDefinition: DEFAULT_HELPER.plainLanguageDefinition,
          whyWeAreAsking: DEFAULT_HELPER.whyWeAreAsking,
        },
      ]);
    })
    .finally(() => setIsLoading(false));
}, [hasAcceptedPrivacy, isAiEnabled]);

useEffect(() => {
  const timer = setTimeout(() => scrollToLatest(false), 60);
  return () => clearTimeout(timer);
}, [messages, dockHeight, isLoading]);

const startConversation = () => {
  acceptPrivacy();
};

const openInfoForMessage = (item: Message) => {
  setActiveInfo({
    plainLanguageDefinition: item.plainLanguageDefinition || helperInfo.plainLanguageDefinition,
    whyWeAreAsking: item.whyWeAreAsking || helperInfo.whyWeAreAsking,
  });
  setInfoVisible(true);
};

const submitReply = async () => {
  const userText = inputText.trim();
  if (!userText || isLoading) return;

  const nextConversation: Message[] = [...messages, { id: makeId('user'), sender: 'user', text: userText }];
  setMessages(nextConversation);
  setInputText('');
  setInputHeight(22);
  Keyboard.dismiss();
  inputRef.current?.blur();

  if (completionOfferSection) {
    if (isYesResponse(userText)) {
      setCompletionOfferSection(null);
      setActiveSection(completionOfferSection);
      setIsLoading(true);
      try {
        await runAgentTurn(nextConversation, true, completionOfferSection);
      } catch (error) {
        setMessages([
          ...nextConversation,
          {
            id: makeId('ai-error'),
            sender: 'ai',
            text: `I had trouble updating that section. ${error instanceof Error ? error.message : 'Please try again.'}`,
            plainLanguageDefinition: DEFAULT_HELPER.plainLanguageDefinition,
            whyWeAreAsking: DEFAULT_HELPER.whyWeAreAsking,
          },
        ]);
      } finally {
        setIsLoading(false);
        setTimeout(() => scrollToLatest(true), 120);
      }
      return;
    }

    if (isNoResponse(userText)) {
      const remainingSections = getMissingSections(draftForm).filter((section) => section !== completionOfferSection);
      if (remainingSections.length > 0) {
        const nextSection = remainingSections[0];
        setCompletionOfferSection(nextSection);
        const offerMessage: Message = {
          id: makeId('ai-offer'),
          sender: 'ai',
          text: buildCompletionOffer(nextSection),
          plainLanguageDefinition: 'This means another part of your intake form still has blank fields.',
          whyWeAreAsking: 'Completing the remaining sections helps the clinic review a more complete intake form before the visit.',
        };
        setMessages([...nextConversation, offerMessage]);
      } else {
        setCompletionOfferSection(null);
        const doneMessage: Message = {
          id: makeId('ai-done'),
          sender: 'ai',
          text: 'Understood. There are no other incomplete sections I need to ask about right now.',
          plainLanguageDefinition: 'You chose not to fill the remaining section right now.',
          whyWeAreAsking: 'The care team can still review what you already completed.',
        };
        setMessages([...nextConversation, doneMessage]);
      }
      setTimeout(() => scrollToLatest(true), 120);
      return;
    }

    const clarifyMessage: Message = {
      id: makeId('ai-offer-clarify'),
      sender: 'ai',
      text: 'Please reply yes or no so I know whether to help with that section next.',
      plainLanguageDefinition: 'I am checking whether you want help filling the incomplete section.',
      whyWeAreAsking: 'This keeps the intake flow moving one section at a time.',
    };
    setMessages([...nextConversation, clarifyMessage]);
    setTimeout(() => scrollToLatest(true), 120);
    return;
  }

  setIsLoading(true);

  try {
    await runAgentTurn(nextConversation, false);
  } catch (error) {
    setMessages([
      ...nextConversation,
      {
        id: makeId('ai-error'),
        sender: 'ai',
        text: `I had trouble updating the visit draft. ${error instanceof Error ? error.message : 'Please try again.'}`,
        plainLanguageDefinition: DEFAULT_HELPER.plainLanguageDefinition,
        whyWeAreAsking: DEFAULT_HELPER.whyWeAreAsking,
      },
    ]);
  } finally {
    setIsLoading(false);
    setTimeout(() => scrollToLatest(true), 120);
  }
};

const renderItem = ({ item }: { item: Message }) => {
  const isAi = item.sender === 'ai';

  return (
    <View style={[styles.messageRow, isAi ? styles.aiRow : styles.userRow]}>
      {isAi ? (
        <View style={styles.aiAvatar}>
          <Ionicons name="sparkles" size={16} color="#E8820C" />
        </View>
      ) : null}
      <View style={styles.messageContent} pointerEvents="box-none">
        <View pointerEvents="none" style={[styles.bubble, isAi ? styles.aiBubble : styles.userBubble]}>
          <Text style={[styles.messageText, isAi ? styles.aiText : styles.userText]}>{item.text}</Text>
        </View>
      </View>
      {isAi ? (
        <TouchableOpacity style={styles.inlineInfoButton} onPress={() => openInfoForMessage(item)}>
          <Ionicons name="information-circle-outline" size={26} color="#8A8175" />
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

return (
  <SafeAreaView edges={['top']} style={styles.container}>
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
      <View style={styles.container}>
        <View style={styles.topCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.topTitle}>AI intake assistant</Text>
            <Text style={styles.topSubtitle}>One question at a time. Saved profile data already fills in your background sections.</Text>
          </View>
          <TouchableOpacity style={styles.reviewButton} onPress={() => router.push('/form')}>
            <Text style={styles.reviewButtonText}>View intake</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          ref={listRef}
          data={messages}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          style={styles.list}
          contentContainerStyle={[styles.chatList, { paddingBottom: dockHeight + Math.max(insets.bottom, 12) + 18 }]}
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scrollToLatest(false)}
          onScrollBeginDrag={() => Keyboard.dismiss()}
          ListFooterComponent={
            isLoading ? (
              <View style={[styles.messageRow, styles.aiRow]}>
                <View style={styles.aiAvatar}>
                  <Ionicons name="sparkles" size={16} color="#E8820C" />
                </View>

                <View style={styles.messageContent}>
                  <View style={[styles.bubble, styles.aiBubble, styles.thinkingBubble]}>
                    <ActivityIndicator size="small" color="#E8820C" />
                    <Text style={styles.thinkingText}>Assistant is thinking...</Text>
                  </View>
                </View>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>{isAiEnabled ? 'Pre-visit check-in' : 'AI check-in is off'}</Text>
              <Text style={styles.emptyText}>
                {isAiEnabled ? 'Review the privacy note before starting.' : 'AI is off. You can still complete your intake manually.'}
              </Text>
              {!isAiEnabled ? (
                <TouchableOpacity style={styles.manualButton} onPress={() => router.push('/form')}>
                  <Text style={styles.manualButtonText}>Open intake review</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          }
        />

        {hasAcceptedPrivacy && isAiEnabled && messages.length > 0 ? (
          <View style={[styles.bottomDock, { paddingBottom: Math.max(insets.bottom, 10) }]} onLayout={(e) => setDockHeight(e.nativeEvent.layout.height)}>
            <View style={styles.helperChip}>
              <Text style={styles.helperLabel}>Currently asking</Text>
              <Text style={styles.helperValue} numberOfLines={1}>{currentRequestedField}</Text>
            </View>

            <View style={styles.inputBar}>
              <TouchableOpacity style={styles.sideAction} disabled>
                <Ionicons name="image-outline" size={22} color="#9E958A" />
              </TouchableOpacity>
              <TextInput
                ref={inputRef}
                style={[styles.input, { height: Math.min(Math.max(inputHeight, 22), 68) }]}
                placeholder={isLoading ? 'Assistant is thinking…' : 'Type your answer'}
                placeholderTextColor="#A59D93"
                value={inputText}
                onChangeText={setInputText}
                editable={!isLoading}
                multiline
                textAlignVertical="center"
                onFocus={() => setTimeout(() => scrollToLatest(true), 140)}
                onContentSizeChange={(event) => setInputHeight(event.nativeEvent.contentSize.height)}
                blurOnSubmit={false}
                returnKeyType="send"
              />
              <TouchableOpacity style={styles.sideAction} disabled>
                <Ionicons name="mic-outline" size={22} color="#9E958A" />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.sendButton, !(inputText.trim() && !isLoading) && styles.sendButtonDisabled]} onPress={submitReply} disabled={isLoading || !inputText.trim()}>
                {isLoading ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="arrow-up" size={20} color="#FFFFFF" />}
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </View>
    </KeyboardAvoidingView>

    <Modal visible={isAiEnabled && !hasAcceptedPrivacy} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Before you start</Text>
          <Text style={styles.modalText}>This AI assistant helps organize your pre-visit intake. Personal medical details should remain inside this care experience.</Text>
          <Text style={styles.modalText}>De-identified conversation data may be reviewed to improve the system, but direct personal identifiers should not be used for model training.</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={startConversation}>
            <Text style={styles.primaryButtonText}>Continue with AI</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => {
              disableAi();
              router.push('/form');
            }}
          >
            <Text style={styles.secondaryButtonText}>Fill out intake manually</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>

    <Modal visible={infoVisible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.infoModalCard}>
          <Text style={styles.infoHeading}>What this means</Text>
          <Text style={styles.infoBody}>{activeInfo.plainLanguageDefinition}</Text>
          <Text style={[styles.infoHeading, { marginTop: 14 }]}>Why we are asking</Text>
          <Text style={styles.infoBody}>{activeInfo.whyWeAreAsking}</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => setInfoVisible(false)}>
            <Text style={styles.primaryButtonText}>Got it</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  </SafeAreaView>
);
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F5F0' },
  topCard: {
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E5DED4',
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  topTitle: { fontSize: 18, fontWeight: '700', color: '#232220', marginBottom: 6 },
  topSubtitle: { fontSize: 14, lineHeight: 22, color: '#6F6A63' },
  reviewButton: { backgroundColor: '#F6EAD6', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12 },
  reviewButtonText: { color: '#A36A09', fontWeight: '700' },
  list: { flex: 1 },
  chatList: { paddingHorizontal: 20, paddingTop: 12, gap: 18 },
  emptyState: { alignItems: 'center', paddingTop: 100, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#2D2C29', marginBottom: 8 },
  emptyText: { fontSize: 14, lineHeight: 22, color: '#6F6A63', textAlign: 'center', marginBottom: 16 },
  manualButton: { backgroundColor: '#F6EAD6', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16 },
  manualButtonText: { color: '#A36A09', fontWeight: '700' },
  messageRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  aiRow: { justifyContent: 'flex-start' },
  userRow: { justifyContent: 'flex-end' },
  aiAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F8EDE0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 6,
  },
  messageContent: { maxWidth: '74%' },
  bubble: { borderRadius: 28, paddingHorizontal: 18, paddingVertical: 16 },
  aiBubble: { backgroundColor: '#FFF5E9', borderWidth: 1, borderColor: '#E6C289' },
  userBubble: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E8E1D7' },
  messageText: { fontSize: 16, lineHeight: 24 },
  aiText: { color: '#2C2C2A' },
  userText: { color: '#2C2C2A' },
  inlineInfoButton: { marginLeft: 8, alignSelf: 'center' },
  bottomDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: '#F8F5F0',
    borderTopWidth: 1,
    borderTopColor: '#E8E2D8',
  },
  helperChip: {
    alignSelf: 'flex-start',
    backgroundColor: '#F1ECE3',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 10,
    maxWidth: '100%',
  },
  helperLabel: { fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: '#968E85', marginBottom: 3 },
  helperValue: { fontSize: 15, color: '#2D2B28' },
  inputBar: {
    minHeight: 64,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#DDD4C8',
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 10,
    paddingRight: 8,
    paddingVertical: 8,
    gap: 8,
  },
  sideAction: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#2D2B28',
    paddingVertical: 0,
    paddingHorizontal: 2,
    maxHeight: 68,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E88711',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: { backgroundColor: '#DAD2C6' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.28)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
  },
  infoModalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
  },
  modalTitle: { fontSize: 22, fontWeight: '700', color: '#1F1F1D', marginBottom: 12 },
  modalText: { fontSize: 15, lineHeight: 22, color: '#5F5A54', marginBottom: 10 },
  primaryButton: {
    marginTop: 10,
    backgroundColor: '#E88711',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  secondaryButton: {
    marginTop: 10,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#F6F1E8',
  },
  secondaryButtonText: { color: '#7B6E60', fontWeight: '700', fontSize: 15 },
  infoHeading: { fontSize: 17, fontWeight: '700', color: '#1F1F1D', marginBottom: 8 },
  infoBody: { fontSize: 15, lineHeight: 22, color: '#5F5A54' },
  thinkingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  thinkingText: {
    fontSize: 15,
    color: '#6F6A63',
  },
});
