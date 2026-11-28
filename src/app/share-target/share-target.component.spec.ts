import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';

import { ShareTargetComponent } from './share-target.component';

describe('ShareTargetComponent', () => {
  let routerSpy: jasmine.SpyObj<Router>;

  function createComponent(
    params: Record<string, string>,
    navigationType: NavigationTimingType = 'navigate',
  ): ComponentFixture<ShareTargetComponent> {
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    TestBed.configureTestingModule({
      declarations: [ShareTargetComponent],
      providers: [
        { provide: Router, useValue: routerSpy },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap(params),
            },
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(ShareTargetComponent);
    spyOn(
      fixture.componentInstance as unknown as {
        getNavigationType: () => NavigationTimingType | undefined;
      },
      'getNavigationType',
    ).and.returnValue(navigationType);
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('should redirect to home with replaceUrl and sharedItem state when valid params are received', () => {
    createComponent({
      title: 'Cool Mug',
      url: 'https://example.com/mug',
    });

    expect(routerSpy.navigate).toHaveBeenCalledOnceWith(['/'], {
      replaceUrl: true,
      state: {
        sharedItem: {
          name: 'Cool Mug',
          details: '',
          url: 'https://example.com/mug',
          purchased: false,
        },
      },
    });
  });

  it('should extract URL from text when url param is missing', () => {
    createComponent({
      title: 'Cool Mug',
      text: 'Check this out https://example.com/mug!',
    });

    expect(routerSpy.navigate).toHaveBeenCalledOnceWith(['/'], {
      replaceUrl: true,
      state: {
        sharedItem: {
          name: 'Cool Mug',
          details: '',
          url: 'https://example.com/mug!',
          purchased: false,
        },
      },
    });
  });

  it('should redirect to home with replaceUrl and without sharedItem when no params are provided', () => {
    createComponent({});

    expect(routerSpy.navigate).toHaveBeenCalledOnceWith(['/'], {
      replaceUrl: true,
    });
  });

  it('should ignore stale reload navigations and redirect to home without sharedItem', () => {
    createComponent(
      { title: 'Cool Mug', url: 'https://example.com/mug' },
      'reload',
    );

    expect(routerSpy.navigate).toHaveBeenCalledOnceWith(['/'], {
      replaceUrl: true,
    });
  });

  it('should ignore stale back_forward navigations and redirect to home without sharedItem', () => {
    createComponent(
      { title: 'Cool Mug', url: 'https://example.com/mug' },
      'back_forward',
    );

    expect(routerSpy.navigate).toHaveBeenCalledOnceWith(['/'], {
      replaceUrl: true,
    });
  });
});
