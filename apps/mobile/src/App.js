import React from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
// Só os pesos usados (importar o pacote inteiro embutiria todas as variações).
import { PlusJakartaSans_400Regular } from '@expo-google-fonts/plus-jakarta-sans/400Regular';
import { PlusJakartaSans_500Medium } from '@expo-google-fonts/plus-jakarta-sans/500Medium';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import { PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans/800ExtraBold';
import { Icon, colors, fonts, shadow } from './components/ui';
import { AppProvider } from './lib/state';
import { SplashScreen, OnboardingScreen, LoginScreen, CodeScreen, InviteScreen, InterestsScreen } from './screens/auth';
import { HomeScreen } from './screens/home';
import { ItineraryScreen, FlightScreen, StayScreen, ActivityScreen } from './screens/itinerary';
import { ExploreScreen, PlaceScreen, FavoritesScreen, DestinationScreen } from './screens/explore';
import { ChecklistScreen, TaskScreen, DocsScreen, DocViewerScreen } from './screens/trip';
import { ProfileScreen, PreferencesScreen, NotificationSettingsScreen, PrivacyScreen, HelpScreen, NotificationsScreen, TripSwitcherScreen } from './screens/account';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const TABS = [
  { name: 'Inicio', label: 'Início', icon: 'house', component: HomeScreen },
  { name: 'Roteiro', label: 'Roteiro', icon: 'map-trifold', component: ItineraryScreen },
  { name: 'Explorar', label: 'Explorar', icon: 'compass', component: ExploreScreen },
  { name: 'Checklist', label: 'Preparação', icon: 'list-checks', component: ChecklistScreen },
  { name: 'Docs', label: 'Docs', icon: 'files', component: DocsScreen },
];

/** Barra de abas flutuante + botão persistente "Falar com a Vagari" (PRD §4.7). */
function TabBar({ state, navigation }) {
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
      <Pressable
        onPress={() => navigation.navigate('Help')}
        accessibilityRole="button"
        accessibilityLabel="Falar com a Vagari no WhatsApp"
        style={({ pressed }) => [
          { position: 'absolute', right: 18, bottom: insets.bottom + 92, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.whatsapp, alignItems: 'center', justifyContent: 'center', ...shadow.float },
          pressed && { transform: [{ scale: 0.95 }] },
        ]}
      >
        <Icon name="chat-teardrop-dots" size={28} color="#06341C" weight="fill" />
      </Pressable>
      <View style={{ marginHorizontal: 14, marginBottom: Math.max(insets.bottom, 12), backgroundColor: colors.surface, borderRadius: 28, flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 6, ...shadow.float }}>
        {state.routes.map((route, i) => {
          const tab = TABS.find((t) => t.name === route.name);
          const focused = state.index === i;
          return (
            <Pressable
              key={route.key}
              onPress={() => !focused && navigation.navigate(route.name)}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={tab.label}
              style={{ flex: 1, alignItems: 'center', paddingVertical: 6, gap: 3 }}
            >
              <View style={{ width: 48, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: focused ? colors.purple50 : 'transparent' }}>
                <Icon name={tab.icon} size={24} color={focused ? colors.purple600 : colors.muted} weight={focused ? 'duotone' : 'regular'} accent={colors.orange500} />
              </View>
              <Text style={{ fontFamily: focused ? fonts.bodyBold : fonts.bodyMedium, fontSize: 11, color: focused ? colors.purple700 : colors.muted }}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function Tabs() {
  return (
    <Tab.Navigator tabBar={(p) => <TabBar {...p} />} screenOptions={{ headerShown: false }}>
      {TABS.map((t) => (
        <Tab.Screen key={t.name} name={t.name} component={t.component} />
      ))}
    </Tab.Navigator>
  );
}

const theme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: colors.bg, primary: colors.purple600 } };

export default function App() {
  const [loaded, fontError] = useFonts({
    // Neulis: fonte oficial dos títulos (brand/fonts)
    Neulis_SemiBold: require('../assets/fonts/Neulis-SemiBold.otf'),
    Neulis_Bold: require('../assets/fonts/Neulis-Bold.otf'),
    NeulisAlt_SemiBold: require('../assets/fonts/NeulisAlt-SemiBold.otf'),
    NeulisAlt_Bold: require('../assets/fonts/NeulisAlt-Bold.otf'),
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  // Se as fontes demorarem (rede ruim), segue com as do sistema em vez de travar na abertura.
  const [timedOut, setTimedOut] = React.useState(false);
  React.useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 3000);
    return () => clearTimeout(t);
  }, []);
  if (!loaded && !fontError && !timedOut) return <View style={{ flex: 1, backgroundColor: colors.purple600 }} />;
  return (
    <SafeAreaProvider>
      <AppProvider>
        <NavigationContainer theme={theme} documentTitle={{ enabled: Platform.OS !== 'web' }}>
          <StatusBar style="dark" />
          <Stack.Navigator initialRouteName="Splash" screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: colors.bg } }}>
            <Stack.Screen name="Splash" component={SplashScreen} options={{ animation: 'fade' }} />
            <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ animation: 'fade' }} />
            <Stack.Screen name="Login" component={LoginScreen} options={{ animation: 'fade' }} />
            <Stack.Screen name="Code" component={CodeScreen} />
            <Stack.Screen name="Invite" component={InviteScreen} options={{ animation: 'fade' }} />
            <Stack.Screen name="Interests" component={InterestsScreen} options={{ animation: 'fade' }} />
            <Stack.Screen name="Main" component={Tabs} options={{ animation: 'fade' }} />
            <Stack.Screen name="Flight" component={FlightScreen} />
            <Stack.Screen name="Stay" component={StayScreen} />
            <Stack.Screen name="Activity" component={ActivityScreen} />
            <Stack.Screen name="Place" component={PlaceScreen} />
            <Stack.Screen name="Favorites" component={FavoritesScreen} />
            <Stack.Screen name="Destination" component={DestinationScreen} />
            <Stack.Screen name="Task" component={TaskScreen} />
            <Stack.Screen name="DocViewer" component={DocViewerScreen} options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
            <Stack.Screen name="Preferences" component={PreferencesScreen} />
            <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
            <Stack.Screen name="Privacy" component={PrivacyScreen} />
            <Stack.Screen name="Help" component={HelpScreen} options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} />
            <Stack.Screen name="TripSwitcher" component={TripSwitcherScreen} options={{ presentation: 'transparentModal', animation: 'fade' }} />
          </Stack.Navigator>
        </NavigationContainer>
      </AppProvider>
    </SafeAreaProvider>
  );
}
