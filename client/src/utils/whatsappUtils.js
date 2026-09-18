/**
 * Utility to format and open WhatsApp links reliably across iOS, Android, and Desktop devices.
 */

export const isMobileDevice = () => {
  if (typeof window === "undefined" || !navigator) return false;

  const userAgent = navigator.userAgent || navigator.vendor || window.opera || "";
  const isIOS = /iPad|iPhone|iPod/.test(userAgent) || 
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(userAgent);
  const isMobileUA = /webOS|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);

  return isIOS || isAndroid || isMobileUA;
};

export const getWhatsAppUrl = (message) => {
  const encodedMessage = encodeURIComponent(message);
  // wa.me is the official WhatsApp Universal Link format supported across iOS, Android, & Desktop
  return `https://wa.me/?text=${encodedMessage}`;
};

export const openWhatsAppMessage = (message, targetWindow = null) => {
  const url = getWhatsAppUrl(message);

  if (isMobileDevice()) {
    // If a popup window was pre-opened on mobile, close it since mobile doesn't use it
    if (targetWindow && !targetWindow.closed) {
      targetWindow.close();
    }
    // On iOS Safari & Android Mobile, changing window.location.href avoids popup blockers
    // and directly launches the WhatsApp native app via Universal Links.
    window.location.href = url;
  } else {
    // On Desktop
    if (targetWindow && !targetWindow.closed) {
      targetWindow.location.href = url;
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }
};
