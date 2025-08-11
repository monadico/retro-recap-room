declare module 'react-together' {
  import * as React from 'react';

  export interface SessionParams {
    appId: string;
    apiKey: string;
    name?: string;
    password?: string;
    model?: any;
    viewData?: Record<string, any>;
  }

  export interface ReactTogetherProps {
    sessionParams: SessionParams;
    sessionIgnoresUrl?: boolean;
    userId?: string;
    deriveNickname?: (userId: string) => string;
    rememberUsers?: boolean;
    children?: React.ReactNode;
  }

  export const ReactTogether: React.FC<ReactTogetherProps>;

  export function useStateTogether<T = any>(
    key: string,
    initialValue: T,
    options?: { resetOnDisconnect?: boolean; throttleDelay?: number }
  ): [T, React.Dispatch<React.SetStateAction<T>>];
}

