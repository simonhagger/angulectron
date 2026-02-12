import { inject } from '@angular/core';
import {
  type ActivatedRouteSnapshot,
  type CanActivateChildFn,
  type CanActivateFn,
  type CanDeactivateFn,
  type CanMatchFn,
  Router,
  type RouterStateSnapshot,
  type Route,
  type UrlSegment,
  type UrlTree,
} from '@angular/router';
import { getDesktopApi } from '@electron-foundation/desktop-api';

export interface JwtProtectedRouteComponent {
  canDeactivateJwt?: () => boolean | Promise<boolean>;
}

const buildAuthUrlTree = (router: Router, returnUrl: string): UrlTree =>
  router.createUrlTree(['/auth-session-lab'], {
    queryParams: { returnUrl },
  });

const ensureActiveJwtSession = async (
  returnUrl: string,
): Promise<boolean | UrlTree> => {
  const router = inject(Router);
  const desktop = getDesktopApi();
  if (!desktop) {
    return buildAuthUrlTree(router, returnUrl);
  }

  const response = await desktop.auth.getSessionSummary();
  if (!response.ok) {
    return buildAuthUrlTree(router, returnUrl);
  }

  return response.data.state === 'active'
    ? true
    : buildAuthUrlTree(router, returnUrl);
};

export const jwtCanActivateGuard: CanActivateFn = (
  _route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot,
) => ensureActiveJwtSession(state.url);

export const jwtCanActivateChildGuard: CanActivateChildFn = (
  _childRoute: ActivatedRouteSnapshot,
  state: RouterStateSnapshot,
) => ensureActiveJwtSession(state.url);

export const jwtCanMatchGuard: CanMatchFn = (
  _route: Route,
  segments: UrlSegment[],
) => {
  const returnUrl = `/${segments.map((segment) => segment.path).join('/')}`;
  return ensureActiveJwtSession(returnUrl);
};

export const jwtCanDeactivateGuard: CanDeactivateFn<
  JwtProtectedRouteComponent
> = async (component) => {
  if (!component.canDeactivateJwt) {
    return true;
  }

  return component.canDeactivateJwt();
};
