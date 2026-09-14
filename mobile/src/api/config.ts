import { Platform } from "react-native";

// Android emulator maps host machine to 10.0.2.2; iOS simulator and web can use localhost.
// Override by setting EXPO_PUBLIC_API_URL, e.g. http://192.168.1.50:4000/api for a physical device.
const DEFAULT_HOST = Platform.OS === "android" ? "10.0.2.2" : "localhost";

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || `http://${DEFAULT_HOST}:4000/api`;
