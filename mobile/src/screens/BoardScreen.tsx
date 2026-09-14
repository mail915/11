import { useCallback, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { api, Task, TaskStatus } from "../api/client";
import { colors } from "../theme";
import { RootStackParamList } from "../navigation";

type Props = NativeStackScreenProps<RootStackParamList, "Board">;

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: "TODO", label: "К выполнению" },
  { status: "IN_PROGRESS", label: "В работе" },
  { status: "DONE", label: "Готово" },
];

export default function BoardScreen({ route, navigation }: Props) {
  const { projectId } = route.params;
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTitle, setNewTitle] = useState("");

  async function load() {
    const taskList = await api.get<Task[]>(`/projects/${projectId}/tasks`);
    setTasks(taskList);
  }

  useFocusEffect(
    useCallback(() => {
      load();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectId])
  );

  async function createTask() {
    if (!newTitle.trim()) return;
    await api.post(`/projects/${projectId}/tasks`, { title: newTitle.trim() });
    setNewTitle("");
    load();
  }

  async function moveTask(taskId: string, status: TaskStatus) {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status } : t)));
    await api.patch(`/tasks/${taskId}`, { status });
  }

  return (
    <View style={styles.screen}>
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          placeholder="Новая задача…"
          placeholderTextColor={colors.muted}
          value={newTitle}
          onChangeText={setNewTitle}
        />
        <TouchableOpacity style={styles.button} onPress={createTask}>
          <Text style={styles.buttonText}>+</Text>
        </TouchableOpacity>
      </View>

      <ScrollView>
        {COLUMNS.map((col) => (
          <View key={col.status} style={styles.column}>
            <Text style={styles.columnTitle}>{col.label}</Text>
            {tasks
              .filter((t) => t.status === col.status)
              .map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.taskCard, { borderLeftColor: priorityColor(t.priority) }]}
                  onPress={() => navigation.navigate("Task", { taskId: t.id, projectId })}
                >
                  <Text style={styles.taskTitle}>{t.title}</Text>
                  {t.assignee && <Text style={styles.muted}>👤 {t.assignee.name}</Text>}
                  {t.delegatedById && <Text style={styles.muted}>↪ делегировано</Text>}
                  <View style={styles.switchRow}>
                    {COLUMNS.filter((c) => c.status !== t.status).map((c) => (
                      <TouchableOpacity key={c.status} style={styles.switchButton} onPress={() => moveTask(t.id, c.status)}>
                        <Text style={styles.switchButtonText}>→ {c.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </TouchableOpacity>
              ))}
            {tasks.filter((t) => t.status === col.status).length === 0 && (
              <Text style={styles.muted}>Нет задач</Text>
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function priorityColor(priority: Task["priority"]) {
  if (priority === "HIGH") return colors.high;
  if (priority === "MEDIUM") return colors.medium;
  return colors.low;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: 16 },
  row: { flexDirection: "row", gap: 8, marginBottom: 12 },
  input: {
    flex: 1,
    backgroundColor: colors.panel2,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    color: colors.text,
  },
  button: { backgroundColor: colors.accent, borderRadius: 8, paddingHorizontal: 16, justifyContent: "center" },
  buttonText: { color: "white", fontWeight: "700" },
  column: { backgroundColor: colors.panel, borderRadius: 10, padding: 12, marginBottom: 12 },
  columnTitle: { color: colors.text, fontWeight: "600", marginBottom: 8 },
  taskCard: {
    backgroundColor: colors.panel2,
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderLeftWidth: 4,
  },
  taskTitle: { color: colors.text, fontWeight: "600" },
  muted: { color: colors.muted, fontSize: 12, marginTop: 2 },
  switchRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  switchButton: { backgroundColor: colors.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  switchButtonText: { color: colors.text, fontSize: 11 },
});
