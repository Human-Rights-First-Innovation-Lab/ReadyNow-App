/// <reference types="nativewind/types" />

// NativeWind adds className support to React Native components
// This declaration file augments existing types to recognize className prop

import 'react-native';

declare module 'react-native' {
  namespace JSX {
    interface IntrinsicAttributes {
      className?: string;
    }
  }
  
  interface ViewProps {
    className?: string;
  }
  
  interface TextProps {
    className?: string;
  }
  
  interface ImageProps {
    className?: string;
  }
  
  interface ScrollViewProps {
    className?: string;
  }
  
  interface TouchableOpacityProps {
    className?: string;
  }
  
  interface TouchableHighlightProps {
    className?: string;
  }
  
  interface TouchableWithoutFeedbackProps {
    className?: string;
  }
  
  interface TextInputProps {
    className?: string;
  }
  
  interface PressableProps {
    className?: string;
  }
}

declare module 'react-native-safe-area-context' {
  import { ViewProps } from 'react-native';
  
  interface SafeAreaViewProps extends ViewProps {
    className?: string;
  }
}

declare module '@expo/vector-icons' {
  interface IconProps {
    className?: string;
  }
}

