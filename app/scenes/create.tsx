import { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../src/constants/theme';
import { useSensors } from '../../src/lib/sensorStore';
import { useScenes, SCENE_PRESETS, type SceneAction } from '../../src/lib/sceneStore';

const ICON_CHOICES = ['airplane', 'moon', 'home', 'construct', 'shield-checkmark', 'water', 'flash', 'leaf'];
const COLOR_CHOICES = ['#818CF8', '#60A5FA', '#34D399', '#2DD4BF', '#FBBF24', '#F87171'];

export default function CreateSceneScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; preset?: string }>();
  const { sensors } = useSensors();
  const { scenes, createScene, updateScene } = useScenes();

  const editing = params.id ? scenes?.find((s) => s._id === params.id) : undefined;
  const preset = params.preset ? SCENE_PRESETS.find((p) => p.name === params.preset) : undefined;

  const [name, setName] = useState(editing?.name ?? (preset && preset.name !== 'Custom' ? preset.name : ''));
  const [icon, setIcon] = useState(editing?.icon ?? preset?.icon ?? 'construct');
  const [color, setColor] = useState(editing?.color ?? preset?.color ?? colors.primary);
  const [saving, setSaving] = useState(false);

  // Only controllable devices (those with a shut-off valve) can be in a scene.
  const controllable = useMemo(() => sensors.filter((s) => s.controllable), [sensors]);

  // Map of sensorId -> target valveOpen. undefined = not included in scene.
  const [selection, setSelection] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    if (editing) {
      editing.actions.forEach((a) => { init[a.sensorId] = a.valveOpen; });
    }
    return init;
  });

  const toggleInclude = (sensorId: string) => {
    setSelection((prev) => {
      const next = { ...prev };
      if (sensorId in next) delete next[sensorId];
      else next[sensorId] = preset?.valveOpen ?? false;
      return next;
    });
  };

  const setTarget = (sensorId: string, valveOpen: boolean) => {
    setSelection((prev) => ({ ...prev, [sensorId]: valveOpen }));
  };

  const actions: SceneAction[] = Object.entries(selection).map(([sensorId, valveOpen]) => ({ sensorId, valveOpen }));
  const canSave = name.trim().length > 0 && actions.length > 0 && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      if (editing) {
        await updateScene({ id: editing._id, name: name.trim(), icon, color, actions });
      } else {
        await createScene({ name: name.trim(), icon, color, actions });
      }
      router.back();
    } catch {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.bg }} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-row items-center px-5 py-3" style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Pressable onPress={() => router.back()} hitSlop={10} className="active:opacity-60">
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800', marginLeft: 6 }}>
          {editing ? 'Edit Scene' : 'New Scene'}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: '700', marginBottom: 8 }}>SCENE NAME</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g. Vacation, Night Mode"
          placeholderTextColor={colors.textFaint}
          className="rounded-xl px-4 py-3.5"
          style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, color: colors.text, fontSize: 16 }}
        />

        <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: '700', marginTop: 20, marginBottom: 10 }}>ICON</Text>
        <View className="flex-row flex-wrap gap-2.5">
          {ICON_CHOICES.map((ic) => (
            <Pressable
              key={ic}
              onPress={() => setIcon(ic)}
              className="w-12 h-12 rounded-xl items-center justify-center active:opacity-80"
              style={{ backgroundColor: icon === ic ? color + '22' : colors.surface, borderWidth: 1, borderColor: icon === ic ? color : colors.border }}
            >
              <Ionicons name={ic as any} size={22} color={icon === ic ? color : colors.textMuted} />
            </Pressable>
          ))}
        </View>

        <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: '700', marginTop: 20, marginBottom: 10 }}>COLOR</Text>
        <View className="flex-row flex-wrap gap-3">
          {COLOR_CHOICES.map((c) => (
            <Pressable
              key={c}
              onPress={() => setColor(c)}
              className="w-10 h-10 rounded-full items-center justify-center active:opacity-80"
              style={{ backgroundColor: c, borderWidth: 3, borderColor: color === c ? colors.text : 'transparent' }}
            >
              {color === c && <Ionicons name="checkmark" size={18} color="#0B1120" />}
            </Pressable>
          ))}
        </View>

        <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: '700', marginTop: 24, marginBottom: 4 }}>
          DEVICES & TARGET STATE
        </Text>
        <Text style={{ color: colors.textFaint, fontSize: 12, marginBottom: 4, lineHeight: 17 }}>
          Select shut-off valves to control and set each one's ending state.
        </Text>
        <View className="flex-row items-start mb-3">
          <Ionicons name="information-circle-outline" size={13} color={colors.textFaint} style={{ marginTop: 1 }} />
          <Text style={{ color: colors.textFaint, fontSize: 11, marginLeft: 5, flex: 1, lineHeight: 15 }}>
            Scenes aren't wired to the physical valves yet — running one only updates settings in the app.
          </Text>
        </View>

        {controllable.length === 0 && (
          <View className="rounded-2xl p-5 items-center" style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
            <Ionicons name="water-outline" size={28} color={colors.textFaint} />
            <Text style={{ color: colors.textMuted, fontSize: 14, marginTop: 8, textAlign: 'center' }}>
              No devices with a shut-off valve are available.
            </Text>
          </View>
        )}

        {controllable.map((s) => {
          const included = s.id in selection;
          const target = selection[s.id];
          return (
            <View
              key={s.id}
              className="rounded-2xl p-4 mb-3"
              style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: included ? color + '66' : colors.border }}
            >
              <View className="flex-row items-center">
                <Pressable onPress={() => toggleInclude(s.id)} className="flex-row items-center flex-1 active:opacity-70">
                  <View
                    className="w-6 h-6 rounded-md items-center justify-center mr-3"
                    style={{ backgroundColor: included ? color : 'transparent', borderWidth: 2, borderColor: included ? color : colors.textFaint }}
                  >
                    {included && <Ionicons name="checkmark" size={16} color="#0B1120" />}
                  </View>
                  <View className="flex-1">
                    <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>{s.defaultName}</Text>
                    <Text style={{ color: colors.textFaint, fontSize: 12, marginTop: 1 }}>{s.location}</Text>
                  </View>
                </Pressable>
              </View>

              {included && (
                <View className="flex-row gap-2 mt-3">
                  <Pressable
                    onPress={() => setTarget(s.id, true)}
                    className="flex-1 py-2.5 rounded-xl items-center active:opacity-80"
                    style={{ backgroundColor: target ? 'rgba(52,211,153,0.15)' : colors.surfaceAlt, borderWidth: 1, borderColor: target ? colors.online : colors.border }}
                  >
                    <Text style={{ color: target ? colors.online : colors.textMuted, fontSize: 13, fontWeight: '700' }}>Valve Open</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setTarget(s.id, false)}
                    className="flex-1 py-2.5 rounded-xl items-center active:opacity-80"
                    style={{ backgroundColor: !target ? 'rgba(248,113,113,0.15)' : colors.surfaceAlt, borderWidth: 1, borderColor: !target ? colors.danger : colors.border }}
                  >
                    <Text style={{ color: !target ? colors.danger : colors.textMuted, fontSize: 13, fontWeight: '700' }}>Valve Shut</Text>
                  </Pressable>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      <View className="px-5 pb-5 pt-3" style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
        <Pressable
          onPress={handleSave}
          disabled={!canSave}
          className="py-4 rounded-2xl items-center active:opacity-90"
          style={{ backgroundColor: canSave ? colors.primary : colors.surfaceAlt }}
        >
          {saving ? (
            <ActivityIndicator color="#0B1120" />
          ) : (
            <Text style={{ color: canSave ? '#0B1120' : colors.textFaint, fontSize: 16, fontWeight: '800' }}>
              {editing ? 'Save Changes' : 'Create Scene'}{actions.length > 0 ? ` (${actions.length})` : ''}
            </Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
