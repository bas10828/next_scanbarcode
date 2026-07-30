import coreWebVitals from "eslint-config-next/core-web-vitals";

const config = [
  {
    ignores: [".claude/**", ".next/**", "node_modules/**"],
  },
  ...coreWebVitals,
];

export default config;
