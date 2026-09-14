import { useCallback, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Alert } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { api, Project, Team } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { colors } from "../theme";
import { RootStackParamList } from "../navigation";

type Props = NativeStackScreenProps<RootStackParamList, "Projects">;

export default function ProjectsScreen({ navigation }: Props) {
  const { logout } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [newTeamName, setNewTeamName] = useState("");
  const [newProjectName, setNewProjectName] = useState("");

  async function load() {
    const [teamsData, projectsData] = await Promise.all([
      api.get<Team[]>("/teams"),
      api.get<Project[]>("/projects"),
    ]);
    setTeams(teamsData);
    setProjects(projectsData);
  }

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  async function createTeam() {
    if (!newTeamName.trim()) return;
    await api.post("/teams", { name: newTeamName.trim() });
    setNewTeamName("");
    load();
  }

  async function createProject() {
    if (!newProjectName.trim()) return;
    if (teams.length === 0) {
      Alert.alert("Сначала создайте команду");
      return;
    }
    await api.post("/projects", { name: newProjectName.trim(), teamId: teams[0].id });
    setNewProjectName("");
    load();
  }

  return (
    <View style={styles.screen}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.navigate("Notifications")}>
          <Text style={styles.headerLink}>🔔 Уведомления</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={logout}>
          <Text style={styles.headerLink}>Выйти</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Команды</Text>
      <FlatList
        data={teams}
        keyExtractor={(t) => t.id}
        horizontal
        renderItem={({ item }) => (
          <View style={styles.teamChip}>
            <Text style={styles.teamChipText}>{item.name}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.muted}>Команд пока нет</Text>}
      />
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          placeholder="Название команды"
          placeholderTextColor={colors.muted}
          value={newTeamName}
          onChangeText={setNewTeamName}
        />
        <TouchableOpacity style={styles.button} onPress={createTeam}>
          <Text style={styles.buttonText}>+</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Проекты</Text>
      <FlatList
        data={projects}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.projectCard}
            onPress={() => navigation.navigate("Board", { projectId: item.id, projectName: item.name })}
          >
            <Text style={styles.projectName}>{item.name}</Text>
            {item.description && <Text style={styles.muted}>{item.description}</Text>}
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.muted}>Проектов пока нет</Text>}
      />
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          placeholder="Название проекта"
          placeholderTextColor={colors.muted}
          value={newProjectName}
          onChangeText={setNewProjectName}
        />
        <TouchableOpacity style={styles.button} onPress={createProject}>
          <Text style={styles.buttonText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: 16, gap: 10 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  headerLink: { color: colors.accent },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: "600", marginTop: 8 },
  muted: { color: colors.muted },
  row: { flexDirection: "row", gap: 8, marginTop: 6 },
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
  teamChip: { backgroundColor: colors.panel2, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8 },
  teamChipText: { color: colors.text, fontSize: 13 },
  projectCard: { backgroundColor: colors.panel, borderRadius: 10, padding: 14, marginBottom: 8, borderColor: colors.border, borderWidth: 1 },
  projectName: { color: colors.text, fontWeight: "600", fontSize: 15 },
});
