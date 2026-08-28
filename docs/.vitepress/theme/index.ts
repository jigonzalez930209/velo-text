import DefaultTheme from "vitepress/theme";
import type { Theme } from "vitepress";
import Layout from "./Layout.vue";
import PlaygroundApp from "./PlaygroundApp.vue";
import ExamplesPlayground from "./ExamplesPlayground.vue";
import "../../../themes/base.css";
import "../../../themes/components.css";
import "../playground/playground.css";
import "./brand.css";

const theme: Theme = {
  extends: DefaultTheme,
  Layout,
  enhanceApp({ app }) {
    app.component("PlaygroundApp", PlaygroundApp);
    app.component("ExamplesPlayground", ExamplesPlayground);
  },
};

export default theme;
