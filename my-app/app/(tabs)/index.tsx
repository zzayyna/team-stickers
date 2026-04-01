import { View, Text, Button } from 'react-native';
import { router } from 'expo-router';

export default function Index() {
  return (
    <View>
      <Text>Welcome</Text>
      <Button title="Get Started" onPress={() => router.push('/chat')} />
    </View>
  );
}