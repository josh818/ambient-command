import { useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/theme';
import { useScenes, SCENE_PRESETS, type Scene } from '../lib/sceneStore';

function SceneTile({ scene, onTrigger }: { scene: Scene; onTrigger: (s: Scene) => Promise<void> }) {
  const [running, setRunning] = useState(false);
  const router = useRouter();
  const accent = scene.color ?? colors.primary;

  const handlePress = async () => {
    setRunning(true);
    try {
      await onTrigger(scene);
    } finally {
      setRunning(false);
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={() => router.push({ pathname: '/scenes/create', params: { id: scene._id } })}
      disabled={running}
      className="rounded-2xl p-4 mr-3 active:opacity-80"
      style={{ width: 132, backgroundColor: colors.surface, borderWidth: 1, borderColor: accent + '44' }}
    >
      <View className="w-10 h-10 rounded-xl items-center justify-center mb-3" style={{ backgroundColor: accent + '22' }}>
        {running ? (
          <ActivityIndicator size="small" color={accent} />
        ) : (
          <Ionicons name={(scene.icon ?? 'flash') as any} size={20} color={accent} />
        )}
      </View>
      <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }} numberOfLines={1}>
        {scene.name}
      </Text>
      <Text style={{ color: colors.textFaint, fontSize: 11, marginTop: 2 }}>
        {scene.actions.length} device{scene.actions.length === 1 ? '' : 's'}
      </Text>
    </Pressable>
  );
}

export function SceneShortcuts() {
  const router = useRouter();
  const { scenes, triggerScene } = useScenes();

  return (
    <View>
      <View className="flex-row items-center mb-3">
        <Ionicons name="flash" size={16} color={colors.primary} />
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', marginLeft: 8 }}>Scenes</Text>
        <Pressable
          className="ml-auto flex-row items-center active:opacity-70"
          onPress={() => router.push('/scenes/create')}
        >
          <Ionicons name="add-circle" size={18} color={colors.primary} />
          <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '700', marginLeft: 3 }}>New</Text>
        </Pressable>
      </View>

      {scenes && scenes.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {scenes.map((s) => (
            <SceneTile key={s._id} scene={s} onTrigger={triggerScene} />
          ))}
        </ScrollView>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {SCENE_PRESETS.filter((p) => p.name !== 'Custom').map((p) => (
            <Pressable
              key={p.name}
              onPress={() => router.push({ pathname: '/scenes/create', params: { preset: p.name } })}
              className="rounded-2xl p-4 mr-3 active:opacity-80"
              style={{ width: 150, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed' }}
            >
              <View className="w-10 h-10 rounded-xl items-center justify-center mb-3" style={{ backgroundColor: p.color + '22' }}>
                <Ionicons name={p.icon as any} size={20} color={p.color} />
              </View>
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>{p.name}</Text>
              <Text style={{ color: colors.textFaint, fontSize: 11, marginTop: 2, lineHeight: 15 }} numberOfLines={2}>
                {p.description}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
