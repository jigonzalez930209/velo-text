import DefaultTheme from "vitepress/theme";
import type { Theme } from "vitepress";
import PlaygroundApp from "./PlaygroundApp.vue";
import ExamplesPlayground from "./ExamplesPlayground.vue";
import "../../../themes/base.css";
import "../../../themes/components.css";
import "../playground/playground.css";

const theme: Theme = {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component("PlaygroundApp", PlaygroundApp);
    app.component("ExamplesPlayground", ExamplesPlayground);
  },
};

export default theme;
