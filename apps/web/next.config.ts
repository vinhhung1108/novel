// apps/admin/next.config.ts  (apps/web tương tự)
import type { NextConfig } from "next";

const config: NextConfig = {
  experimental: {
    reactCompiler: true, // dùng SWC + React Compiler
  },
};

export default config;
