import { Redirect } from 'expo-router';

// Dashboard lives on the index tab. Keep this route hidden / redirecting
// so navigation stays consistent if linked directly.
export default function DashboardAlias() {
  return <Redirect href="/(tabs)" />;
}
