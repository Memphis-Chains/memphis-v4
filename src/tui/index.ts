import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import type { OrchestrationService } from '../modules/orchestration/service.js';
import type { ProviderName } from '../core/types.js';
import { runChatOnce } from './screens/chat-screen.js';
import { renderHealthScreen } from './screens/health-screen.js';
import { embedSearchScreen, embedStoreScreen } from './screens/embed-screen.js';
import { runEmbedReset, runVaultAdd, runVaultGet, runVaultInit, runVaultList } from './adapters/command-parity.js';

export type TuiOptions = {
  orchestration: OrchestrationService;
  provider?: 'auto' | ProviderName;
  model?: string;
  strategy?: 'default' | 'latency-aware';
};

type TuiState = {
  provider: 'auto' | ProviderName;
  strategy: 'default' | 'latency-aware';
  model?: string;
};

const MAX_HISTORY_LINES = 200;

function commandHelpLines(): string[] {
  return [
    '/help',
    '/exit',
    '/health',
    '/provider <auto|shared-llm|decentralized-llm|local-fallback>',
    '/strategy <default|latency-aware>',
    '/model <id>',
    '/vault init <passphrase> <question> <answer>',
    '/vault add <key> <value>',
    '/vault get <key>',
    '/vault list [key]',
    '/embed reset',
    '/embed store <id> <value>',
    '/embed search <query> [topK] [tuned=true|false]',
    'anything else => chat prompt',
  ];
}

function splitLines(value: string): string[] {
  return value.replace(/\r\n/g, '\n').split('\n');
}

function clip(value: string, width: number): string {
  if (width <= 1) return '…';
  return value.length > width ? `${value.slice(0, Math.max(1, width - 1))}…` : value;
}

function wrapLine(value: string, width: number): string[] {
  if (width <= 0) return [''];
  if (value.length <= width) return [value];

  const out: string[] = [];
  let rest = value;

  while (rest.length > width) {
    out.push(rest.slice(0, width));
    rest = rest.slice(width);
  }

  if (rest.length > 0) out.push(rest);
  return out;
}

function wrapLines(lines: string[], width: number): string[] {
  return lines.flatMap((line) => wrapLine(line, width));
}

function pushHistory(history: string[], text: string): void {
  for (const line of splitLines(text)) history.push(line);
  if (history.length > MAX_HISTORY_LINES) history.splice(0, history.length - MAX_HISTORY_LINES);
}

function formatStatusLine(state: TuiState, width: number): string {
  const model = state.model?.trim().length ? state.model : 'default';
  return clip(`provider=${state.provider} | strategy=${state.strategy} | model=${model}`, width);
}

function drawFullScreen(state: TuiState, history: string[]): void {
  const termWidth = Math.max(80, output.columns || 80);
  const termHeight = Math.max(24, output.rows || 24);

  const leftWidth = Math.max(24, Math.floor(termWidth * 0.68));
  const rightWidth = termWidth - leftWidth - 3;

  const availableBodyRows = termHeight - 5;
  const title = 'Memphis TUI · full-screen baseline (pane mode)';

  output.write('\x1b[2J\x1b[H');
  console.log(clip(title, termWidth));
  console.log(clip(formatStatusLine(state, termWidth), termWidth));
  console.log('-'.repeat(termWidth));

  const historyLines = wrapLines(history, leftWidth);
  const visibleHistory = historyLines.slice(-availableBodyRows);

  const helpBase = ['Commands:'];
  const helpLines = wrapLines([...helpBase, ...commandHelpLines()], rightWidth);

  for (let row = 0; row < availableBodyRows; row += 1) {
    const left = clip(visibleHistory[row] ?? '', leftWidth).padEnd(leftWidth, ' ');
    const right = clip(helpLines[row] ?? '', rightWidth).padEnd(rightWidth, ' ');
    console.log(`${left} │ ${right}`);
  }

  console.log('-'.repeat(termWidth));
}

export async function runTuiApp(options: TuiOptions): Promise<void> {
  const rl = readline.createInterface({ input, output, terminal: true });
  const state: TuiState = {
    provider: options.provider ?? 'auto',
    strategy: options.strategy ?? 'default',
    model: options.model,
  };
  const history: string[] = [];

  pushHistory(history, 'Started full-screen TUI baseline. Type /help for command hints.');

  try {
    while (true) {
      drawFullScreen(state, history);
      const line = (await rl.question('memphis:tui> ')).trim();
      if (!line) continue;
      if (line === '/exit' || line === '/quit') break;

      if (line === '/help') {
        pushHistory(history, 'Help:');
        pushHistory(history, commandHelpLines().map((x) => `  ${x}`).join('\n'));
        continue;
      }

      if (line === '/health') {
        pushHistory(history, await renderHealthScreen(options.orchestration));
        continue;
      }

      if (line.startsWith('/provider ')) {
        const next = line.slice('/provider '.length).trim() as 'auto' | ProviderName;
        if (next === 'auto' || next === 'shared-llm' || next === 'decentralized-llm' || next === 'local-fallback') {
          state.provider = next;
          pushHistory(history, `ok: provider=${next}`);
        } else {
          pushHistory(history, `error: unsupported provider=${next}`);
        }
        continue;
      }

      if (line.startsWith('/strategy ')) {
        const next = line.slice('/strategy '.length).trim() as 'default' | 'latency-aware';
        if (next === 'default' || next === 'latency-aware') {
          state.strategy = next;
          pushHistory(history, `ok: strategy=${next}`);
        } else {
          pushHistory(history, `error: unsupported strategy=${next}`);
        }
        continue;
      }

      if (line.startsWith('/model ')) {
        state.model = line.slice('/model '.length).trim();
        pushHistory(history, `ok: model=${state.model}`);
        continue;
      }

      if (line.startsWith('/vault ')) {
        const [cmd, sub, ...rest] = line.split(' ');
        void cmd;
        if (sub === 'init' && rest.length >= 3) pushHistory(history, runVaultInit(rest[0], rest[1], rest.slice(2).join(' ')));
        else if (sub === 'add' && rest.length >= 2) pushHistory(history, runVaultAdd(rest[0], rest.slice(1).join(' ')));
        else if (sub === 'get' && rest.length >= 1) pushHistory(history, runVaultGet(rest[0]));
        else if (sub === 'list') pushHistory(history, runVaultList(rest[0]));
        else pushHistory(history, 'error: usage /vault init|add|get|list ...');
        continue;
      }

      if (line.startsWith('/embed ')) {
        const [, sub, ...rest] = line.split(' ');
        if (sub === 'reset') pushHistory(history, runEmbedReset());
        else if (sub === 'store' && rest.length >= 2) pushHistory(history, embedStoreScreen(rest[0], rest.slice(1).join(' ')));
        else if (sub === 'search' && rest.length >= 1) {
          const query = rest[0];
          const topK = rest[1] ? Number(rest[1]) : 5;
          const tuned = rest[2] ? rest[2] === 'true' : false;
          pushHistory(history, embedSearchScreen(query, Number.isFinite(topK) ? topK : 5, tuned));
        } else pushHistory(history, 'error: usage /embed reset|store|search ...');
        continue;
      }

      pushHistory(history, `> ${line}`);
      pushHistory(history, await runChatOnce(options.orchestration, line, state));
    }
  } finally {
    output.write('\x1b[2J\x1b[H');
    rl.close();
  }
}
