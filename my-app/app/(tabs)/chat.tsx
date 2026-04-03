import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  View,
  Text,
  Modal,
  Image,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker'; 

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Fonts } from '@/constants/theme';

type Message = {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  imageUri?: string;
  isAudio?: boolean;
  plainLanguageDefinition?: string;
  whyWeAreAsking?: string;
};

const INITIAL_MESSAGES: Message[] = [
  { 
    id: '1', 
    text: "Welcome back, John! What's the reason for your visit?", 
    sender: 'ai',
    plainLanguageDefinition: "We use standard medical terms to ensure accuracy, but we are here to clarify any confusing words!",
    whyWeAreAsking: "This information helps personalize your care plan and ensures we ask the right follow-up questions."
  }
];

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [inputText, setInputText] = useState('');

  const [infoModalVisible, setInfoModalVisible] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // --- GEMINI API INTEGRATION ---
  const sendToAPI = async (userMessage: string) => {
    setIsLoading(true);
    
    const apiUrl = process.env.EXPO_PUBLIC_API_URL;
    const apiKey = process.env.EXPO_PUBLIC_API_KEY;

    if (!apiUrl || !apiKey) {
      console.error("API URL or Key is missing! Check your .env file.");
      setIsLoading(false);
      return;
    }

    // 1. System Instructions
    const systemInstructionText = `You are a Medical Intake Form Helper embedded inside a patient check-in interface.

Your job is to guide a patient through a medical intake conversation in a clear, supportive, and simple way. You are helping build a draft intake form behind the scenes as the patient answers questions.

Important behavior:
- Ask only 1 main question at a time.
- Keep the visible chat question short and natural.
- Do not include long explanations in the main chat response.
- Do not explain why the question matters unless the interface requests that information separately.
- Always generate hidden metadata for the interface, including:
  1. a plain-language definition of any medical term or concept in the question,
  2. a short explanation of why the question is being asked,
  3. the fields already collected,
  4. the fields currently being requested,
  5. the updated draft intake form.
- Do not guess missing information.
- If information is unknown or not provided, mark it as "Unknown" or "Not provided".
- Do not give diagnoses, treatment plans, or medical advice.
- Focus on collecting intake information only.

Conversation flow:
- Start with the reason for the visit.
- Then ask the most relevant follow-up question for that visit.
- Gradually collect symptom details, patient information, emergency contact, insurance, medical history, medications, allergies, and other relevant details.
- Once enough information is collected, switch to review mode and produce a draft form for the patient to review.

Output rules:
- Return structured JSON only.
- The field called "display_message" is the only text that should appear directly in the chat bubble.
- The fields "plain_language_definition" and "why_we_are_asking" are hidden UI support fields and should not be written as part of the main display message.`;

    // 2. Structured JSON Schema
    const responseSchema = {
      type: "OBJECT",
      required: ["mode", "display_message", "plain_language_definition", "why_we_are_asking", "fields_requested_now", "collected_data", "draft_form"],
      properties: {
        mode: { 
          type: "STRING", 
          enum: ["intake_question", "clarification_needed", "form_review"] 
        },
        display_message: { type: "STRING" },
        plain_language_definition: { type: "STRING" },
        why_we_are_asking: { type: "STRING" },
        fields_requested_now: {
          type: "ARRAY",
          items: { type: "STRING" }
        },
        collected_data: {
          type: "OBJECT",
          properties: {
            patient_information: {
              type: "OBJECT",
              properties: {
                full_name: { type: "STRING" },
                date_of_birth: { type: "STRING" },
                phone_number: { type: "STRING" },
                email: { type: "STRING" },
                address: { type: "STRING" }
              }
            },
            visit_information: {
              type: "OBJECT",
              properties: {
                reason_for_visit: { type: "STRING" },
                symptoms: { type: "ARRAY", items: { type: "STRING" } },
                symptom_duration: { type: "STRING" },
                pain_severity_1_to_10: { type: "STRING" },
                additional_notes: { type: "STRING" }
              }
            }
          }
        },
        draft_form: {
          type: "OBJECT",
          properties: {
            patient_information: {
              type: "OBJECT",
              properties: {
                full_name: { type: "STRING" },
                date_of_birth: { type: "STRING" },
                phone_number: { type: "STRING" },
                email: { type: "STRING" },
                address: { type: "STRING" }
              }
            },
            visit_information: {
              type: "OBJECT",
              properties: {
                reason_for_visit: { type: "STRING" },
                symptoms: { type: "ARRAY", items: { type: "STRING" } },
                symptom_duration: { type: "STRING" },
                pain_severity_1_to_10: { type: "STRING" },
                additional_notes: { type: "STRING" }
              }
            },
            review_notice: { type: "STRING" }
          }
        }
      }
    };

    try {
      // 3. The exact Gemini fetch request
      const response = await fetch(`${apiUrl}?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          systemInstruction: {
            parts: [{ text: systemInstructionText }]
          },
          contents: [{ 
            role: "user",
            parts: [{ text: userMessage }] 
          }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: responseSchema
          }
        }),
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      
      // 4. Extract Gemini's hidden JSON text and parse it
      const geminiTextResponse = data.candidates[0].content.parts[0].text;
      const parsedData = JSON.parse(geminiTextResponse);

      const aiReply: Message = {
        id: Date.now().toString(),
        text: parsedData.display_message, 
        sender: 'ai',
        plainLanguageDefinition: parsedData.plain_language_definition, 
        whyWeAreAsking: parsedData.why_we_are_asking 
      };

      setMessages((prev) => [...prev, aiReply]);
      
      // Look in your terminal when you send a message to see the form building!
      console.log("Live Form Data:", parsedData.draft_form);

    } catch (error) {
      console.error("API Error:", error);
      const errorReply: Message = {
        id: Date.now().toString(),
        text: "Sorry, I'm having trouble connecting to Gemini right now.",
        sender: 'ai'
      };
      setMessages((prev) => [...prev, errorReply]);
    } finally {
      setIsLoading(false);
    }
  };

  // --- SEND MESSAGES ---
  const sendMessage = async () => {
    if (inputText.trim().length === 0) return;
    
    const currentText = inputText;
    const newMessage: Message = { id: Date.now().toString(), text: currentText, sender: 'user' };
    
    setMessages((prev) => [...prev, newMessage]);
    setInputText('');
    
    await sendToAPI(currentText);
  };

  // --- MEDIA HANDLERS ---
  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
    });

    if (!result.canceled) {
      const imageMessage: Message = { id: Date.now().toString(), text: '', sender: 'user', imageUri: result.assets[0].uri };
      setMessages(prev => [...prev, imageMessage]);
      await sendToAPI("[User attached an image]"); 
    }
  };

  const handleMicPress = async () => {
    if (isRecording) {
      setIsRecording(false);
      const audioMessage: Message = { id: Date.now().toString(), text: 'Voice Message (0:04)', sender: 'user', isAudio: true };
      setMessages(prev => [...prev, audioMessage]);
      await sendToAPI("[User sent an audio message]"); 
    } else {
      setIsRecording(true);
    }
  };

  // --- UI HANDLERS ---
  const handleInfoPress = (message: Message) => {
    setSelectedMessage(message);
    setInfoModalVisible(true);
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isAI = item.sender === 'ai';
    return (
      <View style={[styles.messageRow, isAI ? styles.aiRow : styles.userRow]}>
        {isAI && <IconSymbol name="brain.head.profile" size={24} color="#808080" style={styles.aiIcon} />}

        <View style={[styles.bubble, isAI ? styles.aiBubble : styles.userBubble]}>
          {item.imageUri ? (
            <Image source={{ uri: item.imageUri }} style={styles.messageImage} />
          ) : 
          item.isAudio ? (
            <View style={styles.audioContainer}>
              <IconSymbol name="play.circle.fill" size={24} color="#007AFF" />
              <Text style={styles.userText}> {item.text}</Text>
            </View>
          ) : 
          (
            <Text style={[styles.messageText, isAI ? styles.aiText : styles.userText]}>
              {item.text}
            </Text>
          )}
        </View>

        {isAI && (
          <TouchableOpacity onPress={() => handleInfoPress(item)} style={styles.infoButton}>
            <IconSymbol name="info.circle" size={18} color="#4fbdeb" />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <ThemedView style={styles.fullScreen}>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        
        <TouchableOpacity
          style={styles.continueButton}
          onPress={() => router.push('/form')}
        >
          <Text style={styles.continueButtonText}>Continue to Form</Text>
        </TouchableOpacity>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.container}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <FlatList
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.chatList}
            showsVerticalScrollIndicator={false}
          />

          <View style={styles.inputWrapper}>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder={isRecording ? "Recording audio..." : "Enter Text"}
                value={inputText}
                onChangeText={setInputText}
                placeholderTextColor={isRecording ? "#FF3B30" : "#999"}
                multiline
                editable={!isRecording && !isLoading} 
              />
              <View style={styles.iconBar}>
                <View style={styles.leftIcons}>
                  
                  <TouchableOpacity onPress={pickImage} disabled={isLoading}>
                    <IconSymbol name="photo" size={22} color={isLoading ? "#D1D1D6" : "#666"} />
                  </TouchableOpacity>
                  
                  <TouchableOpacity onPress={handleMicPress} disabled={isLoading}>
                    <IconSymbol name="mic" size={22} color={isRecording ? "#FF3B30" : isLoading ? "#D1D1D6" : "#666"} />
                  </TouchableOpacity>

                </View>
                
                <TouchableOpacity onPress={sendMessage} style={styles.sendButton} disabled={isRecording || isLoading || inputText.trim().length === 0}>
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#007AFF" />
                  ) : (
                    <IconSymbol 
                      name="arrow.up.circle.fill" 
                      size={32} 
                      color={inputText.trim().length > 0 && !isRecording ? "#007AFF" : "#D1D1D6"} 
                    />
                  )}
                </TouchableOpacity>

              </View>
            </View>
          </View>
        </KeyboardAvoidingView>

        {/* Dynamic Info Modal */}
        <Modal animationType="fade" transparent={true} visible={infoModalVisible} onRequestClose={() => setInfoModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Question Details</Text>

              <Text style={styles.modalSubtitle}>Plain Language Definition:</Text>
              <Text style={styles.modalText}>
                {selectedMessage?.plainLanguageDefinition || "No definition provided."}
              </Text>
              
              <Text style={styles.modalSubtitle}>Why we are asking:</Text>
              <Text style={styles.modalText}>
                {selectedMessage?.whyWeAreAsking || "No explanation provided."}
              </Text>

              <TouchableOpacity
                style={styles.closeModalButton}
                onPress={() => setInfoModalVisible(false)}
              >
                <Text style={styles.closeModalButtonText}>Got it</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fullScreen: { flex: 1 },
  container: { flex: 1 },
  continueButton: { margin: 16, backgroundColor: '#007AFF', padding: 14, borderRadius: 12, alignItems: 'center' },
  continueButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  chatList: { padding: 16, paddingTop: 10, paddingBottom: 20 },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 20, maxWidth: '85%' },
  aiRow: { alignSelf: 'flex-start' },
  userRow: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  bubble: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  aiBubble: { backgroundColor: 'transparent', borderColor: '#444', borderWidth: 1, borderStyle: 'dotted', marginLeft: 8 },
  userBubble: { backgroundColor: '#FFFFFF', marginRight: 8 },
  messageImage: { width: 200, height: 150, borderRadius: 12 },
  audioContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  messageText: { fontSize: 16, lineHeight: 22, fontFamily: Fonts.rounded },
  aiText: { color: '#FFFFFF' },
  userText: { color: '#000000', fontWeight: '500' },
  aiIcon: { marginBottom: 4 },
  infoButton: { marginLeft: 8, marginBottom: 12, padding: 5 },
  inputWrapper: { paddingHorizontal: 16, paddingBottom: 20 },
  inputContainer: { borderRadius: 28, padding: 12, backgroundColor: '#FFFFFF' },
  input: { fontSize: 16, minHeight: 24, color: '#000', paddingHorizontal: 10 },
  iconBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  leftIcons: { flexDirection: 'row', gap: 16, paddingLeft: 8 },
  sendButton: { paddingRight: 4, justifyContent: 'center', alignItems: 'center', width: 32, height: 32 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.6)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '85%', backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#000', marginBottom: 20, textAlign: 'center' },
  modalSubtitle: { fontSize: 16, fontWeight: 'bold', color: '#000', marginTop: 10, marginBottom: 5 },
  modalText: { fontSize: 15, color: '#444', lineHeight: 22, marginBottom: 10 },
  closeModalButton: { marginTop: 20, backgroundColor: '#007AFF', paddingVertical: 14, borderRadius: 16, alignItems: 'center' },
  closeModalButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' }
});