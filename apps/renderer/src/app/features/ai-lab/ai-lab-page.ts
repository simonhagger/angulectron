import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { getDesktopApi } from '@electron-foundation/desktop-api';

interface CapabilityReport {
  pythonVersion: string;
  platform: string;
  cpuCount: number;
  totalMemoryBytes: number | null;
  nvidiaDriverPresent: boolean;
  gpus: Array<{
    name: string;
    vramMb: number | null;
    driverVersion: string | null;
  }>;
  gpuProbeError?: string | null;
  backends: {
    llamaCpp: boolean;
    torch: boolean;
    onnxRuntime: boolean;
    transformers: boolean;
  };
  modelsDir: string;
  models: Array<{ fileName: string; sizeBytes: number }>;
  canRunLocalLlm: boolean;
  recommendedBackend: 'none' | 'llama-cpp';
  notes: string[];
}

interface McpTool {
  name: string;
  description: string;
}

@Component({
  selector: 'app-ai-lab-page',
  imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule],
  templateUrl: './ai-lab-page.html',
  styleUrl: './ai-lab-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiLabPage {
  private readonly destroyRef = inject(DestroyRef);

  readonly desktopAvailable = signal(!!getDesktopApi());
  readonly report = signal<CapabilityReport | null>(null);
  readonly probeStatus = signal('Not probed yet.');

  readonly mcpConnected = signal(false);
  readonly mcpStatus = signal('MCP session not started.');
  readonly mcpTools = signal<McpTool[]>([]);
  readonly mcpOutput = signal('');

  readonly prompt = signal('');
  readonly generating = signal(false);
  readonly generationOutput = signal(
    'Local generation output will appear here.',
  );

  constructor() {
    this.destroyRef.onDestroy(() => this.generating.set(false));
  }

  async probeCapabilities() {
    const desktop = getDesktopApi();
    if (!desktop) {
      this.probeStatus.set('Desktop bridge unavailable in browser mode.');
      return;
    }

    this.probeStatus.set('Probing AI capabilities via Python sidecar…');
    const result = await desktop.ai.capabilities();
    if (!result.ok) {
      this.probeStatus.set(result.error.message);
      return;
    }

    this.report.set(result.data);
    this.probeStatus.set(
      result.data.canRunLocalLlm
        ? 'Local LLM ready.'
        : 'Local LLM not configured — see setup notes below.',
    );
  }

  async connectMcp() {
    const desktop = getDesktopApi();
    if (!desktop) {
      this.mcpStatus.set('Desktop bridge unavailable in browser mode.');
      return;
    }

    const init = await desktop.ai.mcpInvoke('initialize');
    if (!init.ok) {
      this.mcpStatus.set(init.error.message);
      return;
    }

    await desktop.ai.mcpInvoke('notifications/initialized');

    const tools = await desktop.ai.mcpInvoke('tools/list');
    if (!tools.ok) {
      this.mcpStatus.set(tools.error.message);
      return;
    }

    const listed = (tools.data.result as { tools?: McpTool[] } | undefined)
      ?.tools;
    this.mcpTools.set(listed ?? []);
    this.mcpConnected.set(true);
    this.mcpStatus.set(
      `MCP session active — ${this.mcpTools().length} tools available.`,
    );
  }

  async callTool(toolName: string) {
    const desktop = getDesktopApi();
    if (!desktop) {
      return;
    }

    this.mcpOutput.set(`Calling ${toolName}…`);
    const call = await desktop.ai.mcpInvoke('tools/call', {
      name: toolName,
      arguments:
        toolName === 'echo'
          ? { text: `Hello from ${new Date().toISOString()}` }
          : {},
    });
    if (!call.ok) {
      this.mcpOutput.set(`Error: ${call.error.message}`);
      return;
    }

    const content = (
      call.data.result as {
        content?: Array<{ type: string; text?: string }>;
      }
    )?.content;
    this.mcpOutput.set(
      content?.map((chunk) => chunk.text ?? '').join('\n') ??
        JSON.stringify(call.data.result, null, 2),
    );
  }

  async generate() {
    const desktop = getDesktopApi();
    if (!desktop) {
      return;
    }
    const text = this.prompt().trim();
    if (!text || this.generating()) {
      return;
    }

    this.generating.set(true);
    this.generationOutput.set('Generating locally…');
    const result = await desktop.ai.generate(text, 128);
    this.generating.set(false);

    if (!result.ok) {
      this.generationOutput.set(`Error: ${result.error.message}`);
      return;
    }

    if (!result.data.available) {
      this.generationOutput.set(
        [
          `Unavailable: ${result.data.reason ?? 'unknown reason'}`,
          ...(result.data.guidance ?? []),
        ].join('\n'),
      );
      return;
    }

    this.generationOutput.set(
      `[${result.data.model} · ${result.data.elapsedMs} ms]\n${result.data.text}`,
    );
  }
}
