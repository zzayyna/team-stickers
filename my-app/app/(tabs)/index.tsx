import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { router } from 'expo-router';

export default function Home() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.greeting}>Good morning,</Text>
      <Text style={styles.name}>John Mango</Text>

      {/* Appointment card */}
      <TouchableOpacity style={styles.apptCard} onPress={() => router.push('/chat')}>
        <Text style={styles.apptLabel}>Upcoming visit</Text>
        <Text style={styles.apptDoctor}>Dr. Sarah Chen</Text>
        <Text style={styles.apptTime}>Today · 2:30 PM · General Checkup</Text>
        <View style={styles.checkinButton}>
          <Text style={styles.checkinText}>Start pre-visit check-in →</Text>
        </View>
      </TouchableOpacity>

      {/* Quick actions */}
      <Text style={styles.sectionTitle}>Quick actions</Text>
      <View style={styles.grid}>
        <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/chat')}>
          <View style={[styles.actionIcon, { backgroundColor: '#FAEEDA' }]} />
          <Text style={styles.actionTitle}>Book an Appointment</Text>
          <Text style={styles.actionSub}>Lorem Ipsum</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/profile')}>
          <View style={[styles.actionIcon, { backgroundColor: '#E1F5EE' }]} />
          <Text style={styles.actionTitle}>Update Records</Text>
          <Text style={styles.actionSub}>Lorem Ipsum</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFDF9' },
  content: { padding: 24, paddingTop: 60 },
  greeting: { fontSize: 14, color: '#888780', marginBottom: 2 },
  name: { fontSize: 24, fontWeight: '500', color: '#2C2C2A', marginBottom: 20 },
  apptCard: {
    backgroundColor: '#E8820C',
    borderRadius: 16,
    padding: 18,
    marginBottom: 24,
  },
  apptLabel: { fontSize: 11, color: '#FAC775', marginBottom: 4 },
  apptDoctor: { fontSize: 16, fontWeight: '500', color: '#fff', marginBottom: 2 },
  apptTime: { fontSize: 12, color: '#FAC775' },
  checkinButton: {
    marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    padding: 10,
  },
  checkinText: { fontSize: 12, color: '#fff' },
  sectionTitle: { fontSize: 13, fontWeight: '500', color: '#888780', marginBottom: 10 },
  grid: { flexDirection: 'row', gap: 10 },
  actionCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 0.5,
    borderColor: '#D3D1C7',
  },
  actionIcon: { width: 28, height: 28, borderRadius: 8, marginBottom: 10 },
  actionTitle: { fontSize: 13, fontWeight: '500', color: '#2C2C2A', marginBottom: 2 },
  actionSub: { fontSize: 11, color: '#888780' },
});