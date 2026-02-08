import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { getDesktopApi } from '@electron-foundation/desktop-api';

@Component({
  selector: 'app-file-workflow-studio-page',
  imports: [CommonModule, MatCardModule, MatButtonModule],
  templateUrl: './file-workflow-studio-page.html',
  styleUrl: './file-workflow-studio-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FileWorkflowStudioPage {
  readonly desktopAvailable = signal(!!getDesktopApi());
  readonly status = signal('Idle.');
  readonly fileName = signal('');
  readonly preview = signal('');
  readonly parsedSummary = signal('No parsed payload yet.');
  readonly timeline = signal<string[]>([]);

  async runWorkflow() {
    const desktop = getDesktopApi();
    if (!desktop) {
      this.status.set('Desktop bridge unavailable in browser mode.');
      return;
    }

    this.timeline.set([]);
    this.push('Starting file workflow.');

    const open = await desktop.dialog.openFile({
      title: 'Select JSON or text file',
      filters: [{ name: 'Data files', extensions: ['json', 'txt', 'md'] }],
    });

    if (!open.ok || open.data.canceled || !open.data.fileToken) {
      this.status.set('No file selected.');
      this.push('Workflow ended: no file selected.');
      return;
    }

    this.fileName.set(open.data.fileName ?? 'Unnamed file');
    this.push(`Selected file: ${this.fileName()}`);

    const read = await desktop.fs.readTextFile(open.data.fileToken);
    if (!read.ok) {
      this.status.set(read.error.message);
      this.push(`Read failed: ${read.error.code}`);
      return;
    }

    const content = read.data;
    this.preview.set(content.slice(0, 240));
    this.push(`Read success: ${content.length} characters.`);

    try {
      const parsed = JSON.parse(content) as unknown;
      if (parsed && typeof parsed === 'object') {
        const keys = Object.keys(parsed as Record<string, unknown>);
        this.parsedSummary.set(
          `JSON detected with ${keys.length} top-level keys: ${keys.slice(0, 6).join(', ') || '(none)'}`,
        );
      } else {
        this.parsedSummary.set('JSON parsed but payload is a primitive value.');
      }
      this.push('Parse success: valid JSON.');
    } catch {
      this.parsedSummary.set('File is not JSON. Treated as plain text.');
      this.push('Parse step skipped: non-JSON content.');
    }

    this.status.set('Workflow complete.');
    this.push('Workflow complete.');
  }

  private push(event: string) {
    this.timeline.update((current) => [
      ...current,
      `${new Date().toLocaleTimeString()} - ${event}`,
    ]);
  }
}
