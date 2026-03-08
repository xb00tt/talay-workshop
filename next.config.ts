import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

const nextConfig: NextConfig = {
  // Uploads served via /api/uploads/[...path] route handler
}

export default withNextIntl(nextConfig)
