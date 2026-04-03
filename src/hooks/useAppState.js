import { useApp } from '../redux/AppContext';

export default function useAppState() {
  return useApp();
}
