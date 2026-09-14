import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../context/AuthContext";
import LoginScreen from "../screens/LoginScreen";
import RegisterScreen from "../screens/RegisterScreen";
import ProjectsScreen from "../screens/ProjectsScreen";
import BoardScreen from "../screens/BoardScreen";
import TaskScreen from "../screens/TaskScreen";
import NotificationsScreen from "../screens/NotificationsScreen";

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Projects: undefined;
  Board: { projectId: string; projectName: string };
  Task: { taskId: string; teamId: string };
  Notifications: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0f172a" }}>
        <ActivityIndicator color="#6366f1" size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: "#1e293b" }, headerTintColor: "#e2e8f0" }}>
        {user ? (
          <>
            <Stack.Screen name="Projects" component={ProjectsScreen} options={{ title: "TaskFlow" }} />
            <Stack.Screen name="Board" component={BoardScreen} options={({ route }) => ({ title: route.params.projectName })} />
            <Stack.Screen name="Task" component={TaskScreen} options={{ title: "Задача" }} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: "Уведомления" }} />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Register" component={RegisterScreen} options={{ headerShown: false }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
