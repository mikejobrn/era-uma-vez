// Design tokens — Era Uma Vez Fantasy Design System

export const colors = {
  evento: "#923c35",
  pergaminho: "#f5ebdc",
  dourado: "#c9a84c",
  fundo: "#1a0e05",
  texto: "#2c1a0e",
} as const;

export const fonts = {
  title: "'Cinzel', serif",
  display: "'PirataOne', cursive",
  decorative: "'UnifrakturCook', cursive",
  body: "'Cinzel', serif",
} as const;

// Re-export components
export { CardFan } from "./components/CardFan";
export { EndingCard } from "./components/EndingCard";
export { StoryLog } from "./components/StoryLog";
export { PlayerAvatar } from "./components/PlayerAvatar";
