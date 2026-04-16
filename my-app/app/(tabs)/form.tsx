import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useIntake, type RelevantVisitField, type SectionStatus } from '../../context/IntakeContext';
import { usePatientProfile } from '../../context/PatientProfileContext';
import { supabase } from '../../lib/supabase';

const statusMap: Record<SectionStatus, { label: string; tone: string; bg: string; border: string }> = {
  not_started: { label: 'Not started', tone: '#8D857B', bg: '#F6F1E8', border: '#E5DED4' },
  in_progress: { label: 'In progress', tone: '#9B7B3E', bg: '#F7F1E7', border: '#E5DED4' },
  review_needed: { label: 'From previous data', tone: '#2F8A57', bg: '#E9F5EC', border: '#C6E2CF' },
  missing_info: { label: 'Attention', tone: '#A44F56', bg: '#F9EDEE', border: '#E5B9BE' },
  complete: { label: 'Complete', tone: '#2F8A57', bg: '#E9F5EC', border: '#C6E2CF' },
};

type SectionKey = 'patient_information' | 'insurance' | 'medical_history' | 'visit_details' | 'additional_concerns';

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailLine}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value || 'Not provided'}</Text>
    </View>
  );
}

function VisitFieldLine({ field }: { field: RelevantVisitField }) {
  return <DetailLine label={field.label} value={field.value} />;
}

function SectionCard({
  icon,
  title,
  subtitle,
  detail,
  status,
  expanded,
  onPress,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  detail: string;
  status: SectionStatus;
  expanded: boolean;
  onPress: () => void;
  children?: React.ReactNode;
}) {
  const meta = statusMap[status];
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={[styles.sectionCard, { borderColor: meta.border, backgroundColor: status === 'review_needed' ? '#F7FCF8' : '#FFFFFF' }]}>
      <View style={styles.sectionTop}>
        <View style={styles.iconBox}><Ionicons name={icon} size={28} color="#3F6F93" /></View>
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Text style={styles.sectionTitle}>{title}</Text>
            <View style={[styles.badge, { backgroundColor: meta.bg }]}><Text style={[styles.badgeText, { color: meta.tone }]}>{meta.label}</Text></View>
          </View>
          <Text style={styles.sectionSubtitle}>{subtitle}</Text>
          <Text style={[styles.sectionDetail, { color: meta.tone }]}>{detail}</Text>
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-forward'} size={22} color="#B3ABA1" />
      </View>
      {expanded ? <View style={styles.expandedArea}>{children}</View> : null}
    </TouchableOpacity>
  );
}

function formatVisitCategory(value: string) {
  if (!value.trim()) return 'Not assigned yet';
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

export default function IntakeReview() {
  const { profile } = usePatientProfile();
  const { draftForm, sectionStatus } = useIntake();
  const [expandedSection, setExpandedSection] = useState<SectionKey | null>('visit_details');
  const [saving, setSaving] = useState(false);
  const [currentFormId, setCurrentFormId] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const completedCount = Object.values(sectionStatus).filter((status) => status !== 'not_started').length;
  const headerTitle = `${profile.firstName} ${profile.lastName}`;
  const headerSubtitle = `${profile.upcomingProvider} · ${profile.upcomingTime} · ${profile.upcomingVisitType}`;
  const visitDetailText = useMemo(() => {
    if (!draftForm.visit_context.chief_concern) return 'Start chat to build a visit-specific section for this appointment.';
    return draftForm.visit_context.source_note || 'AI tailored these details to your current visit.';
  }, [draftForm.visit_context]);

  const visitSectionTitle = draftForm.visit_context.section_title.trim() || 'Generated visit summary';
  const visitSectionSubtitle = draftForm.visit_context.section_subtitle.trim() || 'Created dynamically from your conversation for this appointment';

  const toggle = (key: SectionKey) => setExpandedSection((prev) => (prev === key ? null : key));

  const saveFormToDatabase = async () => {
    try {
      setSaving(true);

      const { data: authData, error: userError } = await supabase.auth.getUser();
      if (userError) {
        console.error('Error getting user:', userError);
        return;
      }

      const user = authData.user;
      if (!user) {
        console.error('No authenticated user found');
        return;
      }

      const payload = {
        user_id: user.id,
        patient_information: draftForm.patient_information,
        insurance_information: draftForm.insurance_information,
        medical_history: draftForm.medical_history,
        visit_context: draftForm.visit_context,
        additional_concerns: draftForm.additional_concerns,
        updated_at: new Date().toISOString(),
      };

      if (currentFormId) {
        const { error } = await supabase
          .from('intake_forms')
          .update(payload)
          .eq('id', currentFormId);

        if (error) {
          console.error('Error updating form:', error);
          return;
        }
      } else {
        const { data, error } = await supabase
          .from('intake_forms')
          .insert(payload)
          .select('id')
          .single();

        if (error) {
          console.error('Error creating form:', error);
          return;
        }

        setCurrentFormId(data.id);
      }

      console.log('Form saved successfully');
      setSaveSuccess(true);

    } catch (err) {
      console.error('Unexpected form save error:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.heroCard}>
        <Text style={styles.heroTitle}>{headerTitle}</Text>
        <Text style={styles.heroSubtitle}>{headerSubtitle}</Text>
        <View style={styles.progressRow}>
          {[0, 1, 2, 3, 4].map((i) => <View key={i} style={[styles.progressBar, i < completedCount ? styles.progressBarActive : null]} />)}
        </View>
        <Text style={styles.progressText}>Intake sections {completedCount}/5</Text>
        <Text style={styles.heroBody}>Saved profile information fills the background sections. The AI generates one visit-specific section from the conversation instead of forcing every appointment into the same form.</Text>
      </View>

      <SectionCard
        icon="person-circle-outline"
        title="Patient Information"
        subtitle="Demographics, contact info"
        detail={draftForm.patient_information.source_note || 'This section has not been filled out yet.'}
        status={sectionStatus.patient_information}
        expanded={expandedSection === 'patient_information'}
        onPress={() => toggle('patient_information')}
      >
        <DetailLine label="Full name" value={draftForm.patient_information.full_name} />
        <DetailLine label="Date of birth" value={draftForm.patient_information.date_of_birth} />
        <DetailLine label="Phone" value={draftForm.patient_information.phone_number} />
        <DetailLine label="Email" value={draftForm.patient_information.email} />
        <DetailLine label="Address" value={draftForm.patient_information.address} />
      </SectionCard>

      <SectionCard
        icon="shield-checkmark-outline"
        title="Insurance"
        subtitle="Current coverage and policy details"
        detail={draftForm.insurance_information.source_note || 'This section has not been filled out yet.'}
        status={sectionStatus.insurance}
        expanded={expandedSection === 'insurance'}
        onPress={() => toggle('insurance')}
      >
        <DetailLine label="Provider" value={draftForm.insurance_information.provider_name} />
        <DetailLine label="Member ID" value={draftForm.insurance_information.member_id} />
        <DetailLine label="Group number" value={draftForm.insurance_information.group_number} />
      </SectionCard>

      <SectionCard
        icon="medical-outline"
        title="Medical History"
        subtitle="Conditions, medications, allergies"
        detail={draftForm.medical_history.source_note || 'This section has not been filled out yet.'}
        status={sectionStatus.medical_history}
        expanded={expandedSection === 'medical_history'}
        onPress={() => toggle('medical_history')}
      >
        <DetailLine label="Allergies" value={draftForm.medical_history.allergies} />
        <DetailLine label="Current medications" value={draftForm.medical_history.current_medications} />
        <DetailLine label="Past hospitalizations" value={draftForm.medical_history.past_surgeries_or_hospitalizations} />
        <DetailLine label="Family history" value={draftForm.medical_history.family_history} />
      </SectionCard>

      <SectionCard
        icon="pulse-outline"
        title={visitSectionTitle}
        subtitle={visitSectionSubtitle}
        detail={visitDetailText}
        status={sectionStatus.visit_details}
        expanded={expandedSection === 'visit_details'}
        onPress={() => toggle('visit_details')}
      >
        {draftForm.visit_context.summary_for_clinician ? <DetailLine label="Clinician summary" value={draftForm.visit_context.summary_for_clinician} /> : null}
        {draftForm.visit_context.relevant_fields.length > 0 ? draftForm.visit_context.relevant_fields.map((field) => (
          <VisitFieldLine key={field.key} field={field} />
        )) : <DetailLine label="Generated section" value="The assistant has not generated a visit-specific section yet." />}
        {draftForm.visit_context.visit_category ? <DetailLine label="Visit category" value={formatVisitCategory(draftForm.visit_context.visit_category)} /> : null}
        {draftForm.visit_context.chief_concern ? <DetailLine label="Chief concern" value={draftForm.visit_context.chief_concern} /> : null}
        <DetailLine label="Draft source" value={draftForm.visit_context.source_note || ''} />
      </SectionCard>

      <SectionCard
        icon="chatbubble-ellipses-outline"
        title="Additional Concerns"
        subtitle="Anything else you would like to add?"
        detail={draftForm.additional_concerns.patient_notes || draftForm.additional_concerns.ai_drafted_notes || 'This section has not been filled out yet.'}
        status={sectionStatus.additional_concerns}
        expanded={expandedSection === 'additional_concerns'}
        onPress={() => toggle('additional_concerns')}
      >
        <DetailLine label="Patient notes" value={draftForm.additional_concerns.patient_notes} />
        <DetailLine label="AI drafted notes" value={draftForm.additional_concerns.ai_drafted_notes} />
      </SectionCard>

      {saveSuccess && (
        <Text style={{ textAlign: 'center', color: 'green', marginTop: 10 }}>
          ✓ Saved successfully
        </Text>
      )}

      <TouchableOpacity onPress={saveFormToDatabase} style={styles.saveButton} disabled={saving}>
        <Text style={styles.saveText}>
          {saving ? 'Saving...' : 'Save'}
        </Text>
      </TouchableOpacity>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F5F0' },
  content: { padding: 20, paddingTop: 52, paddingBottom: 36, gap: 14 },
  heroCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 22, borderWidth: 1, borderColor: '#E5DED4', marginBottom: 8 },
  heroTitle: { fontSize: 22, fontWeight: '700', color: '#355A82', marginBottom: 6 },
  heroSubtitle: { fontSize: 14, color: '#6F6A63', marginBottom: 18 },
  progressRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  progressBar: { height: 10, flex: 1, backgroundColor: '#D5DBE4', borderRadius: 999 },
  progressBarActive: { backgroundColor: '#6B9BC8' },
  progressText: { fontSize: 16, fontWeight: '600', color: '#2C2C2A', marginBottom: 10 },
  heroBody: { fontSize: 14, lineHeight: 21, color: '#6F6A63' },
  sectionCard: { borderRadius: 24, padding: 18, borderWidth: 1.5 },
  sectionTop: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  iconBox: { width: 58, height: 58, borderRadius: 16, backgroundColor: '#EEF3F8', alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 6 },
  sectionTitle: { fontSize: 21, fontWeight: '700', color: '#171717' },
  badge: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  badgeText: { fontSize: 13, fontWeight: '700' },
  sectionSubtitle: { fontSize: 14, color: '#44413D', marginBottom: 6 },
  sectionDetail: { fontSize: 13, lineHeight: 18 },
  expandedArea: { marginTop: 16, borderTopWidth: 1, borderTopColor: '#ECE3D7', paddingTop: 12, gap: 10 },
  detailLine: { gap: 4 },
  detailLabel: { fontSize: 12, color: '#8E857A', textTransform: 'uppercase', letterSpacing: 0.9 },
  detailValue: { fontSize: 15, color: '#2B2926', lineHeight: 21 },
  saveButton: { backgroundColor: '#E8820C', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
