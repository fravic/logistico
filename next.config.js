/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["actor-kit", "three"],
  webpack: (config) => {
    config.module.rules.push({
      test: /\.(frag|vert|glsl)$/,
      type: "asset/source",
    });
    return config;
  },
};

module.exports = nextConfig;
