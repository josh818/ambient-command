import { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useSession } from '../../lib/auth-client';
import { colors, fonts } from '../../src/constants/theme';
import { useSensors } from '../../src/lib/sensorStore';
import {
  runCommand,
  type OutputLine,
  type LineKind,
  COMMANDS,
} from '../../src/lib/commandEngine';

const MONO = fonts.mono;

const lineColor: Record<LineKind, string> = {
  output: colors.text,
  success: colors.online,
  error: colors.danger,
  muted: colors.textFaint,
  accent: colors.primary,
  input: colors.accent,
};

const QUICK = ['status', 'ls', 'scan', 'alerts', 'help'];

const BANNER: OutputLine[] = [
  { text: 'AMBIENT COMMAND v1.0', kind: 'accent' },
  { text: 'Sensor mesh control terminal. Type "help" to begin.', kind: 'muted' },
];

export default function ConsoleScreen() {
  const { sensors, toggleSensor, renameSensor } = useSensors();
  const { data: session } = useSession();
  const logCommand = useMutation(api.mutations.logCommand);
  const [history, setHistory] = useState<OutputLine[]>(BANNER);
  const [input, setInput] = useState('');
  const [recent, setRecent] = useState<string[]>([]);
  const scrollRef = useRef<ScrollView>(null);

  const submit = useCallback(
    (raw: string) => {
      const cmd = raw.trim();
      if (!cmd) return;
      const result = runCommand(cmd, { sensors, toggleSensor, renameSensor });

      if (result.navigate === '__clear__') {
        setHistory([]);
        setInput('');
        return;
      }

      setHistory((prev) => [
        ...prev,
        { text: `> ${cmd}`, kind: 'input' },
        ...result.lines,
      ]);
      const failed = result.lines.some((l) => l.kind === 'error');
      if (session) void logCommand({ command: cmd, success: !failed }).catch(() => {});
      setRecent((prev) => [cmd, ...prev.filter((c) => c !== cmd)].slice(0, 10));
      setInput('');
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    },
    [sensors, toggleSensor, renameSensor],
  );

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.bg }} edges={[]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Header */}
        <View className="px-5 pt-2 pb-3 flex-row items-center justify-between">
          <View className="flex-row items-center">
            <View
              className="w-9 h-9 rounded-lg items-center justify-center"
              style={{ backgroundColor: 'rgba(126,226,190,0.15)' }}
            >
              <Ionicons name="terminal" size={20} color={colors.primary} />
            </View>
            <View style={{ marginLeft: 10 }}>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>Console</Text>
              <Text style={{ color: colors.textFaint, fontSize: 12 }}>
                {sensors.length} nodes connected
              </Text>
            </View>
          </View>
          <Pressable
            onPress={() => setHistory([])}
            className="w-9 h-9 rounded-lg items-center justify-center active:opacity-70"
            style={{ backgroundColor: colors.surface }}
          >
            <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
          </Pressable>
        </View>

        {/* Terminal output */}
        <View
          className="flex-1 mx-4 rounded-2xl overflow-hidden"
          style={{ backgroundColor: '#060B16', borderWidth: 1, borderColor: colors.border }}
        >
          <View
            className="flex-row items-center px-3 py-2"
            style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}
          >
            <View className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colors.danger }} />
            <View className="w-2.5 h-2.5 rounded-full ml-1.5" style={{ backgroundColor: colors.warning }} />
            <View className="w-2.5 h-2.5 rounded-full ml-1.5" style={{ backgroundColor: colors.online }} />
            <Text style={{ color: colors.textFaint, fontSize: 11, marginLeft: 10, fontFamily: MONO }}>
              ambient@mesh:~
            </Text>
          </View>
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={{ padding: 12 }}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          >
            {history.length === 0 ? (
              <Text style={{ color: colors.textFaint, fontSize: 12, fontFamily: MONO }}>
                Console cleared. Type a command below.
              </Text>
            ) : (
              history.map((l, i) => (
                <Text
                  key={i}
                  style={{
                    color: lineColor[l.kind],
                    fontSize: 12.5,
                    fontFamily: MONO,
                    lineHeight: 19,
                    fontWeight: l.kind === 'accent' || l.kind === 'input' ? '700' : '400',
                  }}
                >
                  {l.text}
                </Text>
              ))
            )}
          </ScrollView>
        </View>

        {/* Quick command chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10 }}
        >
          {(recent.length ? recent : QUICK).map((c) => (
            <Pressable
              key={c}
              onPress={() => submit(c)}
              className="px-3 py-1.5 rounded-full mr-2 active:opacity-70"
              style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
            >
              <Text style={{ color: colors.primary, fontSize: 12, fontFamily: MONO }}>{c}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Input prompt */}
        <View
          className="flex-row items-center mx-4 mb-3 px-3 rounded-xl"
          style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primary + '55' }}
        >
          <Text style={{ color: colors.primary, fontSize: 15, fontFamily: MONO, fontWeight: '700' }}>
            {'>'}
          </Text>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="type a command…"
            placeholderTextColor={colors.textFaint}
            autoCapitalize="none"
            autoCorrect={false}
            className="flex-1 py-3 px-2"
            style={{ color: colors.text, fontSize: 14, fontFamily: MONO }}
            onSubmitEditing={() => submit(input)}
            returnKeyType="send"
            blurOnSubmit={false}
          />
          <Pressable
            onPress={() => submit(input)}
            className="w-9 h-9 rounded-lg items-center justify-center active:opacity-70"
            style={{ backgroundColor: colors.primary }}
          >
            <Ionicons name="arrow-up" size={18} color={colors.bg} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
