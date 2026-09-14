import { useCallback, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api, Notification } from "../api/client";
import { colors } from "../theme";

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  async function load() {
    const data = await api.get<Notification[]>("/notifications");
    setNotifications(data);
  }

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  async function markRead(id: string) {
    await api.patch(`/notifications/${id}/read`);
    load();
  }

  async function markAllRead() {
    await api.patch("/notifications/read-all");
    load();
  }

  return (
    <View style={styles.screen}>
      <TouchableOpacity onPress={markAllRead}>
        <Text style={styles.markAll}>Прочитать все</Text>
      </TouchableOpacity>
      <FlatList
        data={notifications}
        keyExtractor={(n) => n.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.item, !item.read && styles.itemUnread]}
            onPress={() => !item.read && markRead(item.id)}
          >
            <Text style={styles.message}>{item.message}</Text>
            <Text style={styles.date}>{new Date(item.createdAt).toLocaleString("ru-RU")}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.muted}>Нет уведомлений</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: 16 },
  markAll: { color: colors.accent, textAlign: "right", marginBottom: 8 },
  item: { backgroundColor: colors.panel, borderRadius: 8, padding: 12, marginBottom: 8 },
  itemUnread: { backgroundColor: colors.panel2 },
  message: { color: colors.text },
  date: { color: colors.muted, fontSize: 12, marginTop: 4 },
  muted: { color: colors.muted, textAlign: "center", marginTop: 20 },
});
