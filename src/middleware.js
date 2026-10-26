import { NextResponse } from 'next/server';

const PRIVATE_PREFIXES = [
  '/dashboard',
  '/projects',
  '/tasks',
  '/issues',
  '/team',
  '/settings',
];

export function middleware(request) {
  const token = request.cookies.get('token')?.value;
  const { pathname } = request.nextUrl;

  const authRoutes = ['/signin', '/signup'];
  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route));
  const isPrivateRoute = PRIVATE_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  // If logged in and trying to visit signin/signup or landing page
  if (token && (isAuthRoute || pathname === '/')) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // If not logged in and trying to access any protected private route
  if (!token && (isPrivateRoute || pathname === '/')) {
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
    '/projects/:path*',
    '/projects',
    '/tasks/:path*',
    '/tasks',
    '/issues/:path*',
    '/issues',
    '/team/:path*',
    '/team',
    '/settings/:path*',
    '/settings',
  ],
};
