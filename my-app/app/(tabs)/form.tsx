import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useIntake, type RelevantVisitField, type SectionStatus } from '../../context/IntakeContext';
import { usePatientProfile } from '../../context/PatientProfileContext';
import { useAiAssistant } from '../../context/AiAssistantContext';
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

function EditableField({ label, value, multiline = false, onChangeText }: { label: string; value: string; multiline?: boolean; onChangeText: (value: string) => void }) {
  return (
    <View style={styles.editFieldWrap}>
      <Text style={styles.detailLabel}>{label}</Text>
      <TextInput
        style={[styles.editInput, multiline && styles.editInputMultiline]}
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        placeholder={`Enter ${label.toLowerCase()}`}
        placeholderTextColor="#9D948A"
      />
    </View>
  );
}

function RelevantVisitFieldEditor({
  field,
  index,
  onChange,
  onRemove,
}: {
  field: RelevantVisitField;
  index: number;
  onChange: (index: number, patch: Partial<RelevantVisitField>) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <View style={styles.dynamicFieldCard}>
      <View style={styles.dynamicFieldHeader}>
        <Text style={styles.dynamicFieldTitle}>Visit detail {index + 1}</Text>
        <TouchableOpacity onPress={() => onRemove(index)}>
          <Ionicons name="trash-outline" size={18} color="#A44F56" />
        </TouchableOpacity>
      </View>
      <EditableField label="Label" value={field.label} onChangeText={(value) => onChange(index, { label: value, key: value.toLowerCase().replace(/\s+/g, '_') })} />
      <EditableField label="Value" value={field.value} multiline onChangeText={(value) => onChange(index, { value })} />
    </View>
  );
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
    <TouchableOpacity activeOpacity={0.94} onPress={onPress} style={[styles.sectionCard, { borderColor: meta.border, backgroundColor: status === 'review_needed' ? '#F7FCF8' : '#FFFFFF' }]}>
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
  return value.replace(/_/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase());
}

export default function IntakeReview() {
  const { profile } = usePatientProfile();
  const { isAiEnabled } = useAiAssistant();
  const {
    draftForm,
    sectionStatus,
    updateSectionField,
    addRelevantField,
    removeRelevantField,
    updateRelevantField,
  } = useIntake();

  const [expandedSection, setExpandedSection] = useState<SectionKey | null>('visit_details');
  const [saving, setSaving] = useState(false);
  const [currentFormId, setCurrentFormId] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [editingEnabled, setEditingEnabled] = useState(!isAiEnabled);

  const completedCount = Object.values(sectionStatus).filter((status) => status !== 'not_started').length;
  const headerTitle = `${profile.firstName} ${profile.lastName}`;
  const headerSubtitle = profile.upcomingProvider && profile.upcomingTime && profile.upcomingVisitType
    ? `${profile.upcomingProvider} · ${profile.upcomingTime} · ${profile.upcomingVisitType}`
    : 'No appointment scheduled yet';

  const visitDetailText = useMemo(() => {
    if (!draftForm.visit_context.chief_concern) return 'Start chat or type in your visit details manually for this appointment.';
    return draftForm.visit_context.source_note || 'These visit details reflect the current appointment.';
  }, [draftForm.visit_context]);

  const visitSectionTitle = draftForm.visit_context.section_title.trim() || 'Visit details';
  const visitSectionSubtitle = draftForm.visit_context.section_subtitle.trim() || 'Dynamic section tailored to the reason for this visit';

  const toggle = (key: SectionKey) => setExpandedSection((prev) => (prev === key ? null : key));

  const saveFormToDatabase = async () => {
    try {
      setSaving(true);
      setSaveSuccess(false);

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
        const { error } = await supabase.from('intake_forms').update(payload).eq('id', currentFormId);
        if (error) {
          console.error('Error updating form:', error);
          return;
        }
      } else {
        const { data, error } = await supabase.from('intake_forms').insert(payload).select('id').single();
        if (error) {
          console.error('Error creating form:', error);
          return;
        }
        setCurrentFormId(data.id);
      }

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
        <Text style={styles.heroBody}>
          Saved profile information fills the background sections. Visit-specific details can come from the AI conversation or be entered manually when the patient skips AI.
        </Text>

        <View style={styles.heroActionRow}>
          <TouchableOpacity style={[styles.heroAction, styles.secondaryAction]} onPress={() => setEditingEnabled((prev) => !prev)}>
            <Text style={styles.secondaryActionText}>{editingEnabled ? 'View only' : 'Edit intake'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.heroAction} onPress={saveFormToDatabase} disabled={saving}>
            <Text style={styles.heroActionText}>{saving ? 'Saving...' : 'Save intake'}</Text>
          </TouchableOpacity>
        </View>
        {saveSuccess ? <Text style={styles.saveSuccess}>Saved successfully.</Text> : null}
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
        {editingEnabled ? (
          <>
            <EditableField label="Full name" value={draftForm.patient_information.full_name} onChangeText={(value) => updateSectionField('patient_information', 'full_name', value)} />
            <EditableField label="Date of birth" value={draftForm.patient_information.date_of_birth} onChangeText={(value) => updateSectionField('patient_information', 'date_of_birth', value)} />
            <EditableField label="Phone" value={draftForm.patient_information.phone_number} onChangeText={(value) => updateSectionField('patient_information', 'phone_number', value)} />
            <EditableField label="Email" value={draftForm.patient_information.email} onChangeText={(value) => updateSectionField('patient_information', 'email', value)} />
            <EditableField label="Address" value={draftForm.patient_information.address} multiline onChangeText={(value) => updateSectionField('patient_information', 'address', value)} />
          </>
        ) : (
          <>
            <DetailLine label="Full name" value={draftForm.patient_information.full_name} />
            <DetailLine label="Date of birth" value={draftForm.patient_information.date_of_birth} />
            <DetailLine label="Phone" value={draftForm.patient_information.phone_number} />
            <DetailLine label="Email" value={draftForm.patient_information.email} />
            <DetailLine label="Address" value={draftForm.patient_information.address} />
          </>
        )}
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
        {editingEnabled ? (
          <>
            <EditableField label="Provider" value={draftForm.insurance_information.provider_name} onChangeText={(value) => updateSectionField('insurance_information', 'provider_name', value)} />
            <EditableField label="Member ID" value={draftForm.insurance_information.member_id} onChangeText={(value) => updateSectionField('insurance_information', 'member_id', value)} />
            <EditableField label="Group number" value={draftForm.insurance_information.group_number} onChangeText={(value) => updateSectionField('insurance_information', 'group_number', value)} />
          </>
        ) : (
          <>
            <DetailLine label="Provider" value={draftForm.insurance_information.provider_name} />
            <DetailLine label="Member ID" value={draftForm.insurance_information.member_id} />
            <DetailLine label="Group number" value={draftForm.insurance_information.group_number} />
          </>
        )}
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
        {editingEnabled ? (
          <>
            <EditableField label="Allergies" value={draftForm.medical_history.allergies} multiline onChangeText={(value) => updateSectionField('medical_history', 'allergies', value)} />
            <EditableField label="Current medications" value={draftForm.medical_history.current_medications} multiline onChangeText={(value) => updateSectionField('medical_history', 'current_medications', value)} />
            <EditableField label="Past hospitalizations" value={draftForm.medical_history.past_surgeries_or_hospitalizations} multiline onChangeText={(value) => updateSectionField('medical_history', 'past_surgeries_or_hospitalizations', value)} />
            <EditableField label="Family history" value={draftForm.medical_history.family_history} multiline onChangeText={(value) => updateSectionField('medical_history', 'family_history', value)} />
          </>
        ) : (
          <>
            <DetailLine label="Allergies" value={draftForm.medical_history.allergies} />
            <DetailLine label="Current medications" value={draftForm.medical_history.current_medications} />
            <DetailLine label="Past hospitalizations" value={draftForm.medical_history.past_surgeries_or_hospitalizations} />
            <DetailLine label="Family history" value={draftForm.medical_history.family_history} />
          </>
        )}
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
        {editingEnabled ? (
          <>
            <EditableField label="Section title" value={draftForm.visit_context.section_title} onChangeText={(value) => updateSectionField('visit_context', 'section_title', value)} />
            <EditableField label="Section subtitle" value={draftForm.visit_context.section_subtitle} onChangeText={(value) => updateSectionField('visit_context', 'section_subtitle', value)} />
            <EditableField label="Visit category" value={draftForm.visit_context.visit_category} onChangeText={(value) => updateSectionField('visit_context', 'visit_category', value)} />
            <EditableField label="Chief concern" value={draftForm.visit_context.chief_concern} multiline onChangeText={(value) => updateSectionField('visit_context', 'chief_concern', value)} />
            <EditableField label="Clinician summary" value={draftForm.visit_context.summary_for_clinician} multiline onChangeText={(value) => updateSectionField('visit_context', 'summary_for_clinician', value)} />

            <View style={styles.dynamicHeaderRow}>
              <Text style={styles.dynamicHeaderText}>Visit detail fields</Text>
              <TouchableOpacity style={styles.addFieldButton} onPress={addRelevantField}>
                <Ionicons name="add" size={16} color="#A36A09" />
                <Text style={styles.addFieldText}>Add field</Text>
              </TouchableOpacity>
            </View>

            {draftForm.visit_context.relevant_fields.length === 0 ? (
              <Text style={styles.emptyDynamicText}>No dynamic visit fields yet. Add details like symptom duration, pain location, or triggers.</Text>
            ) : draftForm.visit_context.relevant_fields.map((field, index) => (
              <RelevantVisitFieldEditor
                key={`${field.key}_${index}`}
                field={field}
                index={index}
                onChange={updateRelevantField}
                onRemove={removeRelevantField}
              />
            ))}
          </>
        ) : (
          <>
            <DetailLine label="Visit category" value={formatVisitCategory(draftForm.visit_context.visit_category)} />
            <DetailLine label="Chief concern" value={draftForm.visit_context.chief_concern} />
            {draftForm.visit_context.summary_for_clinician ? <DetailLine label="Clinician summary" value={draftForm.visit_context.summary_for_clinician} /> : null}
            {draftForm.visit_context.relevant_fields.map((field) => (
              <DetailLine key={field.key} label={field.label} value={field.value} />
            ))}
          </>
        )}
      </SectionCard>

      <SectionCard
        icon="document-text-outline"
        title="Additional concerns"
        subtitle="Freeform notes from patient or assistant"
        detail={draftForm.additional_concerns.ai_drafted_notes ? 'Assistant and patient notes are available.' : 'Add any extra context that did not fit the main visit section.'}
        status={sectionStatus.additional_concerns}
        expanded={expandedSection === 'additional_concerns'}
        onPress={() => toggle('additional_concerns')}
      >
        {editingEnabled ? (
          <>
            <EditableField label="Patient notes" value={draftForm.additional_concerns.patient_notes} multiline onChangeText={(value) => updateSectionField('additional_concerns', 'patient_notes', value)} />
            <EditableField label="AI drafted notes" value={draftForm.additional_concerns.ai_drafted_notes} multiline onChangeText={(value) => updateSectionField('additional_concerns', 'ai_drafted_notes', value)} />
          </>
        ) : (
          <>
            <DetailLine label="Patient notes" value={draftForm.additional_concerns.patient_notes} />
            <DetailLine label="AI drafted notes" value={draftForm.additional_concerns.ai_drafted_notes} />
          </>
        )}
      </SectionCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F5F0' },
  content: { padding: 20, paddingBottom: 36 },
  heroCard: { backgroundColor: '#FFFFFF', borderRadius: 24, borderWidth: 1, borderColor: '#E5DED4', padding: 20, marginBottom: 18 },
  heroTitle: { fontSize: 26, fontWeight: '700', color: '#2C2C2A', marginBottom: 4 },
  heroSubtitle: { fontSize: 14, color: '#6F6A63', marginBottom: 14 },
  progressRow: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  progressBar: { flex: 1, height: 8, borderRadius: 999, backgroundColor: '#E9E2D8' },
  progressBarActive: { backgroundColor: '#E8820C' },
  progressText: { fontSize: 13, color: '#6F6A63', marginBottom: 12 },
  heroBody: { fontSize: 14, lineHeight: 21, color: '#5E5A54' },
  heroActionRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  heroAction: { flex: 1, backgroundColor: '#E8820C', borderRadius: 14, paddingVertical: 13, alignItems: 'center' },
  heroActionText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  secondaryAction: { backgroundColor: '#F6F1E8' },
  secondaryActionText: { color: '#6F6A63', fontWeight: '700', fontSize: 15 },
  saveSuccess: { marginTop: 10, color: '#2F8A57', fontWeight: '600' },
  sectionCard: { borderWidth: 1, borderRadius: 22, padding: 16, marginBottom: 14 },
  sectionTop: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  iconBox: { width: 48, height: 48, borderRadius: 14, backgroundColor: '#EFF5FB', alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#2C2C2A', flex: 1 },
  sectionSubtitle: { fontSize: 14, color: '#6F6A63', marginBottom: 4 },
  sectionDetail: { fontSize: 13, lineHeight: 19 },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  expandedArea: { marginTop: 14, borderTopWidth: 1, borderTopColor: '#EEE7DC', paddingTop: 14, gap: 10 },
  detailLine: { marginBottom: 10 },
  detailLabel: { fontSize: 12, color: '#8B8379', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  detailValue: { fontSize: 15, lineHeight: 21, color: '#2C2C2A' },
  editFieldWrap: { marginBottom: 12 },
  editInput: { borderWidth: 1, borderColor: '#E1D9CD', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#FFFDF9', color: '#2C2C2A', fontSize: 15 },
  editInputMultiline: { minHeight: 88 },
  dynamicHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, marginBottom: 4 },
  dynamicHeaderText: { fontSize: 15, fontWeight: '700', color: '#2C2C2A' },
  addFieldButton: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F6EAD6', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999 },
  addFieldText: { color: '#A36A09', fontWeight: '700', fontSize: 13 },
  emptyDynamicText: { fontSize: 13, color: '#7B756D', lineHeight: 19 },
  dynamicFieldCard: { borderWidth: 1, borderColor: '#E8E0D4', borderRadius: 16, padding: 12, backgroundColor: '#FFFEFC' },
  dynamicFieldHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  dynamicFieldTitle: { fontSize: 14, fontWeight: '700', color: '#2C2C2A' },
});
