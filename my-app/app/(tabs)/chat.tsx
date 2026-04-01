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
  Image 
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
};

const INITIAL_MESSAGES: Message[] = [
  { id: '1', text: "Welcome back, John! What's the reason for your visit?", sender: 'ai' },
  { id: '2', text: 'I have been getting intense migraines', sender: 'user' },
  { id: '3', text: 'How long have you been having these migraines for?', sender: 'ai' },
];

export default function TestChatScreen() {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [inputText, setInputText] = useState('');

  // State for the Info Modal
  const [infoModalVisible, setInfoModalVisible] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  
  // State for recording
  const [isRecording, setIsRecording] = useState(false);

  const triggerAIReply = (customText: string) => {
    setTimeout(() => {
      const aiReply: Message = {
        id: Date.now().toString(),
        text: customText,
        sender: 'ai'
      };
      setMessages(prev => [...prev, aiReply]);
    }, 1500); 
  };

  const sendMessage = () => {
    if (inputText.trim().length === 0) return;
    const newMessage: Message = { id: Date.now().toString(), text: inputText, sender: 'user' };
    setMessages([...messages, newMessage]);
    setInputText('');
    
    triggerAIReply("I've noted that down. Can you provide any more details?");
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
    });

    if (!result.canceled) {
      const imageMessage: Message = {
        id: Date.now().toString(),
        text: '', 
        sender: 'user',
        imageUri: result.assets[0].uri
      };
      setMessages(prev => [...prev, imageMessage]);
      triggerAIReply("I received your image. Thank you for providing that visual context.");
    }
  };

  const handleMicPress = () => {
    if (isRecording) {
      setIsRecording(false);
      const audioMessage: Message = {
        id: Date.now().toString(),
        text: 'Voice Message (0:04)',
        sender: 'user',
        isAudio: true
      };
      setMessages(prev => [...prev, audioMessage]);
      triggerAIReply("I've transcribed your voice note to your chart.");
    } else {
      setIsRecording(true);
    }
  };

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

        {/* Wrapped the Info Icon in a TouchableOpacity */}
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
        
        {/* Teammate's Continue Form Button */}
        <TouchableOpacity
          style={{ margin: 16, backgroundColor: '#007AFF', padding: 14, borderRadius: 12, alignItems: 'center' }}
          onPress={() => router.push('/form')}
        >
          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Continue to Form</Text>
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
                editable={!isRecording} 
              />
              <View style={styles.iconBar}>
                <View style={styles.leftIcons}>
                  
                  {/* Photo Button */}
                  <TouchableOpacity onPress={pickImage}>
                    <IconSymbol name="photo" size={22} color="#666" />
                  </TouchableOpacity>
                  
                  {/* Microphone Button */}
                  <TouchableOpacity onPress={handleMicPress}>
                    <IconSymbol name="mic" size={22} color={isRecording ? "#FF3B30" : "#666"} />
                  </TouchableOpacity>

                </View>
                
                {/* Send Button */}
                <TouchableOpacity onPress={sendMessage} style={styles.sendButton} disabled={isRecording}>
                  <IconSymbol 
                    name="arrow.up.circle.fill" 
                    size={32} 
                    color={inputText.length > 0 && !isRecording ? "#007AFF" : "#D1D1D6"} 
                  />
                </TouchableOpacity>

              </View>
            </View>
          </View>
        </KeyboardAvoidingView>

        {/* Info Modal */}
        <Modal animationType="fade" transparent={true} visible={infoModalVisible} onRequestClose={() => setInfoModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Question Details</Text>

              <Text style={styles.modalSubtitle}>Plain Language Definition:</Text>
              <Text style={styles.modalText}>
                {selectedMessage?.id === '3'
                  ? "A migraine is a severe, throbbing headache that can cause sensitivity to light and sound."
                  : "We use standard medical terms to ensure accuracy, but we are here to clarify any confusing words!"}
              </Text>
              
              <Text style={styles.modalSubtitle}>Why we are asking:</Text>
              <Text style={styles.modalText}>
                {selectedMessage?.id === '3'
                  ? "Knowing how long you've had these symptoms helps us determine if this is a chronic or acute condition, which changes the recommended treatment plan."
                  : "This information helps personalize your care plan and ensures we ask the right follow-up questions specifically for you."}
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
  chatList: { 
    padding: 16, 
    paddingTop: 10, 
    paddingBottom: 20 
  },
  messageRow: { 
    flexDirection: 'row', 
    alignItems: 'flex-end', 
    marginBottom: 20, 
    maxWidth: '85%' 
  },
  aiRow: { alignSelf: 'flex-start' },
  userRow: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  bubble: { 
    paddingHorizontal: 16, 
    paddingVertical: 10, 
    borderRadius: 20 
  },
  aiBubble: { 
    backgroundColor: 'transparent', 
    borderColor: '#444', 
    borderWidth: 1, 
    borderStyle: 'dotted', 
    marginLeft: 8 
  },
  userBubble: { backgroundColor: '#FFFFFF', marginRight: 8 },
  messageImage: { width: 200, height: 150, borderRadius: 12 },
  audioContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  messageText: { 
    fontSize: 16, 
    lineHeight: 22, 
    fontFamily: Fonts.rounded 
  },
  aiText: { color: '#FFFFFF' },
  userText: { color: '#000000', fontWeight: '500' },
  aiIcon: { marginBottom: 4 },

  infoButton: {
    marginLeft: 8,
    marginBottom: 12,
    padding: 5,
  },

  inputWrapper: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  inputContainer: {
    borderRadius: 28,
    padding: 12,
    backgroundColor: '#FFFFFF',
  },
  input: {
    fontSize: 16,
    minHeight: 24,
    color: '#000',
    paddingHorizontal: 10,
  },
  iconBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  
  // Adjusted the gap to 16 since there are only two icons now
  leftIcons: {
    flexDirection: 'row',
    gap: 16,
    paddingLeft: 8,
  },
  
  sendButton: { paddingRight: 4 },
  
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0, 0, 0, 0.6)', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  modalContent: { 
    width: '85%', 
    backgroundColor: '#FFFFFF', 
    borderRadius: 24, 
    padding: 24, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.25, 
    shadowRadius: 4, 
    elevation: 5 
  },
  modalTitle: { 
    fontSize: 20, 
    fontWeight: 'bold', 
    color: '#000', 
    marginBottom: 20, 
    textAlign: 'center' 
  },
  modalSubtitle: { 
    fontSize: 16, 
    fontWeight: 'bold', 
    color: '#000', 
    marginTop: 10, 
    marginBottom: 5 
  },
  modalText: { 
    fontSize: 15, 
    color: '#444', 
    lineHeight: 22, 
    marginBottom: 10 
  },
  closeModalButton: { 
    marginTop: 20, 
    backgroundColor: '#007AFF', 
    paddingVertical: 14, 
    borderRadius: 16, 
    alignItems: 'center' 
  },
  closeModalButtonText: { 
    color: '#FFFFFF', 
    fontSize: 16, 
    fontWeight: 'bold' 
  }
});