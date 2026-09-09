import { useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, Animated, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/theme';
import { useScenes, SCENE_PRESETS, type Scene } from '../lib/sceneStore';
import { hapticSuccess } from '../lib/haptics';

function SceneTile({
  scene,
  onTrigger,
  onRequest,
}: {
  scene: Scene;
  onTrigger: (s: Scene) => Promise<void>;
  onRequest: (s: Scene) => Promise<boolean>;
}) {
  const [running, setRunning] = useState(false);
  const [justRan, setJustRan] = useState(false);
  const router = useRouter();
  const scale = useRef(new Animated.Value(1)).current;
  const accent = scene.color ?? colors.primary;

  const handlePress = async () => {
    // Confirm first — a scene can shut off water on several valves at once.
    const ok = await onRequest(scene);
    if (!ok) return;
    setRunning(true);
    try {
      await onTrigger(scene); // fires the success toast via ToastHost
      void hapticSuccess(); // native only — no-op on web
      setJustRan(true);
      Animated.sequence([
        Animated.spring(scale, { toValue: 1.06, useNativeDriver: true, speed: 40, bounciness: 8 }),
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 6 }),
      ]).start();
      setTimeout(() => setJustRan(false), 1400);
    } catch {
      // error toast already shown by the scene store
    } finally {
      setRunning(false);
    }
  };

  return (
    <Animated.View style={{ transform: [{ scale }], marginRight: 12 }}>
      <Pressable
        onPress={handlePress}
        onLongPress={() => router.push({ pathname: '/scenes/create', params: { id: scene._id } })}
        disabled={running}
        className="rounded-2xl p-4 active:opacity-80"
        style={{
          width: 132,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: justRan ? accent : accent + '44',
        }}
        accessibilityRole="button"
        accessibilityLabel={`Trigger scene ${scene.name}`}
      >
        <View
          className="w-10 h-10 rounded-xl items-center justify-center mb-3"
          style={{ backgroundColor: justRan ? 'rgba(126,226,190,0.18)' : accent + '22' }}
        >
          {running ? (
            <ActivityIndicator size="small" color={accent} />
          ) : justRan ? (
            <Ionicons name="checkmark" size={20} color={colors.online} />
          ) : (
            <Ionicons name={(scene.icon ?? 'flash') as any} size={20} color={accent} />
          )}
        </View>
        <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }} numberOfLines={1}>
          {scene.name}
        </Text>
        <Text style={{ color: justRan ? colors.online : colors.textFaint, fontSize: 11, marginTop: 2 }}>
          {justRan
            ? 'Activated'
            : `${scene.actions.length} device${scene.actions.length === 1 ? '' : 's'}`}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

export function SceneShortcuts() {
  const router = useRouter();
  const { scenes, triggerScene } = useScenes();

  // Promise-based confirm so each tile keeps its own run animation but the
  // actual firing waits on an explicit modal (real valves, real water).
  const [confirmScene, setConfirmScene] = useState<Scene | null>(null);
  const resolverRef = useRef<((ok: boolean) => void) | null>(null);

  const requestConfirm = (scene: Scene): Promise<boolean> => {
    setConfirmScene(scene);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  };

  const resolveConfirm = (ok: boolean) => {
    resolverRef.current?.(ok);
    resolverRef.current = null;
    setConfirmScene(null);
  };

  const opens = confirmScene?.actions.filter((a) => a.valveOpen).length ?? 0;
  const closes = (confirmScene?.actions.length ?? 0) - opens;

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
            <SceneTile key={s._id} scene={s} onTrigger={triggerScene} onRequest={requestConfirm} />
          ))}
        </ScrollView>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {SCENE_PRESETS.filter((p) => p.name !== 'Custom').map((p) => (
            <Pressable
              key={p.name}
              onPress={() => router.push({ pathname: '/scenes/create', params: { preset: p.name } })}
              className="rounded-2xl p-4 active:opacity-80"
              style={{
                width: 150,
                marginRight: 12,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                borderStyle: 'dashed',
              }}
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

      {/* Confirm — scenes now send real valve commands to hardware */}
      <Modal
        visible={!!confirmScene}
        transparent
        animationType="fade"
        onRequestClose={() => resolveConfirm(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 }}>
          <View
            style={{ backgroundColor: colors.surfaceAlt, borderRadius: 20, padding: 22, borderWidth: 1, borderColor: colors.border }}
          >
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>
              Run “{confirmScene?.name}”?
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 14, marginTop: 8, lineHeight: 20 }}>
              This sends real valve commands to hardware. They queue and apply as each module next
              checks in.
            </Text>
            <View
              className="rounded-xl mt-4 px-3 py-2.5"
              style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
            >
              <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700' }}>
                {confirmScene?.actions.length} valve{confirmScene?.actions.length === 1 ? '' : 's'}
              </Text>
              <Text style={{ color: colors.textFaint, fontSize: 12, marginTop: 2 }}>
                {opens} to open · {closes} to close
              </Text>
            </View>
            <View className="flex-row" style={{ gap: 12, marginTop: 20 }}>
              <Pressable
                onPress={() => resolveConfirm(false)}
                className="flex-1 items-center justify-center active:opacity-80"
                style={{ minHeight: 50, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
              >
                <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => resolveConfirm(true)}
                className="flex-1 items-center justify-center active:opacity-90"
                style={{ minHeight: 50, borderRadius: 14, backgroundColor: closes > 0 ? colors.danger : colors.online }}
              >
                <Text style={{ color: '#04201c', fontSize: 15, fontWeight: '800' }}>Run scene</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
