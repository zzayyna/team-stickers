import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput } from 'react-native';
import { router } from 'expo-router';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';

const INITIAL_PROFILE = {
    firstName: 'John',
    middleInitial: 'A',
    lastName: 'Mango',
    dob: '07/22/1967',
    email: 'john.mango@email.com',
    phone: '(555) 123-4567',
    address: '123 Main St, College Station, TX 77840',
    insuranceProvider: 'Blue Cross Blue Shield',
    insuranceMember: 'JM123456789',
    insuranceGroup: 'GRP-00421',
    allergies: 'N/A',
    hospitalizations: 'N/A',
    familyHistory: 'Father: Diabetes, Grandmother: Breast Cancer',
    currentMedications: 'N/A',
    primaryCare: 'Dr. Sarah Chen',
};

export default function Profile() {
    const [editing, setEditing] = useState(false);
    const [profile, setProfile] = useState(INITIAL_PROFILE);
    const [draft, setDraft] = useState(INITIAL_PROFILE);

    const handleEdit = () => { setDraft(profile); setEditing(true); };
    const handleSave = () => { setProfile(draft); setEditing(false); };
    const handleCancel = () => { setDraft(profile); setEditing(false); };
    const handleSignOut = () => router.replace('/(auth)/login');

    const set = (key: keyof typeof INITIAL_PROFILE) => (val: string) =>
        setDraft(d => ({ ...d, [key]: val }));

    const Field = ({ label, value, field }: { label: string; value: string; field: keyof typeof INITIAL_PROFILE }) => (
        <View style={styles.field}>
            <Text style={styles.fieldLabel}>{label}</Text>
            {editing
                ? <TextInput style={styles.fieldInput} value={draft[field]} onChangeText={set(field)} />
                : <Text style={styles.fieldValue}>{value}</Text>}
        </View>
    );

    const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
        <View style={styles.card}>
            <Text style={styles.cardTitle}>{title}</Text>
            {children}
        </View>
    );

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>

            {/* Header */}
            <View style={styles.header}>
                <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                        {profile.firstName[0]}{profile.lastName[0]}
                    </Text>
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{profile.firstName} {profile.lastName}</Text>
                    <Text style={styles.email}>{profile.email}</Text>
                </View>
                {!editing
                    ? <TouchableOpacity onPress={handleEdit} style={styles.editBtn}>
                        <Ionicons name="pencil" size={16} color="#E8820C" />
                        <Text style={styles.editBtnText}>Edit</Text>
                    </TouchableOpacity>
                    : <View style={styles.editActions}>
                        <TouchableOpacity onPress={handleCancel} style={styles.cancelBtn}>
                            <Text style={styles.cancelBtnText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleSave} style={styles.saveBtn}>
                            <Text style={styles.saveBtnText}>Save</Text>
                        </TouchableOpacity>
                    </View>
                }
            </View>

            {/* Personal Info */}
            <Section title="Personal information">
                <Field label="First name" value={profile.firstName} field="firstName" />
                <Field label="Middle initial" value={profile.middleInitial} field="middleInitial" />
                <Field label="Last name" value={profile.lastName} field="lastName" />
                <Field label="Date of birth" value={profile.dob} field="dob" />
            </Section>

            {/* Contact */}
            <Section title="Contact information">
                <Field label="Email" value={profile.email} field="email" />
                <Field label="Phone" value={profile.phone} field="phone" />
                <Field label="Address" value={profile.address} field="address" />
            </Section>

            {/* Insurance */}
            <Section title="Insurance information">
                <Field label="Provider" value={profile.insuranceProvider} field="insuranceProvider" />
                <Field label="Member ID" value={profile.insuranceMember} field="insuranceMember" />
                <Field label="Group number" value={profile.insuranceGroup} field="insuranceGroup" />
            </Section>

            {/* Medical History */}
            <Section title="Medical history">
                <Field label="Known allergies" value={profile.allergies} field="allergies" />
                <Field label="Current medications" value={profile.currentMedications} field="currentMedications" />
                <Field label="Recent hospitalizations" value={profile.hospitalizations} field="hospitalizations" />
                <Field label="Family history" value={profile.familyHistory} field="familyHistory" />
                <Field label="Primary care physician" value={profile.primaryCare} field="primaryCare" />
            </Section>

            {/* Upcoming Appointments */}
            <Section title="Upcoming appointments">
                <View style={styles.apptRow}>
                    <Ionicons name="calendar-outline" size={16} color="#E8820C" style={{ marginRight: 8, marginTop: 2 }} />
                    <View>
                        <Text style={styles.apptDoctor}>Dr. Sarah Chen</Text>
                        <Text style={styles.apptTime}>Today · 2:30 PM · General Checkup</Text>
                    </View>
                </View>
            </Section>

            {/* Sign out */}
            <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
                <Ionicons name="log-out-outline" size={18} color="#A32D2D" />
                <Text style={styles.signOutText}>Sign out</Text>
            </TouchableOpacity>

        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFDF9' },
    content: { padding: 24, paddingTop: 60, paddingBottom: 40 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 24 },
    avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#FAEEDA', alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontSize: 18, fontWeight: '500', color: '#E8820C' },
    name: { fontSize: 16, fontWeight: '500', color: '#2C2C2A' },
    email: { fontSize: 12, color: '#888780' },
    editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 0.5, borderColor: '#E8820C' },
    editBtnText: { color: '#E8820C', fontSize: 13 },
    editActions: { flexDirection: 'row', gap: 8 },
    cancelBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 0.5, borderColor: '#D3D1C7' },
    cancelBtnText: { color: '#888780', fontSize: 13 },
    saveBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#E8820C' },
    saveBtnText: { color: '#fff', fontSize: 13 },
    card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 0.5, borderColor: '#D3D1C7', marginBottom: 12 },
    cardTitle: { fontSize: 12, fontWeight: '500', color: '#888780', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
    field: { marginBottom: 12 },
    fieldLabel: { fontSize: 11, color: '#888780', marginBottom: 3 },
    fieldValue: { fontSize: 14, color: '#2C2C2A' },
    fieldInput: { fontSize: 14, color: '#2C2C2A', borderWidth: 0.5, borderColor: '#E8820C', borderRadius: 8, padding: 8, backgroundColor: '#FFFDF9' },
    apptRow: { flexDirection: 'row', alignItems: 'flex-start' },
    apptDoctor: { fontSize: 14, color: '#2C2C2A' },
    apptTime: { fontSize: 12, color: '#888780' },
    signOutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FCEBEB', borderRadius: 12, padding: 14, marginTop: 8 },
    signOutText: { color: '#A32D2D', fontWeight: '500', fontSize: 14 },
});