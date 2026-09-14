import { useCallback, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, Linking } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as DocumentPicker from "expo-document-picker";
import { api, Attachment, Comment, Task, TaskPriority } from "../api/client";
import { resolveFileUrl } from "../api/config";
import { colors } from "../theme";
import { RootStackParamList } from "../navigation";

type Props = NativeStackScreenProps<RootStackParamList, "Task">;

interface Member {
  userId: string;
  user: { id: string; name: string; email: string };
}

const PRIORITIES: TaskPriority[] = ["LOW", "MEDIUM", "HIGH"];
const PRIORITY_LABELS: Record<TaskPriority, string> = { LOW: "Низкий", MEDIUM: "Средний", HIGH: "Высокий" };

export default function TaskScreen({ route, navigation }: Props) {
  const { taskId, projectId } = route.params;
  const [task, setTask] = useState<Task | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [description, setDescription] = useState("");
  const [newComment, setNewComment] = useState("");
  const [uploading, setUploading] = useState(false);

  async function load() {
    const [t, c, a, m] = await Promise.all([
      api.get<Task>(`/tasks/${taskId}`),
      api.get<Comment[]>(`/tasks/${taskId}/comments`),
      api.get<Attachment[]>(`/tasks/${taskId}/attachments`),
      projectId ? api.get<Member[]>(`/projects/${projectId}/members`) : Promise.resolve([] as Member[]),
    ]);
    setTask(t);
    setDescription(t.description ?? "");
    setComments(c);
    setAttachments(a);
    setMembers(m);
  }

  useFocusEffect(
    useCallback(() => {
      load();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [taskId])
  );

  async function setPriority(priority: TaskPriority) {
    await api.patch(`/tasks/${taskId}`, { priority });
    load();
  }

  async function setAssignee(assigneeId: string | null) {
    await api.patch(`/tasks/${taskId}`, { assigneeId });
    load();
  }

  async function saveDescription() {
    await api.patch(`/tasks/${taskId}`, { description });
  }

  async function submitComment() {
    if (!newComment.trim()) return;
    await api.post(`/tasks/${taskId}/comments`, { body: newComment.trim() });
    setNewComment("");
    load();
  }

  async function pickAndUploadFile() {
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setUploading(true);
    try {
      await api.upload(`/tasks/${taskId}/attachments`, {
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType,
      });
      load();
    } catch (err) {
      Alert.alert("Не удалось загрузить файл");
    } finally {
      setUploading(false);
    }
  }

  async function removeAttachment(id: string) {
    await api.del(`/attachments/${id}`);
    load();
  }

  async function remove() {
    Alert.alert("Удалить задачу?", undefined, [
      { text: "Отмена", style: "cancel" },
      {
        text: "Удалить",
        style: "destructive",
        onPress: async () => {
          await api.del(`/tasks/${taskId}`);
          navigation.goBack();
        },
      },
    ]);
  }

  if (!task) return null;

  const delegatedFromMember = task.delegatedById ? members.find((m) => m.userId === task.delegatedById) : undefined;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ gap: 14, padding: 16 }}>
      <Text style={styles.title}>{task.title}</Text>

      {task.delegatedById && (
        <View style={styles.delegationBanner}>
          <Text style={styles.delegationText}>
            ↪ Делегировано{delegatedFromMember ? ` от ${delegatedFromMember.user.name}` : ""}
          </Text>
        </View>
      )}

      <Text style={styles.label}>Описание</Text>
      <TextInput
        style={styles.textArea}
        multiline
        value={description}
        onChangeText={setDescription}
        onBlur={saveDescription}
        placeholder="Описание задачи…"
        placeholderTextColor={colors.muted}
      />

      <Text style={styles.label}>Приоритет</Text>
      <View style={styles.chipRow}>
        {PRIORITIES.map((p) => (
          <TouchableOpacity
            key={p}
            style={[styles.chip, task.priority === p && styles.chipActive]}
            onPress={() => setPriority(p)}
          >
            <Text style={styles.chipText}>{PRIORITY_LABELS[p]}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Исполнитель {task.assigneeId ? "(смена = делегирование)" : ""}</Text>
      <View style={styles.chipRow}>
        <TouchableOpacity
          style={[styles.chip, !task.assigneeId && styles.chipActive]}
          onPress={() => setAssignee(null)}
        >
          <Text style={styles.chipText}>Не назначен</Text>
        </TouchableOpacity>
        {members.map((m) => (
          <TouchableOpacity
            key={m.userId}
            style={[styles.chip, task.assigneeId === m.userId && styles.chipActive]}
            onPress={() => setAssignee(m.userId)}
          >
            <Text style={styles.chipText}>{m.user.name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Вложения</Text>
      {attachments.map((a) => (
        <View key={a.id} style={styles.attachmentRow}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => Linking.openURL(resolveFileUrl(a.url))}>
            <Text style={styles.attachmentName}>📎 {a.originalName}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => removeAttachment(a.id)}>
            <Text style={styles.removeLink}>Удалить</Text>
          </TouchableOpacity>
        </View>
      ))}
      <TouchableOpacity style={styles.attachButton} onPress={pickAndUploadFile} disabled={uploading}>
        <Text style={styles.attachButtonText}>{uploading ? "Загрузка…" : "+ Прикрепить файл"}</Text>
      </TouchableOpacity>

      <Text style={styles.label}>Комментарии</Text>
      {comments.map((c) => (
        <View key={c.id} style={styles.comment}>
          <Text style={styles.commentAuthor}>
            {c.author.name} <Text style={styles.muted}>{new Date(c.createdAt).toLocaleString("ru-RU")}</Text>
          </Text>
          <Text style={styles.commentBody}>{c.body}</Text>
        </View>
      ))}
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          placeholder="Написать комментарий…"
          placeholderTextColor={colors.muted}
          value={newComment}
          onChangeText={setNewComment}
        />
        <TouchableOpacity style={styles.button} onPress={submitComment}>
          <Text style={styles.buttonText}>Отправить</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.deleteButton} onPress={remove}>
        <Text style={styles.buttonText}>Удалить задачу</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  title: { color: colors.text, fontSize: 20, fontWeight: "700" },
  label: { color: colors.muted, fontSize: 13 },
  delegationBanner: { backgroundColor: "rgba(14, 165, 233, 0.15)", borderRadius: 6, padding: 8 },
  delegationText: { color: "#7dd3fc", fontSize: 13 },
  textArea: {
    backgroundColor: colors.panel2,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    color: colors.text,
    minHeight: 70,
    textAlignVertical: "top",
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { backgroundColor: colors.panel2, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.text, fontSize: 13 },
  comment: { backgroundColor: colors.panel2, borderRadius: 8, padding: 10 },
  commentAuthor: { color: colors.text, fontWeight: "600" },
  commentBody: { color: colors.text, marginTop: 4 },
  muted: { color: colors.muted, fontSize: 12 },
  row: { flexDirection: "row", gap: 8 },
  input: {
    flex: 1,
    backgroundColor: colors.panel2,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    color: colors.text,
  },
  button: { backgroundColor: colors.accent, borderRadius: 8, paddingHorizontal: 14, justifyContent: "center" },
  buttonText: { color: "white", fontWeight: "600" },
  deleteButton: { backgroundColor: colors.danger, borderRadius: 8, padding: 12, alignItems: "center", marginTop: 8 },
  attachmentRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.panel2,
    borderRadius: 8,
    padding: 8,
  },
  attachmentName: { color: colors.text, fontSize: 13 },
  removeLink: { color: colors.danger, fontSize: 12 },
  attachButton: { backgroundColor: colors.panel2, borderRadius: 8, padding: 10, alignItems: "center", borderWidth: 1, borderColor: colors.border },
  attachButtonText: { color: colors.accent, fontSize: 13 },
});
