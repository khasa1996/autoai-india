/** @type {import('next').NextConfig} */
const config = {
  poweredByHeader: false,
  transpilePackages: ['@autoai/automotive-domain', '@autoai/validation', '@autoai/api-client', '@autoai/i18n'],
  async rewrites() { return [{source:'/api/:path*',destination:'http://127.0.0.1:4000/api/:path*'}]; },
  async headers() { return [{source:'/:path*',headers:[{key:'X-Content-Type-Options',value:'nosniff'},{key:'X-Frame-Options',value:'DENY'},{key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},{key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'}]}]; }
};
export default config;
