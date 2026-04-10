import React, { createContext, useContext, useMemo, useState } from 'react';

export type PatientProfile = {
  firstName: string;
  middleInitial: string;
  lastName: string;
  dob: string;
  email: string;
  phone: string;
  address: string;
  insuranceProvider: string;
  insuranceMember: string;
  insuranceGroup: string;
  allergies: string;
  hospitalizations: string;
  familyHistory: string;
  currentMedications: string;
  primaryCare: string;
  upcomingProvider: string;
  upcomingTime: string;
  upcomingVisitType: string;
};

const DEFAULT_PROFILE: PatientProfile = {
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
  allergies: 'None reported',
  hospitalizations: 'None reported',
  familyHistory: 'Father: Diabetes; Grandmother: Breast Cancer',
  currentMedications: 'None reported',
  primaryCare: 'Dr. Sarah Chen',
  upcomingProvider: 'Dr. Sarah Chen',
  upcomingTime: 'Today · 2:30 PM',
  upcomingVisitType: 'General Checkup',
};

type PatientProfileContextValue = {
  profile: PatientProfile;
  updateProfile: (next: PatientProfile) => void;
};

const PatientProfileContext = createContext<PatientProfileContextValue | undefined>(undefined);

export function PatientProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<PatientProfile>(DEFAULT_PROFILE);

  const value = useMemo(
    () => ({ profile, updateProfile: setProfile }),
    [profile]
  );

  return <PatientProfileContext.Provider value={value}>{children}</PatientProfileContext.Provider>;
}

export function usePatientProfile() {
  const context = useContext(PatientProfileContext);
  if (!context) {
    throw new Error('usePatientProfile must be used inside PatientProfileProvider');
  }
  return context;
}
