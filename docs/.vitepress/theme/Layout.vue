<script setup lang="ts">
import DefaultTheme from "vitepress/theme";
import { computed } from "vue";
import { useData, withBase } from "vitepress";

const { Layout } = DefaultTheme;
const { frontmatter } = useData();
const chipName = "{{name}}";
const chipAmt = "{{amt}}";
const chipDate = "{{date}}";
const hero = computed(() => (frontmatter.value.hero ?? {}) as {
  name?: string;
  text?: string;
  tagline?: string;
});
</script>

<template>
  <Layout>
    <template #layout-top>
      <div class="vt-brand-bg" aria-hidden="true">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
          <defs>
            <linearGradient id="vt-orb" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#3659e3" stop-opacity=".28" />
              <stop offset="100%" stop-color="#7b93f0" stop-opacity="0" />
            </linearGradient>
            <linearGradient id="vt-path" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stop-color="#3659e3" stop-opacity=".15" />
              <stop offset="100%" stop-color="#3659e3" stop-opacity=".55" />
            </linearGradient>
            <filter id="vt-soft" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="24" />
            </filter>
          </defs>

          <circle class="vt-orb vt-orb-a" cx="180" cy="140" r="220" fill="url(#vt-orb)" filter="url(#vt-soft)" />
          <circle class="vt-orb vt-orb-b" cx="1280" cy="720" r="260" fill="url(#vt-orb)" filter="url(#vt-soft)" />
          <circle class="vt-orb vt-orb-c" cx="980" cy="120" r="160" fill="url(#vt-orb)" filter="url(#vt-soft)" />

          <g class="vt-grid" fill="none" stroke="#3659e3" stroke-opacity=".12" stroke-width="1">
            <rect x="80" y="80" width="220" height="300" rx="10" />
            <rect x="92" y="98" width="196" height="12" rx="3" fill="#3659e3" fill-opacity=".08" stroke="none" />
            <rect x="92" y="122" width="160" height="8" rx="2" fill="#3659e3" fill-opacity=".07" stroke="none" />
            <rect x="92" y="140" width="176" height="8" rx="2" fill="#3659e3" fill-opacity=".05" stroke="none" />
            <rect x="92" y="168" width="88" height="22" rx="11" fill="#3659e3" fill-opacity=".14" stroke="none" />
            <text x="136" y="183" text-anchor="middle" fill="#3659e3" fill-opacity=".45" font-family="ui-monospace, Menlo, monospace" font-size="11">{{ chipName }}</text>
            <rect x="92" y="210" width="196" height="90" rx="4" />
            <path d="M92 240h196M157 210v90M223 210v90" />
          </g>

          <path
            class="vt-export-path"
            d="M310 230 C 520 180, 640 360, 860 300 S 1180 220, 1320 340"
            fill="none"
            stroke="url(#vt-path)"
            stroke-width="2"
            stroke-dasharray="10 14"
            stroke-linecap="round"
          />

          <g class="vt-page vt-page-a" fill="#3659e3" fill-opacity=".06" stroke="#3659e3" stroke-opacity=".22" stroke-width="1.2">
            <rect x="520" y="430" width="150" height="200" rx="8" />
            <path d="M630 430 v22 a6 6 0 0 0 6 6 h14 Z" fill="#3659e3" fill-opacity=".12" />
            <rect x="538" y="470" width="114" height="7" rx="2" fill="#3659e3" fill-opacity=".12" stroke="none" />
            <rect x="538" y="486" width="90" height="7" rx="2" fill="#3659e3" fill-opacity=".1" stroke="none" />
            <rect x="538" y="502" width="102" height="7" rx="2" fill="#3659e3" fill-opacity=".08" stroke="none" />
          </g>

          <g class="vt-page vt-page-b" fill="#3659e3" fill-opacity=".05" stroke="#3659e3" stroke-opacity=".2" stroke-width="1.2">
            <rect x="1080" y="380" width="140" height="186" rx="8" />
            <rect x="1096" y="410" width="108" height="7" rx="2" fill="#3659e3" fill-opacity=".12" stroke="none" />
            <rect x="1096" y="426" width="84" height="7" rx="2" fill="#3659e3" fill-opacity=".1" stroke="none" />
            <rect x="1096" y="452" width="48" height="16" rx="8" fill="#3659e3" fill-opacity=".16" stroke="none" />
            <text x="1120" y="463" text-anchor="middle" fill="#3659e3" fill-opacity=".5" font-family="ui-monospace, Menlo, monospace" font-size="9">PDF</text>
          </g>

          <g class="vt-chip vt-chip-a">
            <rect x="740" y="160" width="92" height="28" rx="14" fill="#3659e3" fill-opacity=".12" />
            <text x="786" y="179" text-anchor="middle" fill="#3659e3" fill-opacity=".55" font-family="ui-monospace, Menlo, monospace" font-size="12">{{ chipAmt }}</text>
          </g>
          <g class="vt-chip vt-chip-b">
            <rect x="1180" y="560" width="108" height="28" rx="14" fill="#3659e3" fill-opacity=".12" />
            <text x="1234" y="579" text-anchor="middle" fill="#3659e3" fill-opacity=".5" font-family="ui-monospace, Menlo, monospace" font-size="12">{{ chipDate }}</text>
          </g>
        </svg>
      </div>
    </template>

    <template #home-hero-info>
      <h1 class="heading">
        <span class="vt-hero-name">
          <img class="vt-hero-mark" :src="withBase('/logo.svg')" width="56" height="56" alt="" />
          <span class="name clip">{{ hero.name }}</span>
        </span>
        <span class="text">{{ hero.text }}</span>
      </h1>
      <p class="tagline" v-html="hero.tagline" />
    </template>
  </Layout>
</template>
