declare module "screenshot-desktop" {
  const screenshot: (options?: { format?: string }) => Promise<Buffer>;
  export = screenshot;
}
