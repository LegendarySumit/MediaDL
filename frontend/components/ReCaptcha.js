"use client";

import { useEffect } from 'react';

export default function ReCaptcha({ onVerify, siteKey }) {
  useEffect(() => {
    // Load reCAPTCHA script
    if (!siteKey) return;

    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
    script.async = true;
    document.body.appendChild(script);

    return () => {
      // Cleanup
      const existingScript = document.querySelector(`script[src*="recaptcha"]`);
      if (existingScript) {
        document.body.removeChild(existingScript);
      }
    };
  }, [siteKey]);

  const executeRecaptcha = async (action = 'submit') => {
    if (!siteKey || !window.grecaptcha) {
      // If reCAPTCHA is not configured, return null (bypass)
      return null;
    }

    try {
      await window.grecaptcha.ready();
      const token = await window.grecaptcha.execute(siteKey, { action });
      if (onVerify) {
        onVerify(token);
      }
      return token;
    } catch (error) {
      console.error('reCAPTCHA error:', error);
      return null;
    }
  };

  return { executeRecaptcha };
}

// Hook for easy usage
export function useReCaptcha() {
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

  const executeRecaptcha = async (action = 'submit') => {
    if (!siteKey) {
      // reCAPTCHA not configured, bypass
      return null;
    }

    if (!window.grecaptcha) {
      console.warn('reCAPTCHA not loaded yet');
      return null;
    }

    try {
      await window.grecaptcha.ready();
      const token = await window.grecaptcha.execute(siteKey, { action });
      return token;
    } catch (error) {
      console.error('reCAPTCHA error:', error);
      return null;
    }
  };

  return { executeRecaptcha, isEnabled: !!siteKey };
}
