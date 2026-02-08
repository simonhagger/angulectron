import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import {
  FormField,
  email,
  form,
  required,
  submit,
  type ValidationError,
} from '@angular/forms/signals';

type AsyncFormModel = {
  username: string;
  emailAddress: string;
};

@Component({
  selector: 'app-async-validation-lab-page',
  imports: [
    CommonModule,
    FormField,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
  ],
  templateUrl: './async-validation-lab-page.html',
  styleUrl: './async-validation-lab-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AsyncValidationLabPage {
  readonly model = signal<AsyncFormModel>({
    username: '',
    emailAddress: '',
  });

  readonly demoForm = form(this.model, (path) => {
    required(path.username, { message: 'Username is required.' });
    required(path.emailAddress, { message: 'Email is required.' });
    email(path.emailAddress, { message: 'Use a valid email address.' });
  });

  readonly checkingUsername = signal(false);
  readonly usernameTaken = signal(false);
  readonly usernameHint = signal(
    'Type a username and run async availability check.',
  );
  readonly submitMessage = signal('Idle');
  readonly isSubmitting = computed(() => this.demoForm().submitting());

  readonly usernameError = computed(() => {
    if (this.usernameTaken()) {
      return 'This username is already reserved in the simulated service.';
    }
    return this.errorFor(this.demoForm.username().errors());
  });

  readonly emailError = computed(() =>
    this.errorFor(this.demoForm.emailAddress().errors()),
  );

  async checkUsername() {
    const username = this.demoForm.username().value().trim().toLowerCase();
    this.usernameTaken.set(false);

    if (!username) {
      this.usernameHint.set('Enter a username before checking.');
      return;
    }

    this.checkingUsername.set(true);
    this.usernameHint.set('Checking availability...');

    await new Promise((resolve) => setTimeout(resolve, 700));

    const blocked = new Set(['admin', 'root', 'system', 'angulectron']);
    const isTaken = blocked.has(username);
    this.usernameTaken.set(isTaken);
    this.usernameHint.set(
      isTaken ? 'Username is unavailable.' : 'Username is available.',
    );
    this.checkingUsername.set(false);
  }

  async onSubmit(event: Event) {
    event.preventDefault();
    this.submitMessage.set('Validating and submitting...');

    await submit(this.demoForm, async () => {
      if (this.usernameTaken()) {
        return null;
      }

      await new Promise((resolve) => setTimeout(resolve, 450));
      this.submitMessage.set('Submitted. Async validation passed.');
      return null;
    });

    if (this.demoForm().invalid() || this.usernameTaken()) {
      this.submitMessage.set('Resolve validation issues before submitting.');
    }
  }

  private errorFor(errors: readonly ValidationError.WithField[]): string {
    const first = errors[0];
    if (!first) {
      return '';
    }

    return first.message ?? `Validation error: ${first.kind}`;
  }
}
