import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAiAssistant } from '../../context/AiAssistantContext';
import { usePatientProfile } from '../../context/PatientProfileContext';

export default function Home() {
  const { isAiEnabled, enableAi, disableAi } = useAiAssistant();
  const { profile } = usePatientProfile();
  const [privacyModalVisible, setPrivacyModalVisible] = useState(false);

  const handleCheckInPress = () => router.push(isAiEnabled ? '/chat' : '/form');
  const handleAiToggle = (nextValue: boolean) => {
    if (nextValue) {
      setPrivacyModalVisible(true);
    } else {
      disableAi();
    }
  };

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.greeting}>Good morning,</Text>
        <Text style={styles.name}>{profile.firstName} {profile.lastName}</Text>

        <TouchableOpacity style={styles.apptCard} onPress={handleCheckInPress}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.apptLabel}>Upcoming visit</Text>
            <Ionicons name="chevron-forward" size={18} color="#9A938A" />
          </View>
          <Text style={styles.apptDoctor}>{profile.upcomingProvider}</Text>
          <Text style={styles.apptTime}>{profile.upcomingTime} · {profile.upcomingVisitType}</Text>
          <View style={styles.checkinButton}>
            <Text style={styles.checkinText}>{isAiEnabled ? 'Start pre-visit check-in' : 'Open manual intake'}</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.preferenceCard}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.preferenceTitle}>AI pre-visit assistant</Text>
            <Text style={styles.preferenceSubtext}>
              Ask one question at a time, build a draft, then review it together.
            </Text>
          </View>
          <Switch
            value={isAiEnabled}
            onValueChange={handleAiToggle}
            trackColor={{ false: '#D8D4CD', true: '#F4C991' }}
            thumbColor={isAiEnabled ? '#E8820C' : '#FFFFFF'}
          />
        </View>

        <Text style={styles.sectionTitle}>Quick actions</Text>
        <View style={styles.grid}>
          <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/form')}>
            <View style={[styles.actionIcon, { backgroundColor: '#EFF5FB' }]} />
            <Text style={styles.actionTitle}>Review intake</Text>
            <Text style={styles.actionSub}>Check sections before your visit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/profile')}>
            <View style={[styles.actionIcon, { backgroundColor: '#FAEEDA' }]} />
            <Text style={styles.actionTitle}>Update profile</Text>
            <Text style={styles.actionSub}>Edit saved information and insurance</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={privacyModalVisible} transparent animationType="fade" onRequestClose={() => setPrivacyModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.disclaimerCard}>
            <Text style={styles.disclaimerTitle}>AI privacy reminder</Text>
            <Text style={styles.disclaimerText}>
              The AI intake assistant helps organize your check-in conversation. It should stay within the check-in flow and should not share personal medical details outside your care experience.
            </Text>
            <Text style={styles.disclaimerText}>
              Some de-identified conversation data may be reviewed to improve the system, but direct personal identifiers should not be used for model training.
            </Text>
            <TouchableOpacity style={styles.primaryButton} onPress={() => { enableAi(); setPrivacyModalVisible(false); }}>
              <Text style={styles.primaryButtonText}>Turn on AI assistant</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => { disableAi(); setPrivacyModalVisible(false); }}>
              <Text style={styles.secondaryButtonText}>Keep manual intake</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFDF9' },
  content: { padding: 24, paddingTop: 64, paddingBottom: 40 },
  greeting: { fontSize: 18, color: '#8C857D' },
  name: { fontSize: 34, fontWeight: '700', color: '#2C2C2A', marginBottom: 18 },
  apptCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20, borderWidth: 1, borderColor: '#E5DED4', marginBottom: 16 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  apptLabel: { fontSize: 13, color: '#8C857D', textTransform: 'uppercase', letterSpacing: 0.8 },
  apptDoctor: { fontSize: 21, fontWeight: '700', color: '#2C2C2A', marginBottom: 4 },
  apptTime: { fontSize: 15, color: '#6F6A63', marginBottom: 16 },
  checkinButton: { backgroundColor: '#F6EAD6', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  checkinText: { color: '#A36A09', fontWeight: '700', fontSize: 15 },
  preferenceCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#E5DED4', flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  preferenceTitle: { fontSize: 18, fontWeight: '700', color: '#2C2C2A', marginBottom: 4 },
  preferenceSubtext: { fontSize: 14, lineHeight: 21, color: '#6F6A63' },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: '#888780', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.7 },
  grid: { flexDirection: 'row', gap: 10 },
  actionCard: { flex: 1, backgroundColor: '#fff', borderRadius: 18, padding: 14, borderWidth: 1, borderColor: '#E5DED4' },
  actionIcon: { width: 34, height: 34, borderRadius: 10, marginBottom: 12 },
  actionTitle: { fontSize: 15, fontWeight: '700', color: '#2C2C2A', marginBottom: 4 },
  actionSub: { fontSize: 12, lineHeight: 18, color: '#888780' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(44,44,42,0.32)', justifyContent: 'center', padding: 20 },
  disclaimerCard: { backgroundColor: '#FFFDF9', borderRadius: 24, padding: 22 },
  disclaimerTitle: { fontSize: 22, fontWeight: '700', color: '#2C2C2A', marginBottom: 12 },
  disclaimerText: { fontSize: 14, lineHeight: 22, color: '#5F5A53', marginBottom: 12 },
  primaryButton: { backgroundColor: '#E8820C', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 6, marginBottom: 10 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  secondaryButton: { backgroundColor: '#F6F1E8', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  secondaryButtonText: { color: '#6F6A63', fontSize: 15, fontWeight: '600' },
});
