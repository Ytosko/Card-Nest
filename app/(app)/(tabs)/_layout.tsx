import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useAppTheme } from '@/src/theme/theme-provider';

function TabIcon({
  name,
  color,
  focused,
  prominent = false,
}: {
  name: keyof typeof MaterialCommunityIcons.glyphMap;
  color: string;
  focused: boolean;
  prominent?: boolean;
}) {
  const theme = useAppTheme();
  if (prominent) {
    return (
      <View
        style={[
          styles.scanIcon,
          {
            backgroundColor: theme.colors.primary,
            shadowColor: theme.colors.primary,
          },
        ]}>
        <MaterialCommunityIcons color={theme.colors.textOnBrand} name={name} size={28} />
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
        tabBarLabelStyle: {
          fontFamily: theme.typography.family.bodyStrong,
          fontSize: 12,
          marginTop: -2,
        },
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          height: 68,
          paddingBottom: 8,
          paddingTop: 8,
        },
      }}>
      {/* Tab 1: Contacts (Primary Default Workspace) */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Contacts',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon color={color} focused={focused} name={focused ? 'card-account-details' : 'card-account-details-outline'} />
          ),
        }}
      />

      {/* Tab 2: Scan (Prominent Center Action) */}
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scan',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon color={color} focused={focused} name="line-scan" prominent />
          ),
        }}
      />

      {/* Tab 3: Settings */}
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon color={color} focused={focused} name={focused ? 'cog' : 'cog-outline'} />
          ),
        }}
      />

      {/* Legacy hidden screens for deep linking compatibility */}
      <Tabs.Screen name="cards" options={{ href: null }} />
      <Tabs.Screen name="search" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  scanIcon: {
    alignItems: 'center',
    borderRadius: 22,
    elevation: 4,
    height: 44,
    justifyContent: 'center',
    marginTop: -16,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    width: 56,
  },
});
