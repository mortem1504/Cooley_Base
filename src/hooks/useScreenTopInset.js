import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function useScreenTopInset(extra = 0) {
  const insets = useSafeAreaInsets();
  return insets.top + extra;
}
