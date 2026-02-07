import { TestBed } from '@angular/core/testing';
import { UiSurfaceCardComponent } from './primitives';

describe('UiSurfaceCardComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UiSurfaceCardComponent],
    }).compileComponents();
  });

  it('should render required and optional inputs', () => {
    const fixture = TestBed.createComponent(UiSurfaceCardComponent);
    fixture.componentRef.setInput('title', 'Storage');
    fixture.componentRef.setInput('subtitle', 'Encrypted');
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('Storage');
    expect(host.textContent).toContain('Encrypted');
  });
});
