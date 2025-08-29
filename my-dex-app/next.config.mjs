import path from 'path';

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ["raw.githubusercontent.com"],
  },
  webpack: (config, { isServer }) => {
    config.resolve.alias['@common'] = path.resolve(__dirname, '../../common');
    return config;
  },
};

export default nextConfig;
