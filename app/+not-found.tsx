import { Link, Stack } from 'expo-router';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
        <View className="flex-1 items-center justify-center p-5">
          <Text className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            This screen doesn't exist.
          </Text>

          <Link href="/" className="mt-4 py-4">
            <Text className="text-base text-blue-500 font-medium">
              Go to home screen!
            </Text>
          </Link>
        </View>
      </SafeAreaView>
    </>
  );
}
