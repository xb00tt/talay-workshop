import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Only enable when DSN is configured
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Capture 10% of traces for performance monitoring
  tracesSampleRate: 0.1,

  // Capture 10% of replays for error investigation
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.0,
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
