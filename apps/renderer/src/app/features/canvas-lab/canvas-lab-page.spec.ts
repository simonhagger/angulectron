import { TestBed } from '@angular/core/testing';
import { CanvasLabPage } from './canvas-lab-page';

describe('CanvasLabPage', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CanvasLabPage],
    }).compileComponents();
  });

  it('should create the page', () => {
    const fixture = TestBed.createComponent(CanvasLabPage);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should tear down without errors after render', async () => {
    const fixture = TestBed.createComponent(CanvasLabPage);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(() => fixture.destroy()).not.toThrow();
  });
});
