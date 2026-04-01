import { ScrollView, View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, Modal } from 'react-native';
import { useState } from 'react';

const FAMILY_HISTORY_OPTIONS = [
    'Diabetes', 'Breast Cancer', 'Heart Disease',
    'High Blood Pressure', 'Alzheimer\'s', 'Asthma', 'Stroke'
];

export default function HomeScreen() {
    const [firstName, setFirstName] = useState('John');
    const [middleInitial, setMiddleInitial] = useState('A');
    const [lastName, setLastName] = useState('Mango');
    const [dob, setDob] = useState('07/22/1967');
    const [allergies, setAllergies] = useState('N/A');
    const [hospitalizations, setHospitalizations] = useState('N/A');
    const [familyHistory, setFamilyHistory] = useState(['Father: Diabetes', 'Grandmother: Breast Cancer']);
    const [dropdownVisible, setDropdownVisible] = useState(false);
    const [selectedPerson, setSelectedPerson] = useState('');
    const [selectedCondition, setSelectedCondition] = useState('');
    const [conditionPickerVisible, setConditionPickerVisible] = useState(false);

    const addFamilyHistory = () => {
        if (selectedPerson && selectedCondition) {
            setFamilyHistory([...familyHistory, `${selectedPerson}: ${selectedCondition}`]);
            setSelectedPerson('');
            setSelectedCondition('');
            setDropdownVisible(false);
        }
    };

    return (
        <SafeAreaView style={styles.safe}>
            <ScrollView style={styles.container}>

                {/* Patient Information Card */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Patient Information</Text>

                    <View style={styles.row}>
                        <View style={[styles.inputGroup, { flex: 2 }]}>
                            <Text style={styles.label}>First Name</Text>
                            <TextInput style={styles.input} value={firstName} onChangeText={setFirstName} />
                        </View>
                        <View style={[styles.inputGroup, { flex: 1, marginHorizontal: 8 }]}>
                            <Text style={styles.label}>Middle Initial</Text>
                            <TextInput style={styles.input} value={middleInitial} onChangeText={setMiddleInitial} maxLength={1} />
                        </View>
                        <View style={[styles.inputGroup, { flex: 2 }]}>
                            <Text style={styles.label}>Last Name</Text>
                            <TextInput style={styles.input} value={lastName} onChangeText={setLastName} />
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Date of Birth</Text>
                        <TextInput style={styles.input} value={dob} onChangeText={setDob} placeholder="MM/DD/YYYY" keyboardType="numeric" />
                    </View>

                    <Text style={styles.italicLabel}>Insurance Information Attached</Text>
                    <TouchableOpacity style={styles.button}>
                        <Text style={styles.buttonText}>Update Insurance Information</Text>
                    </TouchableOpacity>
                </View>

                {/* Medical History Card */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Medical History</Text>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Known Allergies</Text>
                        <TextInput style={styles.input} value={allergies} onChangeText={setAllergies} />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Recent Hospitalizations</Text>
                        <TextInput style={styles.input} value={hospitalizations} onChangeText={setHospitalizations} />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Family History</Text>
                        {familyHistory.map((item, index) => (
                            <Text key={index} style={styles.familyItem}>{item}</Text>
                        ))}
                    </View>

                    {/* Add More Dropdown */}
                    <TouchableOpacity style={styles.dropdown} onPress={() => setDropdownVisible(true)}>
                        <Text style={styles.dropdownText}>Add More ▾</Text>
                    </TouchableOpacity>
                </View>

            </ScrollView>

            {/* Add Family History Modal */}
            <Modal visible={dropdownVisible} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>Add Family History</Text>

                        <Text style={styles.label}>Family Member</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. Father, Mother, Grandmother"
                            value={selectedPerson}
                            onChangeText={setSelectedPerson}
                        />

                        <Text style={[styles.label, { marginTop: 12 }]}>Condition</Text>
                        <TouchableOpacity style={styles.dropdown} onPress={() => setConditionPickerVisible(!conditionPickerVisible)}>
                            <Text style={styles.dropdownText}>{selectedCondition || 'Select a condition ▾'}</Text>
                        </TouchableOpacity>

                        {conditionPickerVisible && (
                            <View style={styles.optionsList}>
                                {FAMILY_HISTORY_OPTIONS.map((option) => (
                                    <TouchableOpacity
                                        key={option}
                                        style={styles.optionItem}
                                        onPress={() => { setSelectedCondition(option); setConditionPickerVisible(false); }}
                                    >
                                        <Text style={styles.optionText}>{option}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}

                        <View style={styles.modalButtons}>
                            <TouchableOpacity style={styles.cancelButton} onPress={() => setDropdownVisible(false)}>
                                <Text style={styles.cancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.button} onPress={addFamilyHistory}>
                                <Text style={styles.buttonText}>Add</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: {
        flex: 1,
        backgroundColor: '#f5f0eb',
    },
    container: {
        flex: 1,
        padding: 16,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 16,
    },
    row: {
        flexDirection: 'row',
        marginBottom: 8,
    },
    inputGroup: {
        marginBottom: 12,
    },
    label: {
        fontSize: 12,
        color: '#555',
        marginBottom: 4,
    },
    input: {
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 6,
        padding: 8,
        fontSize: 14,
        color: '#000',
        backgroundColor: '#fff',
    },
    italicLabel: {
        fontStyle: 'italic',
        fontSize: 13,
        color: '#444',
        marginBottom: 8,
    },
    button: {
        backgroundColor: '#2d4f5c',
        borderRadius: 6,
        paddingVertical: 10,
        paddingHorizontal: 16,
        alignSelf: 'flex-start',
    },
    buttonText: {
        color: '#fff',
        fontSize: 14,
    },
    familyItem: {
        color: '#7a9a8a',
        fontStyle: 'italic',
        fontSize: 13,
        marginBottom: 2,
    },
    dropdown: {
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 6,
        padding: 10,
        marginTop: 4,
    },
    dropdownText: {
        color: '#888',
        fontSize: 14,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'flex-end',
    },
    modalCard: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        padding: 24,
    },
    modalTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 16,
    },
    optionsList: {
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 6,
        marginTop: 4,
    },
    optionItem: {
        padding: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    optionText: {
        fontSize: 14,
        color: '#333',
    },
    modalButtons: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
        marginTop: 20,
    },
    cancelButton: {
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 6,
        paddingVertical: 10,
        paddingHorizontal: 16,
    },
    cancelText: {
        color: '#555',
        fontSize: 14,
    },
});