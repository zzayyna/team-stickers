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

type AgentResponse = {
  mode: 'intake_question' | 'clarification_needed' | 'form_review';
  display_message: string;
  plain_language_definition: string;
  why_we_are_asking: string;
  current_focus_label: string;
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

Your job is to guide a patient through a medical intake conversation in a clear, supportive, and simple way. You are helping build one dynamic visit-specific intake section behind the scenes as the patient answers questions.

High-level goal:
- Do NOT behave like a fixed questionnaire.
- Infer what kind of visit this is from the patient's words.
- Ask only the most relevant next question for THIS visit.
- Build a dynamic clinician-facing section that changes based on the visit.

Core behavior:
- Ask only 1 main question at a time.
- Keep the visible chat question short, natural, and patient-friendly.
- Do not give diagnoses, treatment plans, urgency advice, or medical advice.
- Focus only on collecting visit intake information.
- Use the patient's meaning, but rewrite the draft in cleaner clinician-friendly wording.
- Correct obvious spelling mistakes when the meaning is clear. Example: if the patient types "comrooked" and clearly means "crooked", use "crooked" in the draft.
- Preserve uncertainty when the patient is unsure. Do not guess.
- Do not force every visit into the same fixed fields or the same question order.
- Omit irrelevant fields. Add only fields that matter for this visit.
- Background profile, insurance, and medical history are already handled elsewhere. Your main job is the visit-specific section and any optional extra note.

Questioning strategy:
- First understand the main concern.
- Then infer the likely visit type from the conversation.
- Ask the next most useful follow-up based on what is already known and what is still missing.
- Avoid repeating information the patient already gave.
- Ask fewer questions when the draft is already useful.
- Switch to form_review mode as soon as there is enough meaningful information for a clinician-facing draft.

Drafting strategy:
- Generate a visit-specific section title and subtitle based on the appointment.
- Generate a polished summary_for_clinician in normal clinician-friendly language.
- relevant_fields should be dynamic and visit-specific, not a recycled template.
- Normalize patient wording where appropriate.
- If a patient gives a typo or lay wording, rewrite it clearly in the draft while preserving the intended meaning.
- relevant_fields should capture clinically useful details like location, onset, trigger, severity pattern, associated symptoms, visible changes, etc only when relevant.

Output rules:
- Return JSON only.
- display_message is the only text shown in the chat bubble.
- plain_language_definition and why_we_are_asking are hidden support fields for the interface.
- current_focus_label should be a short label describing what you are asking for right now.
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
      source: field?.source === 'patient' ? 'patient' : 'ai_summary',
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

const AGENT_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    mode: { type: 'STRING', enum: ['intake_question', 'clarification_needed', 'form_review'] },
    display_message: { type: 'STRING' },
    plain_language_definition: { type: 'STRING' },
    why_we_are_asking: { type: 'STRING' },
    current_focus_label: { type: 'STRING' },
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
}) {
  const { profile, draftForm, conversation, isInitialTurn } = args;

  return {
    is_initial_turn: isInitialTurn,
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
    resetVisitContext,
  } = useIntake();

  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY || process.env.EXPO_PUBLIC_API_KEY || '';
  const apiUrl = process.env.EXPO_PUBLIC_API_URL || DEFAULT_API_URL;

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [infoVisible, setInfoVisible] = useState(false);
  const [activeInfo, setActiveInfo] = useState(DEFAULT_HELPER);
  const [dockHeight, setDockHeight] = useState(96);
  const [inputHeight, setInputHeight] = useState(22);

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
      resetVisitContext();
      return;
    }

    if (!hasAcceptedPrivacy) {
      initialTurnRequestedRef.current = false;
      setMessages([]);
      setInputText('');
      setInputHeight(22);
      setCurrentRequestedField('Main reason for visit');
      setHelperInfo(DEFAULT_HELPER.plainLanguageDefinition, DEFAULT_HELPER.whyWeAreAsking);
      resetVisitContext();
    }
  }, [hasAcceptedPrivacy, isAiEnabled, resetVisitContext, setCurrentRequestedField, setHelperInfo]);

  const runAgentTurn = async (conversation: Message[], isInitialTurn: boolean) => {
    if (!apiKey) {
      throw new Error('Gemini API key not found. Add EXPO_PUBLIC_GEMINI_API_KEY or EXPO_PUBLIC_API_KEY to your Expo env.');
    }

    const agent = await requestGeminiAgent({
      apiKey,
      apiUrl,
      profile,
      draftForm,
      conversation,
      isInitialTurn,
    });

    applyAgentDraft({
      visit_context: agent.visit_context,
      additional_concerns: agent.additional_concerns,
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

    setMessages([...conversation, aiMessage]);
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
});
