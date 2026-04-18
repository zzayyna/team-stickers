import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { usePatientProfile, type PatientProfile } from '../../context/PatientProfileContext'
import { useIntake } from '../../context/IntakeContext'
import { supabase } from '../../lib/supabase'

function Section({
  title,
  note,
  children,
}: {
  title: string
  note?: string
  children: React.ReactNode
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{title}</Text>
        {note ? <Text style={styles.cardNote}>{note}</Text> : null}
      </View>
      {children}
    </View>
  )
}

function Field({
  label,
  field,
  editing,
  draft,
  profile,
  onChange,
}: {
  label: string
  field: keyof PatientProfile
  editing: boolean
  draft: PatientProfile
  profile: PatientProfile
  onChange: (key: keyof PatientProfile, value: string) => void
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {editing ? (
        <TextInput
          style={styles.fieldInput}
          value={draft[field]}
          onChangeText={(value) => onChange(field, value)}
          autoCorrect={false}
          blurOnSubmit={false}
        />
      ) : (
        <Text style={styles.fieldValue}>{profile[field]}</Text>
      )}
    </View>
  )
}

export default function Profile() {
  const { profile, profileReady, refreshProfile, updateProfile } = usePatientProfile()
  const { updateFromProfile } = useIntake()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<PatientProfile>(profile)
  const initials = `${profile.firstName?.[0] ?? ''}${profile.lastName?.[0] ?? ''}`

  useEffect(() => {
    if (!editing) {
      setDraft(profile)
    }
  }, [profile, editing])

  const startEdit = () => {
    setDraft(profile)
    setEditing(true)
  }

  const cancel = () => {
    setDraft(profile)
    setEditing(false)
  }

  const setField = (key: keyof PatientProfile, value: string) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  const save = async () => {
    try {
      setSaving(true)

      const { data: authData, error: userError } = await supabase.auth.getUser()
      if (userError) {
        console.error('Error getting user:', userError)
        return
      }

      const user = authData.user
      if (!user) {
        console.error('No authenticated user found')
        return
      }

      const { error } = await supabase.from('profiles').upsert({
        id: user.id,
        first_name: draft.firstName,
        middle_initial: draft.middleInitial,
        last_name: draft.lastName,
        dob: draft.dob,
        phone: draft.phone,
        email: draft.email,
        address: draft.address,
        insurance_provider: draft.insuranceProvider,
        insurance_member: draft.insuranceMember,
        insurance_group: draft.insuranceGroup,
        allergies: draft.allergies,
        current_medications: draft.currentMedications,
        hospitalizations: draft.hospitalizations,
        family_history: draft.familyHistory,
        primary_care: draft.primaryCare,
        upcoming_provider: draft.upcomingProvider,
        upcoming_time: draft.upcomingTime,
        upcoming_visit_type: draft.upcomingVisitType,
        updated_at: new Date().toISOString(),
      })

      if (error) {
        console.error('Supabase save error:', error)
        return
      }

      updateProfile(draft)
      setDraft(draft)
      setEditing(false)
      updateFromProfile()
      await refreshProfile()
    } catch (err) {
      console.error('Unexpected save error:', err)
    } finally {
      setSaving(false)
    }
  }

  if (!profileReady) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text>Loading profile...</Text>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>
              {profile.firstName} {profile.lastName}
            </Text>
            <Text style={styles.email}>{profile.email}</Text>
            <Text style={styles.syncNote}>
              Saved information here autofills your next check-in.
            </Text>
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
              <TouchableOpacity onPress={cancel} style={styles.cancelBtn} disabled={saving}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={save} style={styles.saveBtn} disabled={saving}>
                <Text style={styles.saveBtnText}>
                  {saving ? 'Saving...' : 'Save changes'}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <Section title="Patient information" note="Used to prefill identity and contact fields in check-in.">
          <Field label="First name" field="firstName" editing={editing} draft={draft} profile={profile} onChange={setField} />
          <Field label="Middle initial" field="middleInitial" editing={editing} draft={draft} profile={profile} onChange={setField} />
          <Field label="Last name" field="lastName" editing={editing} draft={draft} profile={profile} onChange={setField} />
          <Field label="Date of birth" field="dob" editing={editing} draft={draft} profile={profile} onChange={setField} />
          <Field label="Phone" field="phone" editing={editing} draft={draft} profile={profile} onChange={setField} />
          <Field label="Email" field="email" editing={editing} draft={draft} profile={profile} onChange={setField} />
          <Field label="Address" field="address" editing={editing} draft={draft} profile={profile} onChange={setField} />
        </Section>

        <Section title="Insurance" note="Shown as autofilled from previous data during intake review.">
          <Field label="Provider" field="insuranceProvider" editing={editing} draft={draft} profile={profile} onChange={setField} />
          <Field label="Member ID" field="insuranceMember" editing={editing} draft={draft} profile={profile} onChange={setField} />
          <Field label="Group number" field="insuranceGroup" editing={editing} draft={draft} profile={profile} onChange={setField} />
        </Section>

        <Section title="Medical history" note="Used to prefill allergies, medications, and history for review.">
          <Field label="Known allergies" field="allergies" editing={editing} draft={draft} profile={profile} onChange={setField} />
          <Field label="Current medications" field="currentMedications" editing={editing} draft={draft} profile={profile} onChange={setField} />
          <Field label="Recent hospitalizations" field="hospitalizations" editing={editing} draft={draft} profile={profile} onChange={setField} />
          <Field label="Family history" field="familyHistory" editing={editing} draft={draft} profile={profile} onChange={setField} />
          <Field label="Primary care provider" field="primaryCare" editing={editing} draft={draft} profile={profile} onChange={setField} />
        </Section>

        <Section title="Upcoming visit" note="To reschedule or cancel an appointment, go back to Home and tap the Upcoming visit card.">
          <Text style={styles.fieldValue}>
            {profile.upcomingProvider && profile.upcomingTime && profile.upcomingVisitType
              ? `${profile.upcomingProvider} · ${profile.upcomingTime} · ${profile.upcomingVisitType}`
              : 'No upcoming appointment scheduled.'}
          </Text>
        </Section>

        {editing ? (
          <TouchableOpacity onPress={save} style={[styles.saveBtn, styles.bottomSaveBtn]} disabled={saving}>
            <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save changes'}</Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          style={styles.signOutButton}
          onPress={() => {
            Alert.alert('Sign out', 'Are you sure you want to sign out?', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Sign out',
                style: 'destructive',
                onPress: async () => {
                  await supabase.auth.signOut()
                  router.replace('/(auth)/login')
                },
              },
            ])
          }}
        >
          <Ionicons name="log-out-outline" size={18} color="#A32D2D" />
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
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
  bottomSaveBtn: { alignItems: 'center', justifyContent: 'center', paddingVertical: 14, marginTop: 8, marginBottom: 10 },
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
})
