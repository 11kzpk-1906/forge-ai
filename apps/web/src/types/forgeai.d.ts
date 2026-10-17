export {};

declare global {
  interface Window {
    forgeAI?: {
      readonly isDesktop: true;
      openOAuthUrl(url: string): Promise<void>;
      onOAuthCallback(listener: (callbackUrl: string) => void): () => void;
    };
  }
}
