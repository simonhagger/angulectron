import { getTestBed, TestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { UiSurfaceCardComponent } from './primitives';

describe('UiSurfaceCardComponent', () => {
  beforeAll(() => {
    try {
      getTestBed().initTestEnvironment(
        BrowserDynamicTestingModule,
        platformBrowserDynamicTesting(),
      );
    } catch {
      // Ignore duplicate initialization when the test environment is already configured.
    }
  });

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
