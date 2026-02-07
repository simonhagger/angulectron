import { TestBed } from '@angular/core/testing';
import { UiPrimaryButtonComponent } from './material';

describe('UiPrimaryButtonComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UiPrimaryButtonComponent],
    }).compileComponents();
  });

  it('should render label and icon input', () => {
    const fixture = TestBed.createComponent(UiPrimaryButtonComponent);
    fixture.componentRef.setInput('label', 'Save');
    fixture.componentRef.setInput('icon', 'check');
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('Save');
    expect(host.textContent).toContain('check');
  });
});
