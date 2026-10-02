declare module 'expo-blur' {
  import { ViewProps } from 'react-native';
  
  export interface BlurViewProps extends ViewProps {
    tint?: 'light' | 'dark' | 'systemChromeMaterial';
    intensity?: number;
  }

  export const BlurView: React.FC<BlurViewProps>;
} 