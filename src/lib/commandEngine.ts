import { type Sensor, formatSensorValue, formatRelativeTime, sensorTypeMeta } from './mockData';

// ---------------------------------------------------------------------------
// Ambient Command — Terminal command engine.
// Parses free-text commands and resolves them against the live sensor set.
// Returns structured output lines so the console can render them with color.
// ---------------------------------------------------------------------------

export type LineKind = 'output' | 'success' | 'error' | 'muted' | 'accent' | 'input';

export interface OutputLine {
  text: string;
  kind: LineKind;
}

export interface CommandContext {
  sensors: Sensor[];
  toggleSensor: (id: string, value: boolean) => Promise<void> | void;
  renameSensor: (id: string, name: string) => Promise<void> | void;
}

export interface CommandResult {
  lines: OutputLine[];
  /** Navigation intent the console can act on (e.g. open a screen). */
  navigate?: string;
}

function line(text: string, kind: LineKind = 'output'): OutputLine {
  return { text, kind };
}

function statusGlyph(status: Sensor['status']): string {
  if (status === 'online') return '●';
  if (status === 'warning') return '▲';
  return '○';
}

function findSensor(sensors: Sensor[], token: string): Sensor | undefined {
  const t = token.trim().toLowerCase();
  return (
    sensors.find((s) => s.id.toLowerCase() === t) ||
    sensors.find((s) => s.defaultName.toLowerCase() === t) ||
    sensors.find((s) => s.defaultName.toLowerCase().includes(t)) ||
    sensors.find((s) => s.location.toLowerCase().includes(t))
  );
}

export const COMMANDS: { cmd: string; args?: string; desc: string }[] = [
  { cmd: 'help', desc: 'List all available commands' },
  { cmd: 'ls', args: '[online|offline|warning]', desc: 'List sensors, optionally filtered by status' },
  { cmd: 'status', desc: 'System-wide health summary' },
  { cmd: 'get', args: '<sensor>', desc: 'Show full detail for one sensor' },
  { cmd: 'on', args: '<sensor>', desc: 'Open the shut-off valve on a sensor' },
  { cmd: 'off', args: '<sensor>', desc: 'Close the shut-off valve on a sensor' },
  { cmd: 'rename', args: '<sensor> <name>', desc: 'Rename a sensor' },
  { cmd: 'alerts', desc: 'Show active alerts' },
  { cmd: 'battery', args: '[low]', desc: 'Show battery levels, optionally only low ones' },
  { cmd: 'find', args: '<query>', desc: 'Search sensors by name, type or location' },
  { cmd: 'scan', desc: 'Run a network scan of all sensors' },
  { cmd: 'clear', desc: 'Clear the console' },
];

export function runCommand(raw: string, ctx: CommandContext): CommandResult {
  const input = raw.trim();
  if (!input) return { lines: [] };

  const parts = input.split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const rest = parts.slice(1);
  const { sensors } = ctx;

  switch (cmd) {
    case 'help':
      return {
        lines: [
          line('AMBIENT COMMAND — available commands', 'accent'),
          ...COMMANDS.map((c) =>
            line(`  ${c.cmd}${c.args ? ' ' + c.args : ''}`.padEnd(26) + c.desc, 'muted'),
          ),
        ],
      };

    case 'clear':
      return { lines: [], navigate: '__clear__' };

    case 'status': {
      const online = sensors.filter((s) => s.status === 'online').length;
      const warning = sensors.filter((s) => s.status === 'warning').length;
      const offline = sensors.filter((s) => s.status === 'offline').length;
      const lowBatt = sensors.filter((s) => s.battery <= 20).length;
      return {
        lines: [
          line('SYSTEM STATUS', 'accent'),
          line(`  Sensors total   ${sensors.length}`),
          line(`  Online          ${online}`, 'success'),
          line(`  Warning         ${warning}`, warning ? 'error' : 'muted'),
          line(`  Offline         ${offline}`, offline ? 'error' : 'muted'),
          line(`  Low battery     ${lowBatt}`, lowBatt ? 'error' : 'muted'),
          line(`  Health          ${online === sensors.length ? 'NOMINAL' : 'ATTENTION REQUIRED'}`,
            online === sensors.length ? 'success' : 'error'),
        ],
      };
    }

    case 'ls': {
      const filter = rest[0]?.toLowerCase();
      let list = sensors;
      if (filter && ['online', 'offline', 'warning'].includes(filter)) {
        list = sensors.filter((s) => s.status === filter);
      }
      if (!list.length) return { lines: [line('No sensors match.', 'muted')] };
      return {
        lines: [
          line(`${list.length} sensor(s)`, 'muted'),
          ...list.map((s) =>
            line(
              `  ${statusGlyph(s.status)} ${s.id.padEnd(9)} ${s.defaultName.slice(0, 22).padEnd(23)} ${formatSensorValue(s)}`,
              s.status === 'offline' ? 'muted' : s.status === 'warning' ? 'error' : 'output',
            ),
          ),
        ],
      };
    }

    case 'get': {
      if (!rest.length) return { lines: [line('Usage: get <sensor>', 'error')] };
      const s = findSensor(sensors, rest.join(' '));
      if (!s) return { lines: [line(`No sensor matching "${rest.join(' ')}"`, 'error')] };
      return {
        lines: [
          line(`${s.defaultName} (${s.id})`, 'accent'),
          line(`  Type       ${sensorTypeMeta[s.type].label}`),
          line(`  Status     ${s.status.toUpperCase()}`,
            s.status === 'online' ? 'success' : s.status === 'warning' ? 'error' : 'muted'),
          line(`  Leak       ${formatSensorValue(s)}`, s.value > 0 ? 'error' : 'success'),
          line(`  Location   ${s.location}`),
          line(`  Battery    ${s.battery}%`, s.battery <= 20 ? 'error' : 'output'),
          line(`  Signal     ${s.signal}%`),
          line(`  Valve      ${s.controllable ? (s.isOn ? 'OPEN' : 'CLOSED') : 'n/a'}`),
          line(`  Updated    ${formatRelativeTime(s.lastUpdate)}`, 'muted'),
        ],
      };
    }

    case 'on':
    case 'off': {
      if (!rest.length) return { lines: [line(`Usage: ${cmd} <sensor>`, 'error')] };
      const s = findSensor(sensors, rest.join(' '));
      if (!s) return { lines: [line(`No sensor matching "${rest.join(' ')}"`, 'error')] };
      if (!s.controllable) {
        return { lines: [line(`${s.defaultName} has no shut-off valve.`, 'error')] };
      }
      const value = cmd === 'on';
      void ctx.toggleSensor(s.id, value);
      return {
        lines: [
          line(`✓ ${s.defaultName} valve ${value ? 'OPENED' : 'CLOSED'}`, 'success'),
        ],
      };
    }

    case 'rename': {
      if (rest.length < 2) return { lines: [line('Usage: rename <sensor> <new name>', 'error')] };
      const s = findSensor(sensors, rest[0]);
      if (!s) return { lines: [line(`No sensor matching "${rest[0]}"`, 'error')] };
      const newName = rest.slice(1).join(' ');
      void ctx.renameSensor(s.id, newName);
      return { lines: [line(`✓ ${s.id} renamed to "${newName}"`, 'success')] };
    }

    case 'alerts': {
      const issues = sensors.filter(
        (s) => s.status !== 'online' || s.battery <= 20,
      );
      if (!issues.length) {
        return { lines: [line('✓ No active alerts. All systems nominal.', 'success')] };
      }
      return {
        lines: [
          line(`${issues.length} active alert(s)`, 'error'),
          ...issues.map((s) => {
            const reason =
              s.status === 'offline'
                ? 'OFFLINE'
                : s.battery <= 20
                  ? `LOW BATTERY (${s.battery}%)`
                  : 'WARNING';
            return line(`  ▲ ${s.id.padEnd(9)} ${s.defaultName.slice(0, 20).padEnd(21)} ${reason}`, 'error');
          }),
        ],
      };
    }

    case 'scan': {
      const online = sensors.filter((s) => s.status === 'online').length;
      return {
        lines: [
          line('Scanning mesh network...', 'muted'),
          line(`  Discovered ${sensors.length} nodes`, 'output'),
          line(`  ${online} responding`, 'success'),
          line(`  ${sensors.length - online} unreachable`, sensors.length - online ? 'error' : 'muted'),
          line('Scan complete.', 'accent'),
        ],
      };
    }

    case 'battery': {
      const lowOnly = rest[0]?.toLowerCase() === 'low';
      let list = [...sensors].sort((a, b) => a.battery - b.battery);
      if (lowOnly) list = list.filter((s) => s.battery <= 20);
      if (!list.length) return { lines: [line('No sensors match.', 'muted')] };
      return {
        lines: [
          line('BATTERY LEVELS', 'accent'),
          ...list.map((s) => {
            const bar = '█'.repeat(Math.round(s.battery / 10)).padEnd(10, '░');
            return line(
              `  ${s.id.padEnd(9)} ${bar} ${String(s.battery).padStart(3)}%`,
              s.battery <= 20 ? 'error' : s.battery <= 40 ? 'output' : 'success',
            );
          }),
        ],
      };
    }

    case 'find': {
      if (!rest.length) return { lines: [line('Usage: find <query>', 'error')] };
      const q = rest.join(' ').toLowerCase();
      const matches = sensors.filter(
        (s) =>
          s.id.toLowerCase().includes(q) ||
          s.defaultName.toLowerCase().includes(q) ||
          s.location.toLowerCase().includes(q) ||
          sensorTypeMeta[s.type].label.toLowerCase().includes(q),
      );
      if (!matches.length) return { lines: [line(`No matches for "${q}"`, 'muted')] };
      return {
        lines: [
          line(`${matches.length} match(es) for "${q}"`, 'muted'),
          ...matches.map((s) =>
            line(
              `  ${statusGlyph(s.status)} ${s.id.padEnd(9)} ${s.defaultName.slice(0, 22).padEnd(23)} ${s.location}`,
              s.status === 'offline' ? 'muted' : 'output',
            ),
          ),
        ],
      };
    }

    default:
      return {
        lines: [
          line(`Unknown command: ${cmd}`, 'error'),
          line('Type "help" for a list of commands.', 'muted'),
        ],
      };
  }
}
