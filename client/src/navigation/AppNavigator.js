import { Ionicons } from '@expo/vector-icons';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useAuth } from '../context/AuthContext';
import ChatScreen from '../screens/ChatScreen';
import GroupsScreen from '../screens/GroupsScreen';
import HomeFeedScreen from '../screens/HomeFeedScreen';
import LoginScreen from '../screens/LoginScreen';
import MediaStudioScreen from '../screens/MediaStudioScreen';
import MyPetsScreen from '../screens/MyPetsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import RegisterScreen from '../screens/RegisterScreen';
import StatisticsScreen from '../screens/StatisticsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const LoadingScreen = () => (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="large" color="#2f8f68" />
  </View>
);

const AuthStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false
    }}
  >
    <Stack.Screen name="Login" component={LoginScreen} />
    <Stack.Screen name="Register" component={RegisterScreen} />
  </Stack.Navigator>
);

const getTabIcon = (routeName, focused) => {
  const icons = {
    Feed: focused ? 'home' : 'home-outline',
    Pets: focused ? 'paw' : 'paw-outline',
    Groups: focused ? 'people' : 'people-outline',
    Chat: focused ? 'chatbubbles' : 'chatbubbles-outline',
    Profile: focused ? 'person-circle' : 'person-circle-outline'
  };

  return icons[routeName] || 'ellipse-outline';
};

const MainTabs = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      headerStyle: { backgroundColor: '#f7fbf6' },
      headerTintColor: '#173b2c',
      headerTitleStyle: { fontWeight: '700' },
      tabBarActiveTintColor: '#2f8f68',
      tabBarInactiveTintColor: '#6f8176',
      tabBarStyle: {
        backgroundColor: '#ffffff',
        borderTopColor: '#dcebe1',
        height: 78,
        paddingTop: 8,
        paddingBottom: 16
      },
      tabBarItemStyle: {
        paddingVertical: 4
      },
      tabBarLabelStyle: {
        fontSize: 12,
        fontWeight: '700'
      },
      tabBarIcon: ({ color, focused, size }) => (
        <Ionicons name={getTabIcon(route.name, focused)} size={size} color={color} />
      )
    })}
  >
    <Tab.Screen name="Feed" component={HomeFeedScreen} options={{ title: 'Home' }} />
    <Tab.Screen name="Pets" component={MyPetsScreen} options={{ title: 'My Pets' }} />
    <Tab.Screen name="Groups" component={GroupsScreen} />
    <Tab.Screen name="Chat" component={ChatScreen} />
    <Tab.Screen name="Profile" component={ProfileScreen} />
  </Tab.Navigator>
);

const ProtectedStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerStyle: { backgroundColor: '#f7fbf6' },
      headerTintColor: '#173b2c',
      headerTitleStyle: { fontWeight: '700' },
      contentStyle: { backgroundColor: '#f7fbf6' }
    }}
  >
    <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
    <Stack.Screen
      name="MediaStudio"
      component={MediaStudioScreen}
      options={{ title: 'Pet Post Creator' }}
    />
    <Stack.Screen
      name="Statistics"
      component={StatisticsScreen}
      options={{ title: 'My Activity' }}
    />
  </Stack.Navigator>
);

export default function AppNavigator() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer>
      {isAuthenticated ? <ProtectedStack /> : <AuthStack />}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f7fbf6'
  }
});
