import { useEffect } from 'react';

// The Google Translate extension injects a `#gtx-trans` popup (and a `.gtx-trans-icon` button)
// into the page when translating selected text. A scoped stylesheet hides them without touching
// the nodes the extension owns, which would otherwise conflict with React's own DOM updates.
export const useHideGoogleTranslateExtensionPopup = () => {
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `#gtx-trans, .gtx-trans-icon { display: none !important; }`;
    document.head.appendChild(style);

    return () => style.remove();
  }, []);
};
