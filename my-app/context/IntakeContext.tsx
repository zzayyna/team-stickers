import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { usePatientProfile, type PatientProfile } from './PatientProfileContext';

export type SectionStatus = 'not_started' | 'in_progress' | 'review_needed' | 'missing_info' | 'complete';

export type RelevantVisitField = {
  key: string;
  label: string;
  value: string;
  source: 'patient' | 'ai_summary';
};

export type VisitContext = {
  section_title: string;
  section_subtitle: string;
  visit_category: string;
  chief_concern: string;
  summary_for_clinician: string;
  relevant_fields: RelevantVisitField[];
  source_note?: string;
};

export type IntakeData = {
  patient_information: {
    full_name: string;
    date_of_birth: string;
    phone_number: string;
    email: string;
    address: string;
    source_note?: string;
  };
  insurance_information: {
    provider_name: string;
    member_id: string;
    group_number: string;
    source_note?: string;
  };
  medical_history: {
    allergies: string;
    current_medications: string;
    past_surgeries_or_hospitalizations: string;
    family_history: string;
    source_note?: string;
  };
  visit_context: VisitContext;
  additional_concerns: {
    patient_notes: string;
    ai_drafted_notes: string;
  };
};

type SectionMap = {
  patient_information: IntakeData['patient_information'];
  insurance_information: IntakeData['insurance_information'];
  medical_history: IntakeData['medical_history'];
  visit_context: IntakeData['visit_context'];
  additional_concerns: IntakeData['additional_concerns'];
};

type IntakeContextValue = {
  draftForm: IntakeData;
  sectionStatus: Record<'patient_information' | 'insurance' | 'medical_history' | 'visit_details' | 'additional_concerns', SectionStatus>;
  currentRequestedField: string;
  helperInfo: { plainLanguageDefinition: string; whyWeAreAsking: string };
  updateFromProfile: () => void;

  resetAppointment: () => void; // ✅ ADD THIS

  applyAgentDraft: (patch: {
    patient_information?: Partial<IntakeData['patient_information']>;
    insurance_information?: Partial<IntakeData['insurance_information']>;
    medical_history?: Partial<IntakeData['medical_history']>;
    visit_context?: Partial<VisitContext>;
    additional_concerns?: Partial<IntakeData['additional_concerns']>;
  }) => void;

  updateSectionField: <S extends keyof SectionMap, F extends keyof SectionMap[S]>(
    section: S,
    field: F,
    value: string
  ) => void;
  addRelevantField: () => void;
  removeRelevantField: (index: number) => void;
  updateRelevantField: (index: number, patch: Partial<RelevantVisitField>) => void;
  setCurrentRequestedField: (field: string) => void;
  setHelperInfo: (plainLanguageDefinition: string, whyWeAreAsking: string) => void;
};

const IntakeContext = createContext<IntakeContextValue | undefined>(undefined);

function emptyVisitContext(): VisitContext {
  return {
    section_title: '',
    section_subtitle: '',
    visit_category: '',
    chief_concern: '',
    summary_for_clinician: '',
    relevant_fields: [],
    source_note: '',
  };
}

function emptyDraft(): IntakeData {
  return {
    patient_information: { full_name: '', date_of_birth: '', phone_number: '', email: '', address: '' },
    insurance_information: { provider_name: '', member_id: '', group_number: '' },
    medical_history: { allergies: '', current_medications: '', past_surgeries_or_hospitalizations: '', family_history: '' },
    visit_context: emptyVisitContext(),
    additional_concerns: { patient_notes: '', ai_drafted_notes: '' },
  };
}

function buildProfileSections(profile: PatientProfile) {
  return {
    patient_information: {
      full_name: [profile.firstName, profile.middleInitial, profile.lastName].filter(Boolean).join(' '),
      date_of_birth: profile.dob,
      phone_number: profile.phone,
      email: profile.email,
      address: profile.address,
      source_note: 'Autofilled from your saved profile.',
    },
    insurance_information: {
      provider_name: profile.insuranceProvider,
      member_id: profile.insuranceMember,
      group_number: profile.insuranceGroup,
      source_note: 'Autofilled from your previous saved insurance details.',
    },
    medical_history: {
      allergies: profile.allergies,
      current_medications: profile.currentMedications,
      past_surgeries_or_hospitalizations: profile.hospitalizations,
      family_history: profile.familyHistory,
      source_note: 'Autofilled from your previous medical history on file.',
    },
  };
}

function normalizeField(field: Partial<RelevantVisitField>, index: number): RelevantVisitField {
  return {
    key: String(field.key || `field_${index + 1}`),
    label: String(field.label || `Detail ${index + 1}`),
    value: String(field.value || ''),
    source: field.source === 'patient' ? 'patient' : 'ai_summary',
  };
}

function normalizeVisitContext(input?: Partial<VisitContext>): VisitContext {
  const base = emptyVisitContext();
  if (!input) return base;

  return {
    section_title: String(input.section_title || base.section_title),
    section_subtitle: String(input.section_subtitle || base.section_subtitle),
    visit_category: String(input.visit_category || base.visit_category),
    chief_concern: String(input.chief_concern || base.chief_concern),
    summary_for_clinician: String(input.summary_for_clinician || base.summary_for_clinician),
    relevant_fields: Array.isArray(input.relevant_fields)
      ? input.relevant_fields.map((field, index) => normalizeField(field, index)).filter((field) => field.label || field.value)
      : base.relevant_fields,
    source_note: String(input.source_note || base.source_note),
  };
}

export function IntakeProvider({ children }: { children: React.ReactNode }) {
  const { profile } = usePatientProfile();
  const [draftForm, setDraftForm] = useState<IntakeData>(emptyDraft());
  const [currentRequestedField, setCurrentRequestedField] = useState('Main reason for visit');
  const [helperInfo, setHelperInfoState] = useState({
    plainLanguageDefinition: 'Reason for visit means the main issue or concern that brought you in today.',
    whyWeAreAsking: 'This helps the care team and intake assistant focus on the most relevant questions first.',
  });

  const syncProfileIntoDraft = useCallback(() => {
    const nextProfileSections = buildProfileSections(profile);
    setDraftForm((prev) => {
      const samePatient = JSON.stringify(prev.patient_information) === JSON.stringify(nextProfileSections.patient_information);
      const sameInsurance = JSON.stringify(prev.insurance_information) === JSON.stringify(nextProfileSections.insurance_information);
      const sameHistory = JSON.stringify(prev.medical_history) === JSON.stringify(nextProfileSections.medical_history);

      if (samePatient && sameInsurance && sameHistory) {
        return prev;
      }

      return {
        ...prev,
        ...nextProfileSections,
      };
    });
  }, [profile]);

  useEffect(() => {
    syncProfileIntoDraft();
  }, [syncProfileIntoDraft]);

  const updateFromProfile = useCallback(() => {
    syncProfileIntoDraft();
  }, [syncProfileIntoDraft]);

  const resetAppointment = useCallback(() => {
    setDraftForm((prev) => ({
      ...prev,
      visit_context: emptyVisitContext(),
      additional_concerns: { patient_notes: '', ai_drafted_notes: '' },
    }));
    setCurrentRequestedField('Main reason for visit');
    setHelperInfoState({
      plainLanguageDefinition:
        'Reason for visit means the main issue or concern that brought you in today.',
      whyWeAreAsking:
        'This helps the care team and intake assistant focus on the most relevant questions first.',
    });
  }, []);

  const applyAgentDraft = useCallback((patch: { patient_information?: Partial<IntakeData['patient_information']>; insurance_information?: Partial<IntakeData['insurance_information']>; medical_history?: Partial<IntakeData['medical_history']>; visit_context?: Partial<VisitContext>; additional_concerns?: Partial<IntakeData['additional_concerns']> }) => {
    setDraftForm((prev) => {
      const nextPatientInformation = patch.patient_information
        ? { ...prev.patient_information, ...patch.patient_information }
        : prev.patient_information;

      const nextInsuranceInformation = patch.insurance_information
        ? { ...prev.insurance_information, ...patch.insurance_information }
        : prev.insurance_information;

      const nextMedicalHistory = patch.medical_history
        ? { ...prev.medical_history, ...patch.medical_history }
        : prev.medical_history;

      const nextVisitContext = patch.visit_context
        ? normalizeVisitContext({
          ...prev.visit_context,
          ...patch.visit_context,
          relevant_fields: patch.visit_context.relevant_fields ?? prev.visit_context.relevant_fields,
        })
        : prev.visit_context;

      const nextAdditionalConcerns = patch.additional_concerns
        ? {
          patient_notes: String(patch.additional_concerns.patient_notes ?? prev.additional_concerns.patient_notes),
          ai_drafted_notes: String(patch.additional_concerns.ai_drafted_notes ?? prev.additional_concerns.ai_drafted_notes),
        }
        : prev.additional_concerns;

      return {
        ...prev,
        patient_information: nextPatientInformation,
        insurance_information: nextInsuranceInformation,
        medical_history: nextMedicalHistory,
        visit_context: nextVisitContext,
        additional_concerns: nextAdditionalConcerns,
      };
    });
  }, []);

  const updateSectionField = useCallback(<S extends keyof SectionMap, F extends keyof SectionMap[S]>(section: S, field: F, value: string) => {
    setDraftForm((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value,
      },
    }));
  }, []);

  const addRelevantField = useCallback(() => {
    setDraftForm((prev) => ({
      ...prev,
      visit_context: {
        ...prev.visit_context,
        relevant_fields: [
          ...prev.visit_context.relevant_fields,
          {
            key: `field_${prev.visit_context.relevant_fields.length + 1}`,
            label: '',
            value: '',
            source: 'patient',
          },
        ],
      },
    }));
  }, []);

  const removeRelevantField = useCallback((index: number) => {
    setDraftForm((prev) => ({
      ...prev,
      visit_context: {
        ...prev.visit_context,
        relevant_fields: prev.visit_context.relevant_fields.filter((_, currentIndex) => currentIndex !== index),
      },
    }));
  }, []);

  const updateRelevantField = useCallback((index: number, patch: Partial<RelevantVisitField>) => {
    setDraftForm((prev) => ({
      ...prev,
      visit_context: {
        ...prev.visit_context,
        relevant_fields: prev.visit_context.relevant_fields.map((field, currentIndex) => {
          if (currentIndex !== index) return field;
          return normalizeField({ ...field, ...patch }, index);
        }),
      },
    }));
  }, []);

  const setHelperInfo = useCallback((plainLanguageDefinition: string, whyWeAreAsking: string) => {
    setHelperInfoState({ plainLanguageDefinition, whyWeAreAsking });
  }, []);

  const sectionStatus: IntakeContextValue['sectionStatus'] = useMemo(() => ({
    patient_information: draftForm.patient_information.full_name ? 'review_needed' : 'not_started',
    insurance: draftForm.insurance_information.provider_name ? 'review_needed' : 'not_started',
    medical_history:
      draftForm.medical_history.allergies || draftForm.medical_history.current_medications || draftForm.medical_history.past_surgeries_or_hospitalizations || draftForm.medical_history.family_history
        ? 'review_needed'
        : 'not_started',
    visit_details: !draftForm.visit_context.chief_concern
      ? 'not_started'
      : draftForm.visit_context.relevant_fields.length >= 2 && draftForm.visit_context.summary_for_clinician
        ? 'complete'
        : 'in_progress',
    additional_concerns: draftForm.additional_concerns.patient_notes || draftForm.additional_concerns.ai_drafted_notes ? 'complete' : 'not_started',
  }), [draftForm]);

  const value = useMemo(
    () => ({
      draftForm,
      sectionStatus,
      currentRequestedField,
      helperInfo,
      updateFromProfile,
      applyAgentDraft,
      updateSectionField,
      addRelevantField,
      removeRelevantField,
      updateRelevantField,
      setCurrentRequestedField,
      setHelperInfo,
      resetAppointment,
    }),
    [
      draftForm,
      sectionStatus,
      currentRequestedField,
      helperInfo,
      updateFromProfile,
      applyAgentDraft,
      updateSectionField,
      addRelevantField,
      removeRelevantField,
      updateRelevantField,
      setCurrentRequestedField,
      setHelperInfo,
      resetAppointment,
    ]
  );

  return <IntakeContext.Provider value={value}>{children}</IntakeContext.Provider>;
}

export function useIntake() {
  const context = useContext(IntakeContext);
  if (!context) throw new Error('useIntake must be used inside IntakeProvider');
  return context;
}


