import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        if (!email || !password) { 
            setError('Please fill in all fields.'); 
            return; 
        }

        setError('');
        setLoading(true);

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        setLoading(false);

        if (error) {
            setError(error.message);
            return;
        }
    };

    const handleSignUp = async () => {
        if (!email || !password) { 
            setError('Please fill in all fields.');
            return;
        }
        
        setError('');
        setLoading(true);

        const { error } = await supabase.auth.signUp({
            email,
            password,
        });

        setLoading(false);

        if (error) {
            setError(error.message);
            return;
        }

        setError('Account created. Check your email if confirmation is required, then sign in.');
    };

    return (
        <View style={styles.container}>
            <View style={styles.logo}>
                <View style={styles.logoCircle} />
            </View>
            <Text style={styles.title}>Medifera</Text>
            <Text style={styles.subtitle}> A personalized check-in experience</Text>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TextInput style={styles.input} placeholder="Email address" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholderTextColor="#B4B2A9" />
            <TextInput style={styles.input} placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry placeholderTextColor="#B4B2A9" />

            <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
                <Text style={styles.buttonText}>{loading ? 'Signing in...' : 'Sign in'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSignUp} disabled={loading}>
                <Text style={styles.link}>Create an account</Text>
            </TouchableOpacity>
        </View>
    );
}


const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 32,
        backgroundColor: '#FFFDF9',
    },
    logo: {
        width: 48,
        height: 48,
        borderRadius: 16,
        backgroundColor: '#FAEEDA',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 14,
    },
    logoCircle: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: '#E8820C',
    },
    title: {
        fontSize: 28,
        fontWeight: '500',
        color: '#2C2C2A',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 14,
        color: '#888780',
        marginBottom: 32,
    },
    input: {
        backgroundColor: '#fff',
        borderRadius: 10,
        padding: 14,
        fontSize: 14,
        marginBottom: 12,
        borderWidth: 0.5,
        borderColor: '#D3D1C7',
        color: '#2C2C2A',
    },
    button: {
        backgroundColor: '#E8820C',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 4,
        marginBottom: 12,
    },
    buttonText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '500',
    },
    link: {
        textAlign: 'center',
        color: '#E8820C',
        fontSize: 14,
    },
    error: {
        color: '#A32D2D',
        fontSize: 13,
        marginBottom: 12,
    },
});