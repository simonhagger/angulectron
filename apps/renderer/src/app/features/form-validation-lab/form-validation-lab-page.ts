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
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import {
  FormField,
  email,
  form,
  minLength,
  required,
  submit,
  type ValidationError,
} from '@angular/forms/signals';

type ThemeChoice = 'neutral' | 'warm' | 'cool';

type ProfileModel = {
  fullName: string;
  emailAddress: string;
  preferredTheme: ThemeChoice | '';
  notes: string;
  acceptTerms: boolean;
};

@Component({
  selector: 'app-form-validation-lab-page',
  imports: [
    CommonModule,
    FormField,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatButtonModule,
  ],
  templateUrl: './form-validation-lab-page.html',
  styleUrl: './form-validation-lab-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormValidationLabPage {
  readonly model = signal<ProfileModel>({
    fullName: '',
    emailAddress: '',
    preferredTheme: '',
    notes: '',
    acceptTerms: false,
  });

  readonly demoForm = form(this.model, (path) => {
    required(path.fullName, { message: 'Name is required.' });
    minLength(path.fullName, 3, {
      message: 'Name must be at least 3 characters.',
    });

    required(path.emailAddress, { message: 'Email is required.' });
    email(path.emailAddress, { message: 'Enter a valid email address.' });

    required(path.preferredTheme, { message: 'Select a theme option.' });
    minLength(path.notes, 12, {
      message: 'Notes must be at least 12 characters.',
    });
    required(path.acceptTerms, {
      when: ({ value }) => value() !== true,
      message: 'You must accept terms to continue.',
    });
  });

  readonly isSubmitting = computed(() => this.demoForm().submitting());
  readonly submitMessage = signal(
    'Complete the form to preview Signal Form validation.',
  );
  readonly lastSubmitted = signal<ProfileModel | null>(null);

  readonly fullNameError = computed(() =>
    this.errorFor(this.demoForm.fullName().errors()),
  );
  readonly emailError = computed(() =>
    this.errorFor(this.demoForm.emailAddress().errors()),
  );
  readonly themeError = computed(() =>
    this.errorFor(this.demoForm.preferredTheme().errors()),
  );
  readonly notesError = computed(() =>
    this.errorFor(this.demoForm.notes().errors()),
  );
  readonly termsError = computed(() =>
    this.errorFor(this.demoForm.acceptTerms().errors()),
  );

  readonly themes: Array<{ value: ThemeChoice; label: string }> = [
    { value: 'neutral', label: 'Neutral' },
    { value: 'warm', label: 'Warm' },
    { value: 'cool', label: 'Cool' },
  ];

  async onSubmit(event: Event) {
    event.preventDefault();
    this.submitMessage.set('Validating...');

    await submit(this.demoForm, async (formTree) => {
      this.lastSubmitted.set(formTree().value());
      this.submitMessage.set(
        'Submitted successfully via Angular Signal Forms.',
      );
      return null;
    });

    if (this.demoForm().invalid()) {
      this.submitMessage.set(
        'Fix validation errors and submit again. Fields were marked as touched.',
      );
    }
  }

  resetForm() {
    this.lastSubmitted.set(null);
    this.submitMessage.set('Form reset.');
    this.demoForm().reset({
      fullName: '',
      emailAddress: '',
      preferredTheme: '',
      notes: '',
      acceptTerms: false,
    });
  }

  private errorFor(errors: readonly ValidationError.WithField[]): string {
    const first = errors[0];
    if (!first) {
      return '';
    }

    if (first.message) {
      return first.message;
    }

    return `Validation error: ${first.kind}`;
  }
}
