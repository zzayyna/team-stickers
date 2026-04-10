import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { usePatientProfile, type PatientProfile } from '../../context/PatientProfileContext';
import { useIntake } from '../../context/IntakeContext';

export default function Profile() {
  const { profile, updateProfile } = usePatientProfile();
  const { updateFromProfile } = useIntake();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<PatientProfile>(profile);

  const startEdit = () => {
    setDraft(profile);
    setEditing(true);
  };

  const save = () => {
    updateProfile(draft);
    updateFromProfile();
    setEditing(false);
  };

  const cancel = () => {
    setDraft(profile);
    setEditing(false);
  };

  const set = (key: keyof PatientProfile) => (value: string) => setDraft((prev) => ({ ...prev, [key]: value }));

  const Section = ({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{title}</Text>
        {note ? <Text style={styles.cardNote}>{note}</Text> : null}
      </View>
      {children}
    </View>
  );

  const Field = ({ label, field }: { label: string; field: keyof PatientProfile }) => (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {editing ? (
        <TextInput style={styles.fieldInput} value={draft[field]} onChangeText={set(field)} />
      ) : (
        <Text style={styles.fieldValue}>{profile[field]}</Text>
      )}
    </View>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{profile.firstName[0]}{profile.lastName[0]}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{profile.firstName} {profile.lastName}</Text>
          <Text style={styles.email}>{profile.email}</Text>
          <Text style={styles.syncNote}>Saved information here autofills your next check-in.</Text>
        </View>
      </View>

      <View style={styles.actionRow}>
        {!editing ? (
          <TouchableOpacity onPress={startEdit} style={styles.editBtn}>
            <Ionicons name="pencil" size={16} color="#E8820C" />
            <Text style={styles.editBtnText}>Edit profile</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity onPress={cancel} style={styles.cancelBtn}><Text style={styles.cancelBtnText}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity onPress={save} style={styles.saveBtn}><Text style={styles.saveBtnText}>Save changes</Text></TouchableOpacity>
          </>
        )}
      </View>

      <Section title="Patient information" note="Used to prefill identity and contact fields in check-in.">
        <Field label="First name" field="firstName" />
        <Field label="Middle initial" field="middleInitial" />
        <Field label="Last name" field="lastName" />
        <Field label="Date of birth" field="dob" />
        <Field label="Phone" field="phone" />
        <Field label="Email" field="email" />
        <Field label="Address" field="address" />
      </Section>

      <Section title="Insurance" note="Shown as autofilled from previous data during intake review.">
        <Field label="Provider" field="insuranceProvider" />
        <Field label="Member ID" field="insuranceMember" />
        <Field label="Group number" field="insuranceGroup" />
      </Section>

      <Section title="Medical history" note="Used to prefill allergies, medications, and history for review.">
        <Field label="Known allergies" field="allergies" />
        <Field label="Current medications" field="currentMedications" />
        <Field label="Recent hospitalizations" field="hospitalizations" />
        <Field label="Family history" field="familyHistory" />
        <Field label="Primary care provider" field="primaryCare" />
      </Section>

      <Section title="Upcoming visit">
        <Field label="Provider" field="upcomingProvider" />
        <Field label="Time" field="upcomingTime" />
        <Field label="Visit type" field="upcomingVisitType" />
      </Section>

      <TouchableOpacity style={styles.signOutButton} onPress={() => router.replace('/(auth)/login')}>
        <Ionicons name="log-out-outline" size={18} color="#A32D2D" />
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFDF9' },
  content: { padding: 24, paddingTop: 60, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18 },
  avatar: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#FAEEDA', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 20, fontWeight: '700', color: '#E8820C' },
  name: { fontSize: 22, fontWeight: '700', color: '#2C2C2A' },
  email: { fontSize: 13, color: '#888780' },
  syncNote: { fontSize: 13, color: '#6F6A63', marginTop: 6, lineHeight: 18 },
  actionRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginBottom: 14 },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#E8820C' },
  editBtnText: { color: '#E8820C', fontSize: 14, fontWeight: '600' },
  cancelBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#D3D1C7' },
  cancelBtnText: { color: '#888780', fontSize: 13 },
  saveBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: '#E8820C' },
  saveBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 18, borderWidth: 1, borderColor: '#E5DED4', marginBottom: 14 },
  cardHeader: { marginBottom: 12 },
  cardTitle: { fontSize: 22, fontWeight: '700', color: '#2C2C2A' },
  cardNote: { fontSize: 12, color: '#888780', marginTop: 4, lineHeight: 18 },
  field: { marginBottom: 12 },
  fieldLabel: { fontSize: 12, color: '#888780', marginBottom: 4 },
  fieldValue: { fontSize: 15, color: '#2C2C2A', lineHeight: 21 },
  fieldInput: { fontSize: 15, color: '#2C2C2A', borderWidth: 1, borderColor: '#E5DED4', borderRadius: 10, padding: 10, backgroundColor: '#FFFDF9' },
  signOutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FCEBEB', borderRadius: 12, padding: 14, marginTop: 8 },
  signOutText: { color: '#A32D2D', fontWeight: '600', fontSize: 14 },
});
