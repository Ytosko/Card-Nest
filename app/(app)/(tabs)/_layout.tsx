import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useAppTheme } from '@/src/theme/theme-provider';

function TabIcon({ name, color, focused, prominent = false }: {
  name: keyof typeof MaterialCommunityIcons.glyphMap;
  color: string;
  focused: boolean;
  prominent?: boolean;
}) {
  const theme = useAppTheme();
  if (prominent) {
    return (
      <View style={[styles.scanIcon, { backgroundColor: focused ? theme.colors.primaryPressed : theme.colors.primary }]}>
        <MaterialCommunityIcons color={theme.colors.textOnBrand} name={name} size={27} />
      </View>
    );
  }
  return <MaterialCommunityIcons color={color} name={name} size={24} />;
}

export default function TabLayout() {
  const theme = useAppTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarLabelStyle: { fontFamily: theme.typography.family.bodyStrong, fontSize: 11 },
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          height: 68,
          paddingBottom: 8,
          paddingTop: 7,
        },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color, focused }) => <TabIcon color={color} focused={focused} name={focused ? 'home-variant' : 'home-variant-outline'} /> }} />
      <Tabs.Screen name="search" options={{ title: 'Search', tabBarIcon: ({ color, focused }) => <TabIcon color={color} focused={focused} name="magnify" /> }} />
      <Tabs.Screen name="scan" options={{ title: 'Scan', tabBarIcon: ({ color, focused }) => <TabIcon color={color} focused={focused} name="line-scan" prominent /> }} />
      <Tabs.Screen name="cards" options={{ title: 'Cards', tabBarIcon: ({ color, focused }) => <TabIcon color={color} focused={focused} name={focused ? 'card-account-details' : 'card-account-details-outline'} /> }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: ({ color, focused }) => <TabIcon color={color} focused={focused} name={focused ? 'cog' : 'cog-outline'} /> }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  scanIcon: { alignItems: 'center', borderRadius: 18, height: 42, justifyContent: 'center', marginTop: -13, width: 52 },
});
