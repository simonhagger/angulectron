import { TestBed } from '@angular/core/testing';
import { CarbonNoticeComponent } from './carbon-adapters';

describe('CarbonNoticeComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CarbonNoticeComponent],
    }).compileComponents();
  });

  it('should render title, body, and status attribute', () => {
    const fixture = TestBed.createComponent(CarbonNoticeComponent);
    fixture.componentRef.setInput('title', 'Policy');
    fixture.componentRef.setInput('body', 'Network access blocked');
    fixture.componentRef.setInput('status', 'warning');
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const notice = host.querySelector('aside');
    expect(host.textContent).toContain('Policy');
    expect(host.textContent).toContain('Network access blocked');
    expect(notice?.getAttribute('data-status')).toBe('warning');
  });
});
