import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { getDesktopApi } from '@electron-foundation/desktop-api';

@Component({
  selector: 'app-file-tools-page',
  imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule],
  templateUrl: './file-tools-page.html',
  styleUrl: './file-tools-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FileToolsPage {
  readonly desktopAvailable = signal(!!getDesktopApi());
  readonly selectedFileName = signal('');
  readonly fileToken = signal('');
  readonly status = signal('Idle.');
  readonly preview = signal('');

  async chooseFile() {
    const desktop = getDesktopApi();
    if (!desktop) {
      this.status.set('Desktop bridge unavailable in browser mode.');
      return;
    }

    const result = await desktop.dialog.openFile({
      title: 'Select a text file',
      filters: [
        { name: 'Text files', extensions: ['txt', 'md', 'json', 'log'] },
      ],
    });

    if (!result.ok) {
      this.status.set(result.error.message);
      return;
    }

    if (result.data.canceled || !result.data.fileToken) {
      this.status.set('No file selected.');
      this.fileToken.set('');
      this.selectedFileName.set('');
      return;
    }

    this.selectedFileName.set(result.data.fileName ?? 'Unnamed file');
    this.fileToken.set(result.data.fileToken);
    this.preview.set('');
    this.status.set('File selected.');
  }

  async loadPreview() {
    const desktop = getDesktopApi();
    if (!desktop) {
      this.status.set('Desktop bridge unavailable in browser mode.');
      return;
    }

    const token = this.fileToken();
    if (!token) {
      this.status.set('Select a file first.');
      return;
    }

    const result = await desktop.fs.readTextFile(token);
    if (!result.ok) {
      this.status.set(result.error.message);
      return;
    }

    this.preview.set(result.data.slice(0, 2000));
    this.fileToken.set('');
    this.status.set('Preview loaded. Token consumed for security.');
  }
}
