import { TestBed } from '@angular/core/testing';
import { SceneLabPage } from './scene-lab-page';

describe('SceneLabPage', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SceneLabPage],
    }).compileComponents();
  });

  it('should create the page', () => {
    const fixture = TestBed.createComponent(SceneLabPage);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should tear down without errors after render', async () => {
    const fixture = TestBed.createComponent(SceneLabPage);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(() => fixture.destroy()).not.toThrow();
  });
});
