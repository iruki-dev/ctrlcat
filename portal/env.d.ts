declare module "virtual-game" {
  const Game: React.ComponentType;
  export default Game;
}

declare module "virtual-provider" {
  const provider: import("./providers/types").PortalProvider;
  export default provider;
}
