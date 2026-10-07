import { NextResponse } from 'next/server';

export function middleware(request) {
  const token = request.cookies.get('token')?.value;
  const { pathname } = request.nextUrl;

  const authRoutes = ['/signin', '/signup'];
  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route));

  // If logged in and trying to visit signin/signup or landing page
  if (token && (isAuthRoute || pathname === '/')) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // If not logged in and trying to access protected dashboard routes
  if (!token && pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/signin', request.url));
  }

  // If root / and no token, redirect to signin
  if (!token && pathname === '/') {
    return NextResponse.redirect(new URL('/signin', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/',
    '/signin',
    '/signup',
    '/dashboard/:path*',
    '/dashboard',
  ],
};
