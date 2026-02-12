import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'ui-primary-button',
  imports: [MatButtonModule],
  templateUrl: './material.html',
  styleUrl: './material.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UiPrimaryButtonComponent {
  @Input({ required: true }) label!: string;
  @Input() icon: string | null = null;
  @Input() disabled = false;
  @Output() readonly pressed = new EventEmitter<Event>();
}
