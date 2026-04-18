import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

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

const EMPTY_PROFILE: PatientProfile = {
  firstName: '',
  middleInitial: '',
  lastName: '',
  dob: '',
  email: '',
  phone: '',
  address: '',
  insuranceProvider: '',
  insuranceMember: '',
  insuranceGroup: '',
  allergies: '',
  hospitalizations: '',
  familyHistory: '',
  currentMedications: '',
  primaryCare: '',
  upcomingProvider: '',
  upcomingTime: '',
  upcomingVisitType: '',
};

type PatientProfileContextValue = {
  profile: PatientProfile;
  profileReady: boolean;
  updateProfile: (next: PatientProfile) => void;
  refreshProfile: () => Promise<void>;
};

const PatientProfileContext = createContext<PatientProfileContextValue | undefined>(undefined);

function mapProfileRowToProfile(data: any): PatientProfile {
  return {
    firstName: data?.first_name ?? '',
    middleInitial: data?.middle_initial ?? '',
    lastName: data?.last_name ?? '',
    dob: data?.dob ?? '',
    email: data?.email ?? '',
    phone: data?.phone ?? '',
    address: data?.address ?? '',
    insuranceProvider: data?.insurance_provider ?? '',
    insuranceMember: data?.insurance_member ?? '',
    insuranceGroup: data?.insurance_group ?? '',
    allergies: data?.allergies ?? '',
    hospitalizations: data?.hospitalizations ?? '',
    familyHistory: data?.family_history ?? '',
    currentMedications: data?.current_medications ?? '',
    primaryCare: data?.primary_care ?? '',
    upcomingProvider: data?.upcoming_provider ?? '',
    upcomingTime: data?.upcoming_time ?? '',
    upcomingVisitType: data?.upcoming_visit_type ?? '',
  };
}

export function PatientProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<PatientProfile>(EMPTY_PROFILE);
  const [profileReady, setProfileReady] = useState(false);

  const refreshProfile = useCallback(async () => {
    try {
      setProfileReady(false);

      const { data: authData, error: userError } = await supabase.auth.getUser();
      if (userError) {
        console.error('Error getting user:', userError);
        setProfile(EMPTY_PROFILE);
        return;
      }

      const user = authData.user;
      if (!user) {
        setProfile(EMPTY_PROFILE);
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error loading profile:', error);
        setProfile(EMPTY_PROFILE);
        return;
      }

      if (!data) {
        setProfile(EMPTY_PROFILE);
        return;
      }

      setProfile(mapProfileRowToProfile(data));
    } catch (error) {
      console.error('Unexpected profile load error:', error);
      setProfile(EMPTY_PROFILE);
    } finally {
      setProfileReady(true);
    }
  }, []);

  useEffect(() => {
    refreshProfile();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        refreshProfile();
      } else {
        setProfile(EMPTY_PROFILE);
        setProfileReady(true);
      }
    });

    return () => subscription.unsubscribe();
  }, [refreshProfile]);

  const updateProfile = useCallback((next: PatientProfile) => {
    setProfile(next);
    setProfileReady(true);
  }, []);

  const value = useMemo(
    () => ({ profile, profileReady, updateProfile, refreshProfile }),
    [profile, profileReady, updateProfile, refreshProfile]
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
