import { trackEvent } from './api';

export function track(name: string, props?: any) {
  return trackEvent(name, props);
}


