declare module "virtual-game" {
  const Game: React.ComponentType;
  export default Game;
}

declare module "virtual-provider" {
  const provider: import("./providers/types").PortalProvider;
  export default provider;
}

declare module "virtual-theme";

/** The game's display title, from its content frontmatter. */
declare const __GAME_TITLE__: string;
